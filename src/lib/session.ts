// Signed session tokens using the Web Crypto API only, so this module works
// both in Node.js route handlers and in the Edge middleware runtime.

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: string;
  username: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const str = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(str.length));
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey(getSecret());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const key = await getHmacKey(getSecret());
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(base64urlDecode(body))) as SessionPayload;
    if (!payload.userId || !payload.username) return null;
    return payload;
  } catch {
    return null;
  }
}
