import { execFileSync } from "node:child_process";

const base = process.env["LEAD_MACHINE_APP_URL"];
const cronSecret = process.env["LEAD_MACHINE_MARKET_INTELLIGENCE_CRON_SECRET"];
if (!base || !cronSecret) throw new Error("LEAD_MACHINE_APP_URL and LEAD_MACHINE_MARKET_INTELLIGENCE_CRON_SECRET are required.");

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
}

try {
  console.log("=== Agent Reach doctor ===");
  try { console.log(run("agent-reach", ["doctor"])); } catch (error) { console.error("Agent Reach doctor returned a failure; continuing with available upstream tools."); console.error(error.stdout?.toString?.() || error.message); }

  const jobsResponse = await fetch(base + "/api/cron/market-intelligence/jobs", { headers: { Authorization: "Bearer " + cronSecret } });
  if (!jobsResponse.ok) throw new Error("Jobs endpoint returned HTTP " + jobsResponse.status);
  const { jobs } = await jobsResponse.json();
  let posted = 0;

  for (const job of jobs ?? []) {
    const documents = [];
    for (const query of job.queries ?? []) {
      let searchJson = "";
      try { searchJson = run("yt-dlp", ["ytsearch5:" + query, "--flat-playlist", "--dump-single-json", "--skip-download", "--no-warnings"]); } catch (error) { console.error("YouTube search failed", job.tenantId, query, error.message); continue; }
      let searchResult;
      try { searchResult = JSON.parse(searchJson); } catch { searchResult = null; }
      for (const entry of (searchResult?.entries ?? []).slice(0, 3)) {
        const videoUrl = entry?.webpage_url || (entry?.id ? "https://www.youtube.com/watch?v=" + entry.id : null);
        if (!videoUrl) continue;
        let details = entry;
        try {
          const detailJson = run("yt-dlp", [videoUrl, "--dump-single-json", "--skip-download", "--no-warnings"]);
          details = JSON.parse(detailJson);
        } catch {}
        const content = [
          details.title ? "Title: " + details.title : "",
          details.channel || details.uploader ? "Channel: " + (details.channel || details.uploader) : "",
          details.description ? "Description: " + String(details.description).slice(0, 4000) : "",
        ].filter(Boolean).join("\n");
        if (!content) continue;
        documents.push({
          tenantId: job.tenantId,
          source: "Agent Reach / YouTube",
          sourceType: "youtube",
          sourceUrl: videoUrl,
          externalId: details.id || entry.id || videoUrl,
          title: String(details.title || entry.title || "YouTube source").slice(0, 500),
          author: details.channel || details.uploader || null,
          publishedAt: details.upload_date ? new Date(String(details.upload_date)).toISOString() : null,
          content,
          metadata: { query, collector: "agent-reach", backend: "yt-dlp", duration: details.duration ?? null },
        });
      }
    }

    for (const url of [job.website, ...(job.competitorUrls ?? [])].filter(Boolean).slice(0, 12)) {
      try {
        const jina = run("curl", ["--fail", "--silent", "--show-error", "--max-time", "20", "https://r.jina.ai/" + url]);
        const content = String(jina).slice(0, 10000).trim();
        if (!content) continue;
        documents.push({
          tenantId: job.tenantId,
          source: "Agent Reach / Web",
          sourceType: job.competitorUrls?.includes(url) ? "competitor" : "website",
          sourceUrl: url,
          title: content.split("\n")[0]?.slice(0, 500) || url,
          content,
          metadata: { collector: "agent-reach", backend: "jina-reader" },
        });
      } catch (error) {
        console.error("Web read failed", url, error.message);
      }
    }

    for (let i = 0; i < documents.length; i += 100) {
      const chunk = documents.slice(i, i + 100);
      if (!chunk.length) continue;
      const response = await fetch(base + "/api/cron/market-intelligence/ingest", {
        method: "POST",
        headers: { Authorization: "Bearer " + cronSecret, "Content-Type": "application/json" },
        body: JSON.stringify({ documents: chunk }),
      });
      if (!response.ok) throw new Error("Ingest failed for " + job.tenantId + ": HTTP " + response.status);
      const result = await response.json();
      posted += Number(result.accepted ?? 0);
    }
    console.log("Agent Reach collected", job.tenantId, documents.length, "documents");
  }

  console.log(JSON.stringify({ ok: true, jobs: jobs?.length ?? 0, accepted: posted }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
