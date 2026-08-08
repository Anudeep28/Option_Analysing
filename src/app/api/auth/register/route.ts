import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createUser, getUserByUsername } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.trim().length < 3 ||
      password.length < 6
    ) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters and password at least 6 characters." },
        { status: 400 },
      );
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existing = await getUserByUsername(normalizedUsername);
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const id = randomUUID();
    const passwordHash = hashPassword(password);
    await createUser(id, normalizedUsername, passwordHash);

    const token = await createSessionToken({ userId: id, username: normalizedUsername });
    const response = NextResponse.json({ userId: id, username: normalizedUsername }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    console.error("POST /api/auth/register error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
