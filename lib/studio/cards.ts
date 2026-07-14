// 画面卡片渲染：satori（flexbox → SVG）+ resvg（SVG → PNG），纯 Node 无需浏览器
// 版式逆向自橘鸦 AI 早报视频卡片：米杏底 + 玫红大标题 + 白底黑框圆角要点卡片墙

import { readFileSync } from "fs";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { VideoScript, EventCard } from "./types";

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

// 配色（取自 img20 卡片样例）
const BG = "#F7F3EC";
const TITLE_PINK = "#E0537A";
const INK = "#1A1A1A";
const HIGHLIGHT_BG = "#EEE8DD";
const DOT_COLORS = [
  "#4A90D9", "#4CAF7D", "#E8A33D", "#7B68C9",
  "#E0537A", "#4A4A4A", "#2FA8A0", "#5B8DEF",
];

let fontsCache: Array<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }> | null =
  null;

function fonts() {
  if (!fontsCache) {
    const dir = path.join(process.cwd(), "assets", "fonts");
    fontsCache = [
      { name: "Noto", data: readFileSync(path.join(dir, "NotoSansSC-Regular.otf")), weight: 400, style: "normal" },
      { name: "Noto", data: readFileSync(path.join(dir, "NotoSansSC-Bold.otf")), weight: 700, style: "normal" },
    ];
  }
  return fontsCache;
}

// satori 不用 JSX，直接写元素对象
type El = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): El => ({
  type,
  props: { style, children },
});

/** 把 **关键词** 标记解析成高亮 span 序列 */
function richText(text: string, fontSize: number): El[] {
  const parts = text.split(/\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? h(
          "span",
          {
            backgroundColor: HIGHLIGHT_BG,
            borderRadius: 6,
            padding: "0px 8px",
            margin: "0px 2px",
            fontSize,
          },
          part,
        )
      : h("span", { fontSize }, part),
  );
}

async function renderToPng(root: El, w = CANVAS_W, h2 = CANVAS_H): Promise<Buffer> {
  const svg = await satori(root as never, { width: w, height: h2, fonts: fonts() as never });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
  return Buffer.from(png);
}

function pageShell(children: El[]): El {
  return h(
    "div",
    {
      width: CANVAS_W,
      height: CANVAS_H,
      display: "flex",
      flexDirection: "column",
      backgroundColor: BG,
      fontFamily: "Noto",
      color: INK,
      padding: "48px 64px",
    },
    children,
  );
}

/** 页眉：栏目名 + 日期 */
function header(date: string): El {
  return h(
    "div",
    { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" },
    [
      h("div", { display: "flex", fontSize: 30, fontWeight: 700, color: TITLE_PINK }, "Leo 的 AI 日报"),
      h("div", { display: "flex", fontSize: 28, color: "#8A8378" }, date),
    ],
  );
}

/** 事件卡片：标题 + 要点卡片墙 */
export async function renderEventCard(date: string, card: EventCard): Promise<Buffer> {
  const points = card.points.slice(0, 8);
  const cols = Math.ceil(points.length / 2);
  const gap = 28;
  const cardW = Math.floor((CANVAS_W - 128 - gap * (cols - 1)) / cols);

  const pointEls = points.map((p, i) =>
    h(
      "div",
      {
        width: cardW,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        border: `3px solid ${INK}`,
        borderRadius: 18,
        padding: "26px 28px",
      },
      [
        h("div", { display: "flex", alignItems: "center", marginBottom: 14 }, [
          h("div", {
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: DOT_COLORS[i % DOT_COLORS.length],
            marginRight: 14,
            display: "flex",
          }),
          h("div", { display: "flex", fontSize: 30, fontWeight: 700 }, p.heading),
        ]),
        h("div", { width: "100%", height: 2, backgroundColor: "#E5DFD3", marginBottom: 14, display: "flex" }),
        h(
          "div",
          { display: "flex", flexWrap: "wrap", fontSize: 24, lineHeight: 1.55, color: "#33302B" },
          richText(p.text, 24),
        ),
      ],
    ),
  );

  const root = pageShell([
    header(date),
    h(
      "div",
      {
        display: "flex",
        fontSize: 60,
        fontWeight: 700,
        color: TITLE_PINK,
        justifyContent: "center",
        width: "100%",
        margin: "36px 0 44px",
        textAlign: "center",
      },
      card.title,
    ),
    h(
      "div",
      {
        display: "flex",
        flexWrap: "wrap",
        gap,
        justifyContent: "center",
        alignContent: "center",
        flexGrow: 1,
        width: "100%",
      },
      pointEls,
    ),
  ]);
  return renderToPng(root);
}

/** 片头卡片：品牌 + 日期 + 今日目录 */
export async function renderIntroCard(date: string, script: VideoScript): Promise<Buffer> {
  const weekday = "日一二三四五六"[new Date(`${date}T00:00:00+08:00`).getDay()];
  const items = script.events.map((ev, i) =>
    h("div", { display: "flex", alignItems: "center", fontSize: 34, margin: "10px 0" }, [
      h(
        "div",
        {
          display: "flex",
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: TITLE_PINK,
          color: "#fff",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 700,
          marginRight: 20,
        },
        String(i + 1),
      ),
      h("div", { display: "flex" }, ev.title),
    ]),
  );
  const root = pageShell([
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        width: "100%",
      },
      [
        h("div", { display: "flex", fontSize: 88, fontWeight: 700, color: TITLE_PINK, marginBottom: 8 }, "Leo 的 AI 日报"),
        h("div", { display: "flex", fontSize: 40, color: "#8A8378", marginBottom: 48 }, `${date} 星期${weekday}`),
        h(
          "div",
          {
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#FFFFFF",
            border: `3px solid ${INK}`,
            borderRadius: 20,
            padding: "36px 56px",
          },
          items,
        ),
      ],
    ),
  ]);
  return renderToPng(root);
}

/** 片尾卡片 */
export async function renderOutroCard(date: string): Promise<Buffer> {
  const root = pageShell([
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        width: "100%",
      },
      [
        h("div", { display: "flex", fontSize: 76, fontWeight: 700, color: TITLE_PINK, marginBottom: 24 }, "感谢收看"),
        h("div", { display: "flex", fontSize: 36, color: "#33302B", marginBottom: 12 }, "Leo 的 AI 日报 · 每天三分钟，看懂 AI 圈新鲜事"),
        h("div", { display: "flex", fontSize: 30, color: "#8A8378" }, `daily.saveme505.help · ${date}`),
      ],
    ),
  ]);
  return renderToPng(root);
}

/** 字幕条：透明背景 PNG，合成时贴在画面底部 */
export async function renderSubtitleStrip(text: string): Promise<Buffer> {
  const stripH = 150;
  const root = h(
    "div",
    {
      width: CANVAS_W,
      height: stripH,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Noto",
    },
    [
      h(
        "div",
        {
          display: "flex",
          backgroundColor: "rgba(20,18,14,0.72)",
          color: "#FFFFFF",
          fontSize: 36,
          padding: "14px 44px",
          borderRadius: 14,
          maxWidth: 1700,
        },
        text,
      ),
    ],
  );
  return renderToPng(root, CANVAS_W, stripH);
}
