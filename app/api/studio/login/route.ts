// 工作台登录：密码换 30 天 httpOnly Cookie

import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken, verifyPassword } from "@/lib/studio/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };
  if (!verifyPassword(password ?? "")) {
    return NextResponse.json({ error: "密码不对" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 3600,
    path: "/",
  });
  return res;
}
