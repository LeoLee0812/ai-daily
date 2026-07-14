// 首页：日报归档列表（shadcn 风格改版）

import Link from "next/link";
import { listReportDates } from "@/lib/store";
import { listJobDates } from "@/lib/studio/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clapperboard, Mail, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [dates, videoDates] = await Promise.all([
    listReportDates(),
    listJobDates().catch(() => [] as string[]),
  ]);
  const videoSet = new Set(videoDates);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/60 via-white to-white">
      <div className="mx-auto max-w-2xl px-4 py-14">
        <header className="mb-10">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-lg font-bold text-white">
              L
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
              Leo 的 AI 日报
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-neutral-500">
            每天三分钟，看懂 AI 圈新鲜事
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-500">
            <Badge variant="secondary" className="gap-1 font-normal">
              <Sparkles className="h-3 w-3" /> 自动采集信源，AI 撰写
            </Badge>
            <Badge variant="secondary" className="gap-1 font-normal">
              <Mail className="h-3 w-3" /> 每早 09:30 邮件送达
            </Badge>
            <Badge variant="secondary" className="gap-1 font-normal">
              <Clapperboard className="h-3 w-3" /> 视频版工作台生产
            </Badge>
          </div>
        </header>

        {dates.length === 0 ? (
          <p className="py-16 text-center text-sm text-neutral-400">
            还没有日报，明早见。
          </p>
        ) : (
          <div className="space-y-2.5">
            {dates.map((d) => (
              <Link key={d} href={`/r/${d}`} className="block">
                <Card className="group border-neutral-200 py-0 transition-all hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-md">
                  <CardContent className="flex items-center gap-3 px-5 py-4">
                    <CalendarDays className="h-4 w-4 shrink-0 text-neutral-400 group-hover:text-pink-500" />
                    <span className="text-[15px] font-medium text-neutral-800">
                      Leo 的 AI 日报 · {d.replaceAll("-", "")}
                    </span>
                    {videoSet.has(d) && (
                      <Badge className="ml-auto gap-1 bg-pink-100 text-pink-700 hover:bg-pink-100">
                        <Clapperboard className="h-3 w-3" /> 视频版
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <footer className="mt-14 border-t pt-6 text-center text-xs text-neutral-400">
          由 Leo 工具箱生成 · daily.saveme505.help ·{" "}
          <Link href="/studio" className="hover:text-pink-600">
            工作台
          </Link>
        </footer>
      </div>
    </div>
  );
}
