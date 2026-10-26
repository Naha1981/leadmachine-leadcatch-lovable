/** Quote JSON contains text and up to five uploaded photo paths, never image bytes.
 * The schema's maximum fields occupy under 26 KB even with JSON escape expansion.
 * 32 KiB leaves room for field names while bounding pre-validation work.
 */
export const QUOTE_REQUEST_MAX_BYTES = 32 * 1024;
export class QuoteRequestTooLarge extends Error {}

export async function readQuoteRequest(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > QUOTE_REQUEST_MAX_BYTES) {
    await request.body?.cancel().catch(() => {});
    throw new QuoteRequestTooLarge();
  }
  if (!request.body) throw new Error("Missing request body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > QUOTE_REQUEST_MAX_BYTES) {
        await reader.cancel().catch(() => {});
        throw new QuoteRequestTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  if (input && typeof input === "object" && "photoPaths" in input) {
    const paths = (input as { photoPaths?: unknown }).photoPaths;
    if (Array.isArray(paths) && paths.length > 5) throw new Error("Too many photo paths");
  }
  return input;
}
