import { describe, expect, test } from "bun:test";
import { checkDurableQuoteLimits } from "../src/lib/quote-rate-limit.server";

function makeDb(results: Array<{ count?: number; error?: Error }>, insertResult = { error: null as Error | null }) {
  let index = 0;
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                gte() {
                  return Promise.resolve(results[index++] ?? { count: 0, error: null });
                },
              };
            },
          };
        },
        insert() {
          return Promise.resolve(insertResult);
        },
      };
    },
  };
}

describe("durable quote rate limiter", () => {
  test("fails closed when the database lookup fails", async () => {
    const db = makeDb([{ error: new Error("database unavailable") }, { count: 0 }]);

    await expect(
      checkDurableQuoteLimits(db, "plumber", "ip-hash", "27821234567"),
    ).rejects.toThrow("QUOTE_RATE_LIMIT_UNAVAILABLE");
  });

  test("fails closed when recording the submission fails", async () => {
    const db = makeDb([{ count: 0 }, { count: 0 }], { error: new Error("insert failed") });

    await expect(
      checkDurableQuoteLimits(db, "plumber", "ip-hash", "27821234567"),
    ).rejects.toThrow("QUOTE_RATE_LIMIT_UNAVAILABLE");
  });

  test("blocks at the configured IP and phone limits", async () => {
    const ipLimited = makeDb([{ count: 5 }, { count: 0 }]);
    await expect(
      checkDurableQuoteLimits(ipLimited, "plumber", "ip-hash", "27821234567"),
    ).resolves.toBe("Too many enquiries from this connection. Please try again shortly.");

    const phoneLimited = makeDb([{ count: 0 }, { count: 3 }]);
    await expect(
      checkDurableQuoteLimits(phoneLimited, "plumber", "ip-hash", "27821234567"),
    ).resolves.toBe("We've already received your enquiry. The business will be in touch soon.");
  });

  test("records an allowed submission", async () => {
    const db = makeDb([{ count: 0 }, { count: 0 }]);

    await expect(
      checkDurableQuoteLimits(db, "plumber", "ip-hash", "27821234567"),
    ).resolves.toBeNull();
  });
});
