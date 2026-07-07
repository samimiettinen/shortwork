// Symmetric encryption for OAuth tokens stored in the `oauth_tokens` table.
// A database leak (backup, snapshot) no longer exposes usable credentials
// without also having TOKEN_ENCRYPTION_KEY (kept in edge-function secrets).
//
// Format on-disk: `enc:v1:<base64url(iv|ciphertext|tag)>`
// Anything that doesn't start with `enc:v1:` is treated as legacy plaintext
// and returned as-is by `decryptToken`, so pre-existing rows keep working
// until they're re-written by the next refresh/reconnect.

const PREFIX = "enc:v1:";

async function getKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!raw) return null;
  // Accept hex (64 chars = 32 bytes) or any string ≥ 32 chars.
  let keyBytes: Uint8Array;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    keyBytes = new Uint8Array(
      raw.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
    );
  } else {
    // Hash arbitrary string down to 32 bytes.
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw),
    );
    keyBytes = new Uint8Array(digest);
  }
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const s = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function encryptToken(plain: string | null | undefined): Promise<string | null> {
  if (plain == null) return null;
  if (plain === "") return "";
  const key = await getKey();
  if (!key) {
    // No key configured — fall back to plaintext to avoid breaking auth flow.
    // Deployments must set TOKEN_ENCRYPTION_KEY for encryption to activate.
    console.warn("[token-crypto] TOKEN_ENCRYPTION_KEY not set; storing plaintext");
    return plain;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );
  const buf = new Uint8Array(iv.length + cipher.length);
  buf.set(iv, 0);
  buf.set(cipher, iv.length);
  return PREFIX + b64urlEncode(buf);
}

export async function decryptToken(stored: string | null | undefined): Promise<string> {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = await getKey();
  if (!key) {
    console.error("[token-crypto] TOKEN_ENCRYPTION_KEY missing — cannot decrypt token");
    return "";
  }
  try {
    const raw = b64urlDecode(stored.slice(PREFIX.length));
    const iv = raw.slice(0, 12);
    const cipher = raw.slice(12);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipher,
    );
    return new TextDecoder().decode(plain);
  } catch (e) {
    console.error("[token-crypto] decrypt failed:", e);
    return "";
  }
}
