import { describe, expect, test, beforeEach, afterAll } from "bun:test";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";

const originalFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: any, init?: any) => handler(String(input), init)) as any;
}

describe("HI assistant server client", () => {
  beforeEach(async () => {
    mockFetch(() => new Response("{}", { status: 200 }));
  });

  test("hiChat flattens system + user into one message and returns the answer", async () => {
    let seen: any = null;
    mockFetch((url, init) => {
      expect(url).toBe("https://hi.nahalabs.co.za/v1/chat");
      seen = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ answer: "Here is the summary." }), { status: 200 });
    });
    const { hiChat } = await import("../src/lib/hi.server");
    const r = await hiChat("hi_test", [
      { role: "system", content: "You classify." },
      { role: "user", content: "How many leads?" },
    ]);
    expect(r.text).toBe("Here is the summary.");
    expect(r.provider).toBe("nahalabs-ai");
    expect(seen.message).toContain("You classify.");
    expect(seen.message).toContain("How many leads?");
  });

  test("hiChat throws on API failure so callers can fall back", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    const { hiChat } = await import("../src/lib/hi.server");
    await expect(hiChat("hi_test", [{ role: "user", content: "hi" }])).rejects.toThrow("500");
  });

  test("hiChat throws when the answer is empty", async () => {
    mockFetch(() => new Response(JSON.stringify({ answer: "  " }), { status: 200 }));
    const { hiChat } = await import("../src/lib/hi.server");
    await expect(hiChat("hi_test", [{ role: "user", content: "hi" }])).rejects.toThrow(
      "no content",
    );
  });

  test("verifyHiKey returns the first agent name as label", async () => {
    mockFetch((url) => {
      expect(url).toBe("https://hi.nahalabs.co.za/v1/agents");
      return new Response(JSON.stringify({ agents: [{ name: "SizaSign assistant" }] }), {
        status: 200,
      });
    });
    const { verifyHiKey } = await import("../src/lib/hi.server");
    expect(await verifyHiKey("hi_test")).toEqual({ label: "SizaSign assistant" });
  });

  test("verifyHiKey rejects a bad key with a user-safe message", async () => {
    mockFetch(() => new Response("{}", { status: 401 }));
    const { verifyHiKey } = await import("../src/lib/hi.server");
    await expect(verifyHiKey("hi_bad")).rejects.toThrow("rejected");
  });
});

describe("zeroUiChat provider chain with HI", () => {
  test("uses HI when a tenant key is supplied", async () => {
    mockFetch((url) => {
      if (url.includes("hi.nahalabs.co.za")) {
        return new Response(JSON.stringify({ answer: "hi answer" }), { status: 200 });
      }
      throw new Error("no other provider should be called");
    });
    const { zeroUiChat } = await import("../src/lib/zero-ui.llm.server");
    const r = await zeroUiChat([{ role: "user", content: "status?" }], { hiKey: "hi_test" });
    expect(r.text).toBe("hi answer");
    expect(r.provider).toBe("nahalabs-ai");
  });

  test("falls back to the built-in gateway when HI fails", async () => {
    delete process.env.NAHALLM_URL;
    delete process.env.NAHALLM_API_KEY;
    process.env.LOVABLE_API_KEY = "lk_test";
    mockFetch((url) => {
      if (url.includes("hi.nahalabs.co.za")) return new Response("down", { status: 503 });
      if (url.includes("ai.gateway.lovable.dev")) {
        return new Response(JSON.stringify({ output_text: "gateway answer" }), { status: 200 });
      }
      throw new Error("unexpected call " + url);
    });
    const { zeroUiChat } = await import("../src/lib/zero-ui.llm.server");
    const r = await zeroUiChat([{ role: "user", content: "status?" }], { hiKey: "hi_test" });
    expect(r.text).toBe("gateway answer");
    expect(r.provider).toBe("existing-gateway");
    delete process.env.LOVABLE_API_KEY;
  });
});

