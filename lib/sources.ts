// 信源采集 v2：官方博客/科技媒体 RSS + Hacker News，不再使用 aihot
// 设计：模仿老卫日报的信源结构——一手官方公告 + 主流科技媒体 + 开发者社区热帖

import type { Candidate } from "./types";

// ---------- RSS ----------

interface Feed {
  name: string;
  url: string;
  /** 是否只保留 AI 相关条目（综合媒体需要过滤，垂直源不用） */
  aiFilter: boolean;
  /** release 监控源：标题补产品名前缀、每源最多 5 条 */
  release?: boolean;
}

const FEEDS: Feed[] = [
  // 一手官方
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", aiFilter: false },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/", aiFilter: false },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", aiFilter: false },
  // 科技媒体
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", aiFilter: false },
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", aiFilter: false },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", aiFilter: false },
  { name: "9to5Mac", url: "https://9to5mac.com/feed/", aiFilter: true },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", aiFilter: true },
  // 独立观察者（AI 工具实操视角，和日报「怎么玩」气质接近）
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", aiFilter: false },
  // release 监控：主流 AI 编程工具的版本发布（学 releasebot 的思路，直接盯一手 feed）
  { name: "Claude Code", url: "https://github.com/anthropics/claude-code/releases.atom", aiFilter: false, release: true },
  { name: "OpenAI Codex", url: "https://github.com/openai/codex/releases.atom", aiFilter: false, release: true },
  { name: "Gemini CLI", url: "https://github.com/google-gemini/gemini-cli/releases.atom", aiFilter: false, release: true },
  { name: "Ollama", url: "https://github.com/ollama/ollama/releases.atom", aiFilter: false, release: true },
  { name: "Cursor", url: "https://cursor.com/changelog.rss", aiFilter: false, release: true },
];

const AI_WORDS =
  /\b(AI|LLM|GPT|Claude|Gemini|Grok|Copilot|OpenAI|Anthropic|DeepSeek|Qwen|Kimi|Llama|Mistral|agent|chatbot|Siri|machine.learning|neural|diffusion|transformer)\b/i;

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? stripTags(m[1]) : "";
}

// 兼容 RSS 2.0 <item> 与 Atom <entry> 的极简解析
function parseFeed(xml: string, feed: Feed, sinceMs: number): Candidate[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const out: Candidate[] = [];
  for (const b of blocks) {
    const title = pick(b, "title");
    if (!title) continue;
    // 链接：RSS <link>text</link>；Atom <link href="..."/>
    let link = pick(b, "link");
    if (!link) {
      const m = b.match(/<link[^>]*href="([^"]+)"[^>]*\/?>(?![\s\S]*rel="replies")/i);
      link = m ? m[1] : "";
    }
    const dateStr =
      pick(b, "pubDate") || pick(b, "updated") || pick(b, "published") || pick(b, "dc:date");
    const ts = dateStr ? Date.parse(dateStr) : NaN;
    if (!Number.isNaN(ts) && ts < sinceMs) continue;
    const summary = (pick(b, "description") || pick(b, "summary") || pick(b, "content")).slice(0, 400);
    if (feed.aiFilter && !AI_WORDS.test(title + " " + summary)) continue;
    // release 源的标题常是裸版本号（如 v2.1.3），补上产品名
    const fullTitle =
      feed.release && !title.toLowerCase().includes(feed.name.toLowerCase())
        ? `${feed.name} 发布 ${title}`
        : title;
    out.push({
      title: fullTitle,
      summary: feed.release ? `版本更新。${summary}` : summary,
      url: link || undefined,
      source: feed.name,
      publishedAt: dateStr || undefined,
      from: "rss",
    });
  }
  return out.slice(0, feed.release ? 5 : 12); // 防单源刷屏
}

async function fetchFeed(feed: Feed, sinceMs: number): Promise<Candidate[]> {
  const res = await fetch(feed.url, {
    // 部分站点（blog.google 等）会拒绝非浏览器 UA
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ai-daily/1.0",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${feed.name} ${res.status}`);
  return parseFeed(await res.text(), feed, sinceMs);
}

// ---------- Hacker News ----------

export async function fetchHackerNews(sinceEpoch: number): Promise<Candidate[]> {
  const query =
    "AI OR LLM OR GPT OR Claude OR Gemini OR Grok OR OpenAI OR Anthropic OR agent";
  const url =
    `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=30` +
    `&numericFilters=created_at_i>${sinceEpoch},points>50` +
    `&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
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
    summary: `Hacker News ${h.points} 分热帖`,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: "Hacker News",
    publishedAt: h.created_at,
    from: "hn" as const,
  }));
}

// ---------- 汇总 ----------

// 全部信源并发拉取；任一失败不阻塞整体
export async function collectCandidates(): Promise<Candidate[]> {
  const since = Date.now() - 26 * 3600 * 1000;
  const results = await Promise.allSettled([
    ...FEEDS.map((f) => fetchFeed(f, since)),
    fetchHackerNews(Math.floor(since / 1000)),
  ]);
  const out: Candidate[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.push(...r.value);
    else failed.push(i < FEEDS.length ? FEEDS[i].name : "HN");
  });
  if (failed.length) console.warn("[ai-daily] 信源失败:", failed.join(", "));
  // 标题去重
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.title.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------- 原文抓取（第二段深挖用） ----------

// 抓取选中条目的原文正文（去标签纯文本，截断防超长）
export async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ai-daily/1.0",
        Accept: "text/html",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return "";
    const html = await res.text();
    // 去掉脚本/样式/导航后取正文文本
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    // 优先 <article>，否则全文
    const article = cleaned.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? cleaned;
    return stripTags(article).slice(0, 9000);
  } catch {
    return "";
  }
}
