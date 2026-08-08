import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Mirrors the shape of Clerk's `auth()` helper so existing call sites only
// need to change their import.
export async function auth(): Promise<{ userId: string | null; username: string | null }> {
  const session = await getSession();
  return { userId: session?.userId ?? null, username: session?.username ?? null };
}
