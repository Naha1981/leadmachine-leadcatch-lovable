import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const __filename = fileURLToPath(import.meta.url);
const ENGINE_DIR = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(ENGINE_DIR, "out/http");
const PORT = Number(process.env.PORT || 3030);
const API_KEY = process.env.VIDEO_ENGINE_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.LEAD_MACHINE_VIDEO_BUCKET || "lead-machine-videos";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
let bundlePromise;
const jobs = new Map();

function safeSlug(value) {
  return String(value ?? "prospect").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "prospect";
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) { reject(new Error("Request body too large.")); request.destroy(); }
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON body.")); }
    });
    request.on("error", reject);
  });
}

function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function getBundle() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: path.resolve(ENGINE_DIR, "index.ts"),
      publicDir: path.resolve(ENGINE_DIR, "public"),
      outDir: path.resolve(ENGINE_DIR, ".remotion-http-bundle"),
    });
  }
  return bundlePromise;
}

async function uploadVideo(localPath, objectPath) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase video storage is not configured.");
  const create = await fetch(SUPABASE_URL + "/storage/v1/bucket", {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 104857600 }),
  });
  if (!create.ok && create.status !== 409) throw new Error("Could not prepare Supabase Storage bucket (HTTP " + create.status + ").");
  const bytes = fs.readFileSync(localPath);
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  const uploaded = await fetch(SUPABASE_URL + "/storage/v1/object/" + encodeURIComponent(BUCKET) + "/" + encoded, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "video/mp4", "x-upsert": "true" },
    body: bytes,
  });
  if (!uploaded.ok) throw new Error("Supabase video upload failed (HTTP " + uploaded.status + ").");
  return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + encoded;
}

function auth(request) {
  if (!API_KEY) return true;
  const supplied = request.headers["x-video-engine-key"];
  if (typeof supplied !== "string") return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(API_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function renderJob(payload, jobId) {
  const required = ["businessName", "prospectId"];
  for (const key of required) if (!payload[key]) throw new Error("Missing " + key + ".");
  const serveUrl = await getBundle();
  const outputLocation = path.join(OUTPUT_DIR, safeSlug(payload.prospectId) + "-" + safeSlug(payload.businessName) + "-" + jobId + ".mp4");
  const composition = await selectComposition({ serveUrl, id: "LeadMachineVideo", inputProps: payload });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps: payload,
    concurrency: Math.max(1, Math.min(4, Number(process.env.RENDER_CONCURRENCY || 2))),
    crf: 20,
  });
  const videoUrl = await uploadVideo(outputLocation, "prospects/" + safeSlug(payload.prospectId) + "/" + path.basename(outputLocation));
  return { videoUrl };
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { ok: true, service: "leadmachine-video-engine" });
    if (!auth(request)) return json(response, 401, { ok: false, error: "Unauthorized" });

    if (request.method === "GET" && url.pathname.startsWith("/render/")) {
      const jobId = url.pathname.slice("/render/".length);
      const job = jobs.get(jobId);
      if (!job) return json(response, 404, { ok: false, error: "Render job not found" });
      return json(response, 200, { ok: true, jobId, ...job });
    }

    if (request.method === "POST" && url.pathname === "/render") {
      const payload = await readJson(request);
      const jobId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      jobs.set(jobId, { status: "processing", startedAt });
      try {
        const result = await renderJob(payload, jobId);
        jobs.set(jobId, { status: "completed", startedAt, completedAt: new Date().toISOString(), videoUrl: result.videoUrl });
        return json(response, 200, { ok: true, jobId, status: "completed", videoUrl: result.videoUrl });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Render failed";
        jobs.set(jobId, { status: "failed", startedAt, completedAt: new Date().toISOString(), error: message });
        return json(response, 500, { ok: false, jobId, status: "failed", error: message });
      }
    }

    return json(response, 404, { ok: false, error: "Not found" });
  } catch (error) {
    return json(response, 400, { ok: false, error: error instanceof Error ? error.message : "Request failed" });
  }
});

server.listen(PORT, () => console.log("[LeadMachine video engine] listening on " + PORT));