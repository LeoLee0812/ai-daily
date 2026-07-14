"use client";

// 视频工作台：素材勾选 → 口播稿（可编辑）→ 语音合成 → 视频成片
// 流程逆向自橘鸦 AI 早报：人工选材把关，AI 写稿，TTS 定时间轴，卡片+ffmpeg 出片

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clapperboard,
  FileText,
  ListChecks,
  Loader2,
  Mic,
  RefreshCw,
  Download,
  ExternalLink,
} from "lucide-react";
import type { StudioMaterial, VideoJob, VideoScript } from "@/lib/studio/types";

type Busy = null | "materials" | "script" | "save" | "tts" | "render";

function beijingToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Workbench({
  adminKey,
  initialDate,
}: {
  adminKey: string;
  initialDate?: string;
}) {
  const [date, setDate] = useState(initialDate || beijingToday());
  const [tab, setTab] = useState("materials");
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState("");

  const [materials, setMaterials] = useState<StudioMaterial[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<VideoJob | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, init);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      return j;
    },
    [],
  );

  // 拉素材
  const loadMaterials = useCallback(async () => {
    setBusy("materials");
    setMsg("");
    try {
      const j = await api(`/api/studio/candidates?key=${adminKey}&date=${date}`);
      setMaterials(j.materials);
      setChecked(new Set());
    } catch (e) {
      setMsg(`素材拉取失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }, [api, adminKey, date]);

  // 拉已有任务
  const loadJob = useCallback(async () => {
    try {
      const j = await api(`/api/studio/job?key=${adminKey}&date=${date}`);
      setJob(j.job);
      if (j.job) setTab(j.job.status === "done" ? "video" : "script");
    } catch {
      /* 没有任务是正常情况 */
    }
  }, [api, adminKey, date]);

  useEffect(() => {
    loadJob();
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // 生成口播稿
  async function generateScript() {
    const picked = materials.filter((m) => checked.has(m.id));
    if (!picked.length) {
      setMsg("先勾选素材");
      return;
    }
    setBusy("script");
    setMsg("DeepSeek 正在写口播稿，约 1-2 分钟…");
    try {
      const j = await api("/api/studio/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, date, materials: picked }),
      });
      setJob(j.job);
      setTab("script");
      setMsg("口播稿已生成，可以逐段修改");
      setPreviewNonce((n) => n + 1);
    } catch (e) {
      setMsg(`生成失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  // 保存改稿
  async function saveScript(script: VideoScript) {
    setBusy("save");
    setMsg("");
    try {
      const j = await api("/api/studio/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, date, script }),
      });
      setJob(j.job);
      setMsg("已保存（语音/成片已作废，需重新合成）");
      setPreviewNonce((n) => n + 1);
    } catch (e) {
      setMsg(`保存失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  // 合成语音
  async function runTts() {
    setBusy("tts");
    setMsg("逐句合成语音中（火山引擎），视稿件长度约 1-3 分钟…");
    try {
      const j = await api("/api/studio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, date }),
      });
      setJob(j.job);
      setTab("video");
      setMsg(`语音就绪，全片 ${fmtDur(j.job.timeline.totalDuration)}`);
    } catch (e) {
      setMsg(`语音合成失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  // 合成视频
  async function runRender() {
    setBusy("render");
    setMsg("视频合成中（卡片渲染 + ffmpeg），约 2-5 分钟，请勿关闭页面…");
    try {
      const j = await api("/api/studio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, date }),
      });
      setJob(j.job);
      setMsg("成片已就绪 🎉");
    } catch (e) {
      setMsg(`合成失败：${e instanceof Error ? e.message : e}`);
      loadJob();
    } finally {
      setBusy(null);
    }
  }

  const statusBadge = useMemo(() => {
    if (!job) return <Badge variant="outline">未创建</Badge>;
    const map: Record<string, [string, string]> = {
      script: ["文稿就绪", "bg-blue-100 text-blue-700"],
      audio: ["语音就绪", "bg-amber-100 text-amber-700"],
      rendering: ["合成中", "bg-purple-100 text-purple-700"],
      done: ["成片就绪", "bg-green-100 text-green-700"],
      error: ["出错", "bg-red-100 text-red-700"],
    };
    const [label, cls] = map[job.status] ?? ["未知", ""];
    return <Badge className={cls}>{label}</Badge>;
  }, [job]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Clapperboard className="h-7 w-7 text-pink-600" />
        <h1 className="text-2xl font-bold">日报视频工作台</h1>
        {statusBadge}
        <div className="ml-auto flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
          {msg}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="materials">
            <ListChecks className="mr-1.5 h-4 w-4" />
            1. 选素材
          </TabsTrigger>
          <TabsTrigger value="script" disabled={!job}>
            <FileText className="mr-1.5 h-4 w-4" />
            2. 口播稿
          </TabsTrigger>
          <TabsTrigger value="video" disabled={!job}>
            <Mic className="mr-1.5 h-4 w-4" />
            3. 语音与成片
          </TabsTrigger>
        </TabsList>

        {/* ---------- 1. 素材 ---------- */}
        <TabsContent value="materials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                候选素材（已选 {checked.size}，最多 10 条）
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadMaterials} disabled={!!busy}>
                  {busy === "materials" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  刷新
                </Button>
                <Button size="sm" onClick={generateScript} disabled={!!busy || !checked.size}>
                  {busy === "script" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  生成口播稿 →
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {busy === "materials" && !materials.length ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !materials.length ? (
                <p className="py-8 text-center text-sm text-neutral-400">
                  没有素材。当日日报未生成时只有实时信源候选。
                </p>
              ) : (
                materials.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-neutral-50 has-[[data-state=checked]]:border-pink-400 has-[[data-state=checked]]:bg-pink-50/50"
                  >
                    <Checkbox
                      checked={checked.has(m.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(checked);
                        if (v) {
                          if (next.size >= 10) return;
                          next.add(m.id);
                        } else next.delete(m.id);
                        setChecked(next);
                      }}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{m.title}</span>
                        <Badge
                          variant={m.kind === "report" ? "default" : "secondary"}
                          className="shrink-0 text-[10px]"
                        >
                          {m.kind === "report" ? "日报条目" : m.source}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{m.summary}</p>
                    </div>
                  </label>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- 2. 口播稿 ---------- */}
        <TabsContent value="script">
          {job && (
            <ScriptEditor
              job={job}
              adminKey={adminKey}
              previewNonce={previewNonce}
              busy={busy}
              onSave={saveScript}
              onTts={runTts}
            />
          )}
        </TabsContent>

        {/* ---------- 3. 语音与成片 ---------- */}
        <TabsContent value="video">
          {job && (
            <div className="space-y-4">
              {job.timeline ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      时间轴 · 全片 {fmtDur(job.timeline.totalDuration)} ·{" "}
                      {job.timeline.sentences.length} 句 · 音色 {job.timeline.voiceType}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {job.timeline.segments.map((seg, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-14 shrink-0 font-mono text-xs text-neutral-400">
                            {fmtDur(seg.start)}
                          </span>
                          <div
                            className="h-2 rounded-full bg-pink-400/70"
                            style={{
                              width: `${Math.max(2, ((seg.end - seg.start) / job.timeline!.totalDuration) * 100)}%`,
                            }}
                          />
                          <span className="truncate text-neutral-600">{seg.title}</span>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-4" />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={runRender} disabled={!!busy}>
                        {busy === "render" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                        {job.videoUrl ? "重新合成视频" : "合成视频"}
                      </Button>
                      {job.srtUrl && (
                        <Button variant="outline" render={<a href={job.srtUrl} download />}>
                          <Download className="mr-1 h-4 w-4" />
                          SRT 字幕
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-neutral-400">
                    还没有语音。回到「口播稿」页点「合成语音」。
                  </CardContent>
                </Card>
              )}

              {job.videoUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">成片预览</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <video src={job.videoUrl} controls className="w-full rounded-lg border" />
                    <div className="flex gap-2">
                      <Button render={<a href={job.videoUrl} download={`ai-daily-${job.date}.mp4`} />}>
                        <Download className="mr-1 h-4 w-4" />
                        下载 MP4
                      </Button>
                      <Button variant="outline" render={<a href={job.videoUrl} target="_blank" rel="noopener" />}>
                        <ExternalLink className="mr-1 h-4 w-4" />
                        新窗口打开
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- 口播稿编辑器 ----------

function ScriptEditor({
  job,
  adminKey,
  previewNonce,
  busy,
  onSave,
  onTts,
}: {
  job: VideoJob;
  adminKey: string;
  previewNonce: number;
  busy: Busy;
  onSave: (s: VideoScript) => void;
  onTts: () => void;
}) {
  const [script, setScript] = useState<VideoScript>(job.script);
  useEffect(() => setScript(job.script), [job.script]);

  const setEvent = (i: number, patch: Partial<VideoScript["events"][number]>) =>
    setScript({
      ...script,
      events: script.events.map((ev, j) => (j === i ? { ...ev, ...patch } : ev)),
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">开场白</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={script.intro}
            onChange={(e) => setScript({ ...script, intro: e.target.value })}
            rows={2}
          />
        </CardContent>
      </Card>

      {script.events.map((ev, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline">{i + 1}</Badge>
              <Input
                value={ev.title}
                onChange={(e) => setEvent(i, { title: e.target.value })}
                className="h-8 max-w-72 text-sm font-semibold"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-neutral-500">口播正文（TTS 朗读）</p>
              <Textarea
                value={ev.narration}
                onChange={(e) => setEvent(i, { narration: e.target.value })}
                rows={7}
              />
              <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-500">卡片大标题</p>
              <Input
                value={ev.card.title}
                onChange={(e) => setEvent(i, { card: { ...ev.card, title: e.target.value } })}
              />
              <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-500">
                卡片要点（**词** 高亮）
              </p>
              <div className="space-y-1.5">
                {ev.card.points.map((p, k) => (
                  <div key={k} className="flex gap-1.5">
                    <Input
                      value={p.heading}
                      onChange={(e) =>
                        setEvent(i, {
                          card: {
                            ...ev.card,
                            points: ev.card.points.map((pp, kk) =>
                              kk === k ? { ...pp, heading: e.target.value } : pp,
                            ),
                          },
                        })
                      }
                      className="h-8 w-28 shrink-0 text-xs"
                    />
                    <Input
                      value={p.text}
                      onChange={(e) =>
                        setEvent(i, {
                          card: {
                            ...ev.card,
                            points: ev.card.points.map((pp, kk) =>
                              kk === k ? { ...pp, text: e.target.value } : pp,
                            ),
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-neutral-500">
                画面预览（保存后刷新）
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/studio/preview?key=${adminKey}&date=${job.date}&seg=${i}&v=${previewNonce}`}
                alt={`事件 ${i + 1} 卡片预览`}
                className="w-full rounded-lg border shadow-sm"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">结束语</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={script.outro}
            onChange={(e) => setScript({ ...script, outro: e.target.value })}
            rows={2}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex gap-2 rounded-xl border bg-white/90 p-3 shadow-lg backdrop-blur">
        <Button variant="outline" onClick={() => onSave(script)} disabled={!!busy}>
          {busy === "save" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          保存文稿
        </Button>
        <Button onClick={onTts} disabled={!!busy}>
          {busy === "tts" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          <Mic className="mr-1 h-4 w-4" />
          合成语音 →
        </Button>
        <span className="self-center text-xs text-neutral-400">
          改稿后请先保存再合成；合成语音会重置旧成片
        </span>
      </div>
    </div>
  );
}
