import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import * as XLSX from "xlsx";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_DIR = path.resolve(__dirname, "..");
const DEFAULT_WORKBOOK = path.resolve(ENGINE_DIR, "../NahaLabs_LeadMachine_Prospects.xlsx");
const OUTPUT_DIR = path.resolve(ENGINE_DIR, "out/prospects");

const args = new Map(
  process.argv.slice(2).flatMap((arg, index, all) => {
    if (!arg.startsWith("--")) return [];
    const [rawKey, rawValue] = arg.slice(2).split("=");
    if (rawValue !== undefined) return [[rawKey, rawValue]];
    const next = all[index + 1];
    return [[rawKey, next && !next.startsWith("--") ? next : "true"]];
  }),
);

const workbookPath = path.resolve(args.get("workbook") || DEFAULT_WORKBOOK);
const requestedLimit = Number(args.get("limit") || "0");
const tierFilter = String(args.get("tier") || "").trim();
const allRows = String(args.get("all") || "false").toLowerCase() === "true";
const jobs = Math.max(1, Number(args.get("jobs") || "1"));
const upload = String(args.get("upload") || process.env.SUPABASE_UPLOAD || "false").toLowerCase() === "true";

function nonEmpty(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^(pending stage|n\/a|unknown|unverified|none observed|not contacted)/i.test(text)) return "";
  return text.replace(/\s+/g, " ");
}

function safeSlug(value) {
  return nonEmpty(value, "prospect")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function safeFilePart(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
}

function asFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function loadProspects(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workbook not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets.MASTER_PROSPECTS;
  if (!sheet) throw new Error("MASTER_PROSPECTS sheet not found in workbook.");

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows
    .map((row) => ({
      prospectId: nonEmpty(row["Prospect ID"]),
      businessName: nonEmpty(row["Business Name"]),
      industry: nonEmpty(row["Industry"]),
      location: nonEmpty(row["Location"]),
      googleRating: asFiniteNumber(row["Google Rating"]),
      reviewCount: asFiniteNumber(row["Review Count"]),
      website: nonEmpty(row["Website"]),
      currentCta: nonEmpty(row["Current CTA"]),
      currentEnquiryFlow: nonEmpty(row["Current Enquiry Flow"]),
      websiteEnquiryForm: nonEmpty(row["Website Enquiry Form?"]),
      onlineBooking: nonEmpty(row["Online Booking?"]),
      quoteRequest: nonEmpty(row["Quote Request?"]),
      whatsAppCta: nonEmpty(row["WhatsApp CTA?"]),
      digitalPresenceGap: nonEmpty(row["Digital Presence Gap"]),
      observedEnquiryFriction: nonEmpty(row["Observed Enquiry Friction"]),
      potentialLeakageRisk: nonEmpty(row["Potential Leakage Risk"]),
      leadMachineConcept: nonEmpty(row["Lead Machine Concept"]),
      conversionEvent: nonEmpty(row["Conversion Event"]),
      followUpSequence: nonEmpty(row["Follow-up Sequence"]),
      prospectTier: nonEmpty(row["Prospect Tier"]),
      demoUrl: nonEmpty(row["Demo URL"]),
    }))
    .filter((row) => row.prospectId && row.businessName);
}

function isRenderable(row) {
  if (!row.website && !row.currentCta && !row.currentEnquiryFlow && !row.digitalPresenceGap && !row.observedEnquiryFriction) {
    return false;
  }
  if (tierFilter) {
    const wanted = tierFilter.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (!wanted.includes(String(row.prospectTier || "").toUpperCase())) return false;
  }
  return true;
}

async function ensureSupabaseBucket() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.LEAD_MACHINE_VIDEO_BUCKET || "lead-machine-videos";

  if (!url || !key) {
    throw new Error("Upload requested but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.");
  }

  const create = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 104857600 }),
  });

  if (!create.ok && create.status !== 409) {
    const body = await create.text();
    throw new Error(`Could not create/access Supabase bucket: HTTP ${create.status} ${body}`);
  }

  return { url, key, bucket };
}

