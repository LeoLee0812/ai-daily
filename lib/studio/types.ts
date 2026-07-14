// 视频工作台数据结构（存 Vercel Blob：videos/YYYY-MM-DD/job.json）
// 流水线状态机：script（文稿就绪）→ audio（语音+时间轴就绪）→ done（成片就绪）

// ---------- 卡片（画面） ----------

/** 卡片要点：一张事件卡里的一格 */
export interface CardPoint {
  /** 格子小标题，如 "模型发布" */
  heading: string;
  /** 说明文字，支持 **关键词** 高亮标记，30 字内 */
  text: string;
}

/** 事件卡片（NotebookLM 知识卡片墙风格，1920x1080） */
export interface EventCard {
  /** 卡片大标题（顶部居中玫红大字） */
  title: string;
  /** 4-8 个要点格子，2 行网格排布 */
  points: CardPoint[];
}

// ---------- 口播稿 ----------

/** 一个新闻事件段落 */
export interface ScriptEvent {
  /** 事件短标题（时间轴/目录用） */
  title: string;
  /** 该事件的口播正文（纯文本，TTS 朗读用） */
  narration: string;
  /** 画面卡片 */
  card: EventCard;
  /** 来源链接 */
  links: string[];
}

/** 完整口播稿 */
export interface VideoScript {
  /** 开场白（"各位观众早上好，今天是…"） */
  intro: string;
  /** 结束语 */
  outro: string;
  events: ScriptEvent[];
}

// ---------- 时间轴（TTS 之后） ----------

/** 单个 TTS 句子（最小合成单位） */
export interface TtsSentence {
  /** 归属段落：-1=intro，-2=outro，>=0 为 events 下标 */
  segIndex: number;
  text: string;
  /** 起点（秒，全片时间轴） */
  start: number;
  /** 终点（秒） */
  end: number;
  /** 该句音频在 Blob 的地址 */
  audioUrl: string;
}

export interface VideoTimeline {
  voiceType: string;
  sentences: TtsSentence[];
  /** 每个事件的起止（含 intro/outro，按画面切换用） */
  segments: Array<{ segIndex: number; title: string; start: number; end: number }>;
  /** 全片总时长（秒） */
  totalDuration: number;
  /** SRT 字幕全文 */
  srt: string;
}

// ---------- 任务 ----------

export type VideoJobStatus =
  | "script" // 文稿已生成，可编辑
  | "audio" // 语音合成完毕，时间轴就绪
  | "rendering" // 视频合成中
  | "done" // 成片就绪
  | "error";

export interface VideoJob {
  date: string; // YYYY-MM-DD
  status: VideoJobStatus;
  script: VideoScript;
  /** 生成文稿时勾选的素材标题（追溯用） */
  sourceTitles: string[];
  timeline?: VideoTimeline;
  /** 成片 Blob 地址 */
  videoUrl?: string;
  /** SRT 文件 Blob 地址 */
  srtUrl?: string;
  error?: string;
  updatedAt: string;
}

// ---------- 工作台素材 ----------

/** 工作台候选素材：来自当日日报条目或实时信源 */
export interface StudioMaterial {
  id: string;
  title: string;
  summary: string;
  links: string[];
  source: string;
  /** report=当日日报条目（已深挖，质量高）；feed=实时信源候选 */
  kind: "report" | "feed";
}
