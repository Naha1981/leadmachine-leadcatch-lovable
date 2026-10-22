// Application-level authenticated encryption for per-tenant integration secrets.
// AES-256-GCM with the (tenant_id, provider) pair as additional authenticated
// data, so a ciphertext row copied to another tenant or provider cannot be
// decrypted. The key comes from a server-only env var; when it is missing or
// invalid every operation fails closed. Plaintext is never stored, logged or
// returned by any status path.
const ENV_KEY = "INTEGRATION_SECRETS_KEY";
const VERSION = "v1";

async function loadKey(): Promise<CryptoKey> {
  const raw = process.env[ENV_KEY];
  if (!raw) throw new Error("Integration secret storage is not configured");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Integration secret storage is not configured");
  }
  if (bytes.length !== 32) throw new Error("Integration secret storage is not configured");
  return crypto.subtle.importKey("raw", bytes as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function aad(tenantId: string, provider: string): BufferSource {
  return new TextEncoder().encode(`${tenantId}${provider}`) as BufferSource;
}

const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...(b instanceof Uint8Array ? b : new Uint8Array(b))));

/** Encrypt for storage. Throws (fails closed) when storage is not configured. */
export async function encryptSecret(tenantId: string, provider: string, plaintext: string): Promise<string> {
  if (!plaintext) throw new Error("Nothing to store");
  const key = await loadKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(tenantId, provider) },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${VERSION}.${b64(iv)}.${b64(ct)}`;
}

/** Decrypt a stored value. Throws on tampering, wrong tenant/provider, bad format or missing config. */
export async function decryptSecret(tenantId: string, provider: string, stored: string): Promise<string> {
  const parts = String(stored || "").split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) throw new Error("Stored secret has an unknown format");
  const key = await loadKey();
  const iv = Uint8Array.from(atob(parts[1]!), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(parts[2]!), (c) => c.charCodeAt(0));
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad(tenantId, provider) },
      key,
      ct as BufferSource,
    );
  } catch {
    throw new Error("Stored secret could not be read");
  }
  return new TextDecoder().decode(plain);
}