async function uploadToSupabase(localPath, objectPath, storage) {
  const body = fs.readFileSync(localPath);
  const response = await fetch(
    `${storage.url}/storage/v1/object/${encodeURIComponent(storage.bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: storage.key,
        Authorization: `Bearer ${storage.key}`,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase upload failed: HTTP ${response.status} ${text}`);
  }

  return `${storage.url}/storage/v1/object/public/${storage.bucket}/${objectPath}`;
}

function makeProps(row) {
  return {
    ...row,
    demoUrl: row.demoUrl || `https://demo.leadmachine.co.za/${encodeURIComponent(row.prospectId)}`,
  };
}

async function renderOne({ serveUrl, row, index, total, renderConcurrency }) {
  const props = makeProps(row);
  const dir = path.join(OUTPUT_DIR, safeSlug(row.prospectId));
  fs.mkdirSync(dir, { recursive: true });
  const outputLocation = path.join(dir, `${safeFilePart(row.prospectId)}-${safeSlug(row.businessName)}.mp4`);

  if (fs.existsSync(outputLocation) && String(args.get("overwrite") || "false") !== "true") {
    return { row, outputLocation, skipped: true };
  }

  console.log(`[${index + 1}/${total}] Rendering ${row.businessName} (${row.prospectId})`);

  const composition = await selectComposition({
    serveUrl,
    id: "LeadMachineVideo",
    inputProps: props,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps: props,
    concurrency: renderConcurrency,
    crf: 20,
  });

  return { row, outputLocation, skipped: false };
}

async function runPool(items, worker, poolSize) {
  const results = new Array(items.length);
  let cursor = 0;

  async function consume() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(poolSize, items.length) }, () => consume()));
  return results;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const rows = loadProspects(workbookPath).filter(isRenderable);
  const selected = allRows ? rows : rows.filter((row) => {
    const tier = String(row.prospectTier || "").toUpperCase();
    return tier === "A+" || tier === "A" || tier === "B";
  });

  const limited = requestedLimit > 0 ? selected.slice(0, requestedLimit) : selected;

  if (!limited.length) {
    throw new Error("No renderable prospects matched the filters.");
  }

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Selected: ${limited.length} prospects`);
  console.log(`Jobs: ${jobs}`);

  const serveUrl = await bundle({
    entryPoint: path.resolve(ENGINE_DIR, "index.ts"),
    publicDir: path.resolve(ENGINE_DIR, "public"),
    outDir: path.resolve(ENGINE_DIR, ".remotion-bundle"),
  });

  const cpuCount = os.cpus().length;
  const renderConcurrency = Math.max(1, Math.floor(cpuCount / Math.max(2, jobs * 2)));

  const storage = upload ? await ensureSupabaseBucket() : null;

  const rendered = await runPool(
    limited,
    (row, index) => renderOne({
      serveUrl,
      row,
      index,
      total: limited.length,
      renderConcurrency,
    }),
    jobs,
  );

  const manifest = [];
  for (const item of rendered) {
    const { row, outputLocation, skipped } = item;
    let url = null;

    if (storage) {
      const objectPath = `prospects/${safeSlug(row.prospectId)}/${path.basename(outputLocation)}`;
      url = await uploadToSupabase(outputLocation, objectPath, storage);
    }

    manifest.push({
      prospectId: row.prospectId,
      businessName: row.businessName,
      tier: row.prospectTier,
      outputPath: outputLocation,
      videoUrl: url,
      skipped,
      generatedAt: new Date().toISOString(),
    });
  }

  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Manifest: ${manifestPath}`);
  console.log(`Completed: ${manifest.filter((x) => !x.skipped).length}`);
  console.log(`Skipped existing: ${manifest.filter((x) => x.skipped).length}`);
  if (storage) console.log("Public video URLs uploaded to Supabase Storage.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
