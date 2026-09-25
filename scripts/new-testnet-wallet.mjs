// Creates a throwaway Ed25519 keypair for Pacifica TESTNET probes. Never fund it with real money.
// Writes .secrets/testnet-wallet.json (gitignored): Solana CLI format (64-byte array) + base58 forms.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../.secrets/testnet-wallet.json", import.meta.url);
if (existsSync(OUT)) { console.error("Wallet already exists, refusing to overwrite:", OUT.pathname); process.exit(1); }

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes) {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0")), s = "";
  while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b) break; s = "1" + s; }
  return s;
}

const { privateKey } = generateKeyPairSync("ed25519");
const jwk = privateKey.export({ format: "jwk" });
const seed = Buffer.from(jwk.d, "base64url"), pub = Buffer.from(jwk.x, "base64url");
const secret = Buffer.concat([seed, pub]);

mkdirSync(new URL(".", OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  network: "pacifica-testnet-only",
  publicKey: base58(pub),
  secretKeyBase58: base58(secret), // Phantom "Import private key" format
  secretKey: [...secret],          // Solana CLI format
}, null, 2), { mode: 0o600 });
console.log("Public key:", base58(pub));
