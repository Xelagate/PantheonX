// Pacifica request signing: canonical message → Ed25519 signature (injected signer) → flat body.
// Spec: docs.pacifica.fi/api-documentation/api/signing/implementation

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b) break; s = "1" + s; }
  return s;
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
  return v;
}

export function canonical(type, data, timestamp, expiryWindow) {
  return JSON.stringify(sortKeys({ timestamp, expiry_window: expiryWindow, type, data }));
}

// signMessage: (Uint8Array) => Promise<Uint8Array> — raw 64-byte Ed25519 signature.
export async function signedBody({ type, data, account, signMessage, now = Date.now(), expiryWindow = 30000 }) {
  const message = new TextEncoder().encode(canonical(type, data, now, expiryWindow));
  const signature = base58(await signMessage(message));
  return { account, signature, timestamp: now, expiry_window: expiryWindow, ...data };
}
