import { describe, expect, test } from "bun:test";
import { createQuoteFormToken, validateQuoteFormToken } from "../src/lib/quote-form-token.server";

describe("quote form token", () => {
  test("rejects forged timestamps", () => {
    const issuedAt = Date.now();
    const token = createQuoteFormToken("plumber", issuedAt);

    expect(validateQuoteFormToken(token, "plumber", issuedAt + 2_500)).toEqual({
      ok: true,
      issuedAt,
    });

    expect(validateQuoteFormToken(token, "plumber", issuedAt + 2_000)).toEqual({
      ok: false,
      reason: "too_fast",
    });
  });

  test("rejects tampering and slug reuse", () => {
    const issuedAt = Date.now();
    const token = createQuoteFormToken("plumber", issuedAt);
    const [payload] = token.split(".");

    expect(validateQuoteFormToken(`${payload}.deadbeef`, "plumber", issuedAt + 3_000).ok).toBe(false);
    expect(validateQuoteFormToken(token, "electrician", issuedAt + 3_000)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  test("rejects expired tokens", () => {
    const issuedAt = Date.now();
    const token = createQuoteFormToken("plumber", issuedAt);

    expect(validateQuoteFormToken(token, "plumber", issuedAt + 2 * 60 * 60 * 1_000 + 1)).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});
