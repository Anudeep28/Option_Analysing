import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    userId: session?.userId ?? null,
    username: session?.username ?? null,
  });
}
