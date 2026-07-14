// 视频工作台入口：Cookie 登录态（/studio 直接访问出密码框），?key= 老方式仍兼容

import { cookies } from "next/headers";
import Workbench from "./workbench";
import LoginForm from "./login-form";
import { AUTH_COOKIE, verifyToken } from "@/lib/studio/auth";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; date?: string }>;
}) {
  const { key, date } = await searchParams;
  const cookieStore = await cookies();
  const authed =
    verifyToken(cookieStore.get(AUTH_COOKIE)?.value) ||
    (!!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY);

  if (!authed) return <LoginForm />;
  // 登录态下把 ADMIN_KEY 交给客户端组件调后端 API（仅本人可见）
  return <Workbench adminKey={process.env.ADMIN_KEY!} initialDate={date} />;
}
