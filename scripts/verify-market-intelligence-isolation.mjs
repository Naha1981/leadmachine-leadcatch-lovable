const base = process.env.BASE_URL;
const tenantA = process.env.MI_TENANT_A_ID;
const tenantAToken = process.env.MI_TENANT_A_TOKEN;
const tenantB = process.env.MI_TENANT_B_ID;
const tenantBToken = process.env.MI_TENANT_B_TOKEN;
if (!base || !tenantA || !tenantAToken || !tenantB || !tenantBToken) throw new Error("BASE_URL, MI_TENANT_A_ID/TOKEN and MI_TENANT_B_ID/TOKEN are required.");
async function read(token) {
  const response = await fetch(base + "/api/market-intelligence", { headers: { Authorization: "Bearer " + token } });
  if (!response.ok) throw new Error("Market Intelligence API returned HTTP " + response.status);
  return response.json();
}
const [a, b] = await Promise.all([read(tenantAToken), read(tenantBToken)]);
const idsA = new Set(Object.values(a.categories ?? {}).flat().map((item) => item.id));
const idsB = new Set(Object.values(b.categories ?? {}).flat().map((item) => item.id));
const overlap = [...idsA].filter((id) => idsB.has(id));
if (overlap.length) throw new Error("Tenant isolation failed. Shared signal IDs: " + overlap.join(","));
console.log(JSON.stringify({ ok: true, tenantA: idsA.size, tenantB: idsB.size, overlap: overlap.length }, null, 2));
