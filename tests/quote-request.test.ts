import { describe, expect, test } from "bun:test";
import { readQuoteRequest, QUOTE_REQUEST_MAX_BYTES, QuoteRequestTooLarge } from "../src/lib/quote-request.server";
function req(body: string, headers = {}) { return new Request("http://localhost/quote", { method: "POST", body, headers }); }
describe("bounded quote request", () => {
  test("preserves normal quote and five uploaded paths", async () => {
    const body = { slug: "plumber", name: "Thabiso", phone: "27821234567", message: "Geyser leaking", consent: true, website: "", quoteFormToken: "token", photoPaths: Array(5).fill("tenant/photo.jpg") };
    expect(await readQuoteRequest(req(JSON.stringify(body)))).toEqual(body);
  });
  test("preserves worst-case valid schema fields with JSON escapes", async () => {
    const body = {slug: "x".repeat(80), name: "x".repeat(80), phone:"1".repeat(20), message:"\\".repeat(1000), consent:true, website:"x".repeat(200), quoteFormToken:"x".repeat(1000), photoPaths:Array(5).fill("x".repeat(300))};
    const encoded = JSON.stringify(body).replace(/x/g, "\\u0078");
    expect(new TextEncoder().encode(encoded).length).toBeLessThan(QUOTE_REQUEST_MAX_BYTES);
    expect(await readQuoteRequest(req(encoded))).toEqual(body);
  });
  test("rejects oversized declared and absent/false content lengths", async () => {
    for (const headers of [{}, {"content-length":"1"}, {"content-length":String(QUOTE_REQUEST_MAX_BYTES+1)}]) {
      await expect(readQuoteRequest(req(" ".repeat(QUOTE_REQUEST_MAX_BYTES+1),headers))).rejects.toBeInstanceOf(QuoteRequestTooLarge);
    }
  });
  test("rejects before JSON parsing, and counts UTF8 bytes", async () => {
    await expect(readQuoteRequest(req("["+" ".repeat(QUOTE_REQUEST_MAX_BYTES)))).rejects.toBeInstanceOf(QuoteRequestTooLarge);
    await expect(readQuoteRequest(req(JSON.stringify({ message:"😀".repeat(9000) })))).rejects.toBeInstanceOf(QuoteRequestTooLarge);
  });
  test("rejects too many paths before element validation", async () => {
    await expect(readQuoteRequest(req(JSON.stringify({photoPaths:Array(1000).fill(null)})))).rejects.toThrow("Too many photo paths");
  });
  test("rejects malformed JSON", async () => { await expect(readQuoteRequest(req("{"))).rejects.toThrow(); });
  test("accepts exact byte ceiling and rejects one byte over", async () => {
    const body='"'+'a'.repeat(QUOTE_REQUEST_MAX_BYTES-2)+'"';
    expect(await readQuoteRequest(req(body))).toBe('a'.repeat(QUOTE_REQUEST_MAX_BYTES-2));
    await expect(readQuoteRequest(req(body+' '))).rejects.toBeInstanceOf(QuoteRequestTooLarge);
  });
  test("does not replace schema validation for wrong path type", async () => {
    expect(await readQuoteRequest(req('{"photoPaths":"not-array"}'))).toEqual({photoPaths:"not-array"});
  });

  test("bounds streamed chunks without Content-Length and cancels on overflow", async () => {
    let cancelled=false;
    const stream = new ReadableStream({start(c){c.enqueue(new Uint8Array(20000));c.enqueue(new Uint8Array(20000));},cancel(){cancelled=true;}});
    const request=new Request("http://localhost/quote",{method:"POST",body:stream,duplex:"half"} as RequestInit);
    await expect(readQuoteRequest(request)).rejects.toBeInstanceOf(QuoteRequestTooLarge);
    expect(cancelled).toBe(true);
  });
});