describe("weekly content radar notes", () => {
  test("a linked market signal is labelled as market news", async () => {
    const { buildPlan } = await import("../src/lib/weekly-content");
    const rows = buildPlan({
      tenantId: "t1",
      industry: "plumber",
      businessName: "Test Co",
      suburb: "Sandton",
      week: "2026-10-19",
      signals: {
        radar: [{ title: "Geyser demand up after cold snap", url: "https://news.example/1" }],
        questions: [],
        bookingsCount: 0,
        topService: null,
      },
    });
    const radarPost = rows.find((r) => r.source === "radar");
    expect(radarPost?.source_note).toContain("Market news this week");
  });

  test("an unlinked demand signal keeps the local-demand label", async () => {
    const { buildPlan } = await import("../src/lib/weekly-content");
    const rows = buildPlan({
      tenantId: "t1",
      industry: "plumber",
      businessName: "Test Co",
      suburb: "Sandton",
      week: "2026-10-19",
      signals: {
        radar: [{ title: "People asking for leak repairs", suburb: "Randburg" }],
        questions: [],
        bookingsCount: 0,
        topService: null,
      },
    });
    const radarPost = rows.find((r) => r.source === "radar");
    expect(radarPost?.source_note).toContain("Demand noticed nearby");
    expect(radarPost?.source_note).toContain("Randburg");
  });
});

describe("integration secret storage (AES-256-GCM, tenant-bound)", () => {
  const TEST_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

  test("roundtrip encrypt/decrypt for the owning tenant", async () => {
    process.env.INTEGRATION_SECRETS_KEY = TEST_KEY;
    const { encryptSecret, decryptSecret } = await import("../src/lib/integration-secrets.server");
    const stored = await encryptSecret("tenant-a", "nahalabs-ai", "hi_secret_key_value");
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain("hi_secret_key_value");
    expect(await decryptSecret("tenant-a", "nahalabs-ai", stored)).toBe("hi_secret_key_value");
    delete process.env.INTEGRATION_SECRETS_KEY;
  });

  test("missing storage key fails closed on both write and read", async () => {
    delete process.env.INTEGRATION_SECRETS_KEY;
    const { encryptSecret, decryptSecret } = await import("../src/lib/integration-secrets.server");
    await expect(encryptSecret("t", "p", "x")).rejects.toThrow("not configured");
    await expect(decryptSecret("t", "p", "v1.aaaa.bbbb")).rejects.toThrow();
  });

  test("tampered ciphertext fails closed", async () => {
    process.env.INTEGRATION_SECRETS_KEY = TEST_KEY;
    const { encryptSecret, decryptSecret } = await import("../src/lib/integration-secrets.server");
    const stored = await encryptSecret("tenant-a", "nahalabs-ai", "hi_secret_key_value");
    const parts = stored.split(".");
    const ct = atob(parts[2]!).split("");
    ct[0] = ct[0] === "A" ? "B" : "A";
    const tampered = `${parts[0]}.${parts[1]}.${btoa(ct.join(""))}`;
    await expect(decryptSecret("tenant-a", "nahalabs-ai", tampered)).rejects.toThrow();
    delete process.env.INTEGRATION_SECRETS_KEY;
  });

  test("ciphertext cannot be moved to another tenant or provider", async () => {
    process.env.INTEGRATION_SECRETS_KEY = TEST_KEY;
    const { encryptSecret, decryptSecret } = await import("../src/lib/integration-secrets.server");
    const stored = await encryptSecret("tenant-a", "nahalabs-ai", "hi_secret_key_value");
    await expect(decryptSecret("tenant-b", "nahalabs-ai", stored)).rejects.toThrow();
    await expect(decryptSecret("tenant-a", "other-provider", stored)).rejects.toThrow();
    delete process.env.INTEGRATION_SECRETS_KEY;
  });

  test("malformed stored values fail closed", async () => {
    process.env.INTEGRATION_SECRETS_KEY = TEST_KEY;
    const { decryptSecret } = await import("../src/lib/integration-secrets.server");
    await expect(decryptSecret("t", "p", "plaintext-leak")).rejects.toThrow();
    await expect(decryptSecret("t", "p", "")).rejects.toThrow();
    delete process.env.INTEGRATION_SECRETS_KEY;
  });

  test("status response shape carries no key material", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/lib/hi.functions.ts", import.meta.url), "utf8"),
    );
    expect(src).not.toContain("api_key");
    expect(src).toContain('select("status, external_label, verified_at")');
  });
});
