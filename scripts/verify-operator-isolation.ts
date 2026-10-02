type Account = { waAccountId: string };

const baseUrl = (process.env["OPERATOR_URL"] || "https://my-own-whatsapp-2z5h.onrender.com").replace(/\/$/, "");
const appId = process.env["OPERATOR_APP_ID"] || "leadcatch-sa";

const tenantAId = process.env["READINESS_TENANT_A_ID"];
const tenantAToken = process.env["READINESS_TENANT_A_TOKEN"];
const tenantBId = process.env["READINESS_TENANT_B_ID"];
const tenantBToken = process.env["READINESS_TENANT_B_TOKEN"];

for (const [name, value] of Object.entries({
  READINESS_TENANT_A_ID: tenantAId,
  READINESS_TENANT_A_TOKEN: tenantAToken,
  READINESS_TENANT_B_ID: tenantBId,
  READINESS_TENANT_B_TOKEN: tenantBToken,
})) {
  if (!value) throw new Error(name + " is required for the non-destructive operator isolation test.");
}

async function request(
  tenantId: string,
  token: string | undefined,
  path: string,
): Promise<Response> {
  const headers = new Headers({
    "X-App-Id": appId,
    "X-Tenant-Id": tenantId,
    "Accept": "application/json",
  });
  if (token) headers.set("X-NahaLabs-Tenant-Token", token);
  return fetch(baseUrl + path, { headers, signal: AbortSignal.timeout(15_000) });
}

async function readMine(tenantId: string, token: string): Promise<Account[]> {
  const response = await request(tenantId, token, "/accounts/mine");
  if (!response.ok) throw new Error("Tenant account listing failed with HTTP " + response.status);
  const body = (await response.json()) as { accounts?: Account[] };
  return body.accounts ?? [];
}

const accountsA = await readMine(tenantAId!, tenantAToken!);
const accountsB = await readMine(tenantBId!, tenantBToken!);

const idsA = new Set(accountsA.map((account) => account.waAccountId));
const overlap = accountsB
  .map((account) => account.waAccountId)
  .filter((id) => idsA.has(id));

if (overlap.length > 0) {
  throw new Error("Tenant isolation failed: account IDs overlap between the two test tenants.");
}

const missingAuth = await request(tenantAId!, undefined, "/accounts/mine");
if (missingAuth.status !== 401) {
  throw new Error("Expected unauthenticated /accounts/mine to return 401; received " + missingAuth.status);
}

if (accountsA[0]) {
  const crossTenant = await request(
    tenantBId!,
    tenantBToken!,
    "/accounts/" + encodeURIComponent(accountsA[0].waAccountId) + "/status",
  );
  if (crossTenant.status !== 403) {
    throw new Error(
      "Expected cross-tenant account access to return 403; received " + crossTenant.status,
    );
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      tenantAAccounts: accountsA.length,
      tenantBAccounts: accountsB.length,
      overlap: overlap.length,
      crossTenantStatus: accountsA[0] ? 403 : "not-run",
    },
    null,
    2,
  ),
);
