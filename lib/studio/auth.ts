// 工作台登录态：密码校验 + httpOnly Cookie（30 天）
// 密码取 STUDIO_PASSWORD（好记的人话密码），未配置时退回 ADMIN_KEY

import { createHash } from "crypto";

export const AUTH_COOKIE = "studio_auth";

export function studioPassword(): string {
  return process.env.STUDIO_PASSWORD || process.env.ADMIN_KEY || "";
}

/** Cookie 里存的是密码派生哈希，不落明文 */
export function authToken(): string {
  return createHash("sha256")
    .update(`ai-daily-studio:${studioPassword()}:${process.env.ADMIN_KEY ?? ""}`)
    .digest("hex");
}

export function verifyPassword(input: string): boolean {
  const pwd = studioPassword();
  return !!pwd && input === pwd;
}

export function verifyToken(token: string | undefined): boolean {
  return !!token && token === authToken();
}
