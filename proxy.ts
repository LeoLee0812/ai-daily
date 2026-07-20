// 全站访问门：除登录页/登录接口/静态资源外，一律要求有效会话 Cookie，否则跳 /login。
// 安全底线：未配置 HUB_AUTH_SECRET / HUB_SITE_PASSWORD 时视为未解锁，全部拦下——绝不裸奔。

import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifyToken } from "./lib/hub-auth";

export async function proxy(req: NextRequest) {
  const secret = process.env.HUB_AUTH_SECRET;
  const password = process.env.HUB_SITE_PASSWORD;

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const authed =
    !!secret && !!password && (await verifyToken(secret, token, Date.now()));

  if (authed) return NextResponse.next();

  const url = req.nextUrl.clone();
  const nextPath = url.pathname + url.search;
  url.pathname = "/login";
  url.search = "";
  if (nextPath && nextPath !== "/login") url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
