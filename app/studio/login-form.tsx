"use client";

// 工作台登录表单：输一次密码，Cookie 记 30 天

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clapperboard, Loader2, LockKeyhole } from "lucide-react";

export default function LoginForm() {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!pwd) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/studio/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-50/60 to-white px-4">
      <form
        onSubmit={login}
        className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <Clapperboard className="h-6 w-6 text-pink-600" />
          <h1 className="text-lg font-bold">日报视频工作台</h1>
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="访问密码"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={busy || !pwd}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            进入
          </Button>
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <p className="mt-4 text-xs text-neutral-400">登录一次记住 30 天</p>
      </form>
    </div>
  );
}
