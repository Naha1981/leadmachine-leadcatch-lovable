import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

const env = { CONTENT_API_KEY: "test-service-key" };

/** Stub fetch: Supabase auth/rest + content-api. Records upstream calls. */
function stubFetch({ role = "owner", radarBody = { signals: [{ topic: "Leaks in Sandton" }] } } = {}) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      if ((opts.headers?.authorization || "") === "Bearer good-jwt")
        return Response.json({ id: "user-1", email: "qa@example.com" });
      return Response.json({ message: "bad jwt" }, { status: 401 });
    }
    if (u.includes("/rest/v1/user_roles"))
      return Response.json(role === "member" ? [{ tenant_id: "tenant-member", role: "staff" }] : []);
    if (u.includes("/rest/v1/tenants")) return Response.json([{ id: "tenant-owner" }]);
    if (u.includes("/v1/radar/weekly")) { calls.push({ u, h: opts.headers }); return Response.json(radarBody); }
    if (u.includes("/api/v1/accounts")) { calls.push({ u, h: opts.headers }); return Response.json({ items: [] }); }
    throw new Error("unstubbed: " + u);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

const req = (body, jwt) =>
  new Request("https://revenuedesk.nahalabs.co.za/bridge", {
    method: "POST",
    headers: { "content-type": "application/json", ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  });

test("auth: no jwt -> 401, bad jwt -> 401", async () => {
  const s = stubFetch();
  assert.equal((await worker.fetch(req({ action: "accounts" }), env)).status, 401);
  assert.equal((await worker.fetch(req({ action: "accounts" }, "bad-jwt"), env)).status, 401);
  s.restore();
});

test("accounts regression: valid session -> 200 passthrough", async () => {
  const s = stubFetch();
  const r = await worker.fetch(req({ action: "accounts" }, "good-jwt"), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { items: [] });
  s.restore();
});

test("radar: missing params -> 422 before any upstream call", async () => {
  const s = stubFetch();
  const r = await worker.fetch(req({ action: "radar", industry: "plumbing" }, "good-jwt"), env);
  assert.equal(r.status, 422);
  assert.equal(s.calls.length, 0);
  s.restore();
});

test("radar: forwards to /v1/radar/weekly and returns signals", async () => {
  const s = stubFetch();
  const r = await worker.fetch(req({ action: "radar", industry: "plumbing", area: "Sandton" }, "good-jwt"), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { signals: [{ topic: "Leaks in Sandton" }] });
  assert.match(s.calls[0].u, /\/v1\/radar\/weekly\?industry=plumbing&area=Sandton/);
  s.restore();
});

test("tenant isolation: workspace header is the caller's tenant, never body-supplied", async () => {
  const s = stubFetch({ role: "member" });
  const r = await worker.fetch(
    req({ action: "radar", industry: "plumbing", area: "Sandton", workspace_id: "attacker", tenant_id: "attacker" }, "good-jwt"),
    env,
  );
  assert.equal(r.status, 200);
  assert.equal(s.calls[0].h["x-workspace-id"], "tenant-member");
  s.restore();
});

test("owner fallback: tenant resolved via tenants table when no membership", async () => {
  const s = stubFetch({ role: "owner" });
  const r = await worker.fetch(req({ action: "radar", industry: "plumbing", area: "Sandton" }, "good-jwt"), env);
  assert.equal(r.status, 200);
  assert.equal(s.calls[0].h["x-workspace-id"], "tenant-owner");
  s.restore();
});

test("unknown action -> 422 (distinguishes stale deploys)", async () => {
  const s = stubFetch();
  const r = await worker.fetch(req({ action: "nope" }, "good-jwt"), env);
  assert.equal(r.status, 422);
  assert.deepEqual(await r.json(), { error: "unknown action" });
  s.restore();
});
