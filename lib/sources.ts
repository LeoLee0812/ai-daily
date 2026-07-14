// 信源采集：aihot 精选流（中文 AI 热点聚合）+ Hacker News（Algolia 公开 API）
// aihot 限流契约与 media-studio 保持一致：串行 ≥1.1s、自报 UA、429 退避、不爬 HTML

import type { Candidate } from "./types";

const AIHOT_BASE = "https://aihot.virxact.com";
const AIHOT_UA = "ai-daily-sync/1.0 (+mailto:1656839861un@gmail.com)";
const MIN_INTERVAL_MS = 1150;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function politeGet(path: string): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${AIHOT_BASE}${path}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    const res = await fetch(url, {
      headers: { "User-Agent": AIHOT_UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 429) {
      await sleep(30000 + (attempt + 1) * 12000);
      continue;
    }
    if (!res.ok) throw new Error(`aihot 请求失败 ${res.status} ${url}`);
    return res.json();
  }
  throw new Error(`aihot 多次 429，放弃 ${url}`);
}

interface AihotItem {
  title: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
}

// 拉取 aihot 精选流最近条目（最多 2 页，防止 cron 超时）
export async function fetchAihot(sinceIso: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 2; page++) {
    const params = new URLSearchParams({ mode: "selected", since: sinceIso });
    if (cursor) params.set("cursor", cursor);
    const j = (await politeGet(`/api/public/items?${params}`)) as {
      items?: AihotItem[];
      data?: AihotItem[];
      nextCursor?: string | null;
      hasNext?: boolean;
    };
    const batch = j.items ?? j.data ?? [];
    for (const it of batch) {
      out.push({
        title: it.title,
        summary: it.summary,
        url: it.url,
        source: it.source,
        publishedAt: it.publishedAt,
        from: "aihot",
      });
    }
    cursor = j.nextCursor ?? undefined;
    if (j.hasNext === false || !cursor || batch.length === 0) break;
  }
  return out;
}

// Hacker News：Algolia 公开搜索 API，取近 24h 高分 AI 相关帖
export async function fetchHackerNews(sinceEpoch: number): Promise<Candidate[]> {
  const query =
    "AI OR LLM OR GPT OR Claude OR Gemini OR OpenAI OR Anthropic OR agent";
  const url =
    `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=30` +
    `&numericFilters=created_at_i>${sinceEpoch},points>80` +
    `&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as {
    hits: Array<{
      title: string;
      url?: string;
      points: number;
      objectID: string;
      created_at: string;
    }>;
  };
  return j.hits.map((h) => ({
    title: h.title,
    summary: `HN ${h.points} 分`,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: "Hacker News",
    publishedAt: h.created_at,
    from: "hn" as const,
  }));
}

// 汇总候选素材（任一信源失败不阻塞整体）
export async function collectCandidates(): Promise<Candidate[]> {
  const since = new Date(Date.now() - 26 * 3600 * 1000);
  const [aihot, hn] = await Promise.allSettled([
    fetchAihot(since.toISOString()),
    fetchHackerNews(Math.floor(since.getTime() / 1000)),
  ]);
  const out: Candidate[] = [];
  if (aihot.status === "fulfilled") out.push(...aihot.value);
  if (hn.status === "fulfilled") out.push(...hn.value);
  // 标题去重
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.title.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
