import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const user = await getUserByUsername(username.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await createSessionToken({ userId: user.id, username: user.username });
    const response = NextResponse.json({ userId: user.id, username: user.username });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    console.error("POST /api/auth/login error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
