import { chromium } from "playwright";
import { createHmac } from "node:crypto";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const e2eSecret = process.env.E2E_TEST_SECRET || "e2e-secret";
const webhookSecret = process.env.WEBHOOK_SECRET || "smoke-webhook";
const cronSecret = process.env.CRON_SECRET || "smoke-cron";

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function json(res) {
  const body = await res.json();
  if (!res.ok()) throw new Error("HTTP " + res.status() + ": " + JSON.stringify(body));
  return body;
}

try {
  const seed = await json(await desktop.request.post(base + "/api/test/acceptance", {
    headers: { "x-e2e-secret": e2eSecret },
  }));
  if (!seed.ok || !seed.siteUrl) throw new Error("Acceptance fixture did not seed");

  const publicPage = await desktop.request.get(base + seed.siteUrl);
  if (publicPage.status() !== 200) throw new Error("Published business page returned HTTP " + publicPage.status());

  await desktop.goto(base + seed.siteUrl, { waitUntil: "domcontentloaded" });
  await desktop.getByText("E2E Test Plumbing", { exact: true }).waitFor();
  await desktop.getByText("Services", { exact: true }).waitFor();
  await desktop.getByText("About us", { exact: true }).waitFor();
  await desktop.getByRole("heading", { name: "Get a free quote on WhatsApp" }).waitFor();

  const themeToggle = desktop.getByRole("button", { name: "Switch to dark theme" });
  await themeToggle.click();
  await desktop.waitForTimeout(100);
  if (!(await desktop.locator("html").getAttribute("class"))?.includes("dark")) {
    throw new Error("Desktop dark theme did not apply");
  }
  const persisted = await desktop.evaluate(() => ({
    localStorageTheme: localStorage.getItem("leadmachine-theme"),
    cookieTheme: document.cookie.match(/(?:^|; )leadmachine-theme=(dark|light)(?:;|$)/)?.[1] ?? null,
  }));
  if (persisted.localStorageTheme !== "dark" && persisted.cookieTheme !== "dark") {
    throw new Error("Theme preference was not persisted before reload: " + JSON.stringify(persisted));
  }
  await desktop.reload({ waitUntil: "domcontentloaded" });
  await desktop.waitForTimeout(250);
  if (!(await desktop.locator("html").getAttribute("class"))?.includes("dark")) {
    throw new Error("Theme did not persist across reload");
  }
  await desktop.getByRole("button", { name: "Switch to light theme" }).click();

  const name = "Quote Test Customer";
  const phone = "08255550123";
  await desktop.getByPlaceholder("Your name").fill(name);
  await desktop.getByPlaceholder("WhatsApp number e.g. 082 123 4567").fill(phone);
  await desktop.getByPlaceholder("What do you need help with?").fill("Urgent geyser burst in Sandton. I need someone today.");
  await desktop.getByRole("checkbox").check();
  const quoteResponsePromise = desktop.waitForResponse(
    (response) => response.url().includes("/api/public/site-lead") && response.request().method() === "POST",
    { timeout: 15000 }
  );
  await desktop.getByRole("button", { name: "Send" }).click();
  const quoteResponse = await quoteResponsePromise;
  const quoteBody = await quoteResponse.json().catch(() => ({}));
  if (!quoteResponse.ok()) {
    throw new Error("Quote submission failed: HTTP " + quoteResponse.status() + " " + JSON.stringify(quoteBody));
  }
  if (quoteBody?.ok !== true) {
    throw new Error("Quote submission returned an unsuccessful payload: " + JSON.stringify(quoteBody));
  }
  await desktop.getByText("Thanks, we've got your details.").waitFor({ timeout: 5000 });

  const stateAfterQuote = await json(await desktop.request.get(base + "/api/test/acceptance", {
    headers: { "x-e2e-secret": e2eSecret },
  }));
  if (!stateAfterQuote.site?.published) throw new Error("Business page is not published");
  if (stateAfterQuote.lead?.name !== name) throw new Error("Quote form did not create the expected inbox lead");
  if (typeof stateAfterQuote.lead?.ai_score !== "number") throw new Error("Quote lead has no AI score");
  if (!["hot", "warm", "cold"].includes(stateAfterQuote.lead?.ai_temperature)) throw new Error("Quote lead has no valid AI temperature");

  const cron = await json(await desktop.request.get(base + "/api/cron/lead-leakage", {
    headers: { Authorization: "Bearer " + cronSecret },
  }));
  const leakage = (cron.processed || []).find((x) => x.leadId === seed.leakageLeadId);
  if (leakage?.status !== "alerted" || leakage?.whatsapp !== true) {
    throw new Error("15-minute leakage alert did not fire: " + JSON.stringify(cron));
  }

  const payload = {
    schemaVersion: 1,
    waAccountId: "e2e-account",
    appId: "leadcatch-sa",
    tenantId: seed.tenantId,
    event: "message",
    deliveredAt: new Date().toISOString(),
    data: {
      messageId: "e2e-inbound-" + Date.now(),
      chatId: "27825550777@s.whatsapp.net",
      pushName: "WhatsApp Test Customer",
      text: "Emergency geyser burst in Sandton right now.",
      fromMe: false,
      messageType: "text",
      timestamp: Math.floor(Date.now() / 1000),
    },
  };
  const raw = JSON.stringify(payload);
  const signature = createHmac("sha256", webhookSecret).update(raw).digest("hex");
  const webhook = await desktop.request.post(base + "/api/public/whatsapp/webhook", {
    data: raw,
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": signature,
    },
  });
  if (!webhook.ok()) throw new Error("Inbound WhatsApp webhook failed: HTTP " + webhook.status());

  const stateAfterWhatsapp = await json(await desktop.request.get(base + "/api/test/acceptance", {
    headers: { "x-e2e-secret": e2eSecret },
  }));
  if (stateAfterWhatsapp.lead?.name !== "WhatsApp Test Customer") throw new Error("Inbound WhatsApp lead did not reach inbox data");
  if (typeof stateAfterWhatsapp.lead?.ai_score !== "number") throw new Error("Inbound WhatsApp lead has no AI score");
  if (!["hot", "warm", "cold"].includes(stateAfterWhatsapp.lead?.ai_temperature)) throw new Error("Inbound WhatsApp lead has no temperature");
  if (!stateAfterWhatsapp.lead?.ai_score || stateAfterWhatsapp.lead.ai_score < 8) {
    throw new Error("Urgent WhatsApp lead was not scored hot");
  }

  await desktop.goto(base + "/", { waitUntil: "domcontentloaded" });
  await desktop.getByRole("button", { name: "Switch to dark theme" }).click();
  await desktop.waitForTimeout(100);
  await desktop.getByRole("button", { name: "Switch to light theme" }).click();

  await mobile.goto(base + "/", { waitUntil: "domcontentloaded" });
  const mobileToggle = mobile.getByRole("button", { name: "Switch to dark theme" });
  await mobileToggle.click();
  await mobile.waitForTimeout(100);
  if (!(await mobile.locator("html").getAttribute("class"))?.includes("dark")) {
    throw new Error("Mobile dark theme did not apply");
  }
  await mobile.getByRole("button", { name: "Switch to light theme" }).click();

  console.log("PASS LeadMachine launch acceptance");
  console.log(JSON.stringify({
    publishedBusinessPage: true,
    quoteLeadScored: stateAfterQuote.lead.ai_score + "/" + stateAfterQuote.lead.ai_temperature,
    leakageAlert: leakage,
    whatsappLeadScored: stateAfterWhatsapp.lead.ai_score + "/" + stateAfterWhatsapp.lead.ai_temperature,
    themeDesktopMobile: true,
  }, null, 2));
} finally {
  await browser.close();
}
