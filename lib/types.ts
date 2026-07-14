// 日报数据结构（存 Vercel Blob 的 JSON 即此结构）

export interface DailyItem {
  rank: number;
  /** 条目标题，如 "iOS 27 公测版到了：Siri 终于脱胎换骨" */
  title: string;
  /** 正文若干段，markdown（支持 **加粗**、- 列表、| 表格 |、[链接](url)） */
  body: string;
  /** "怎么玩" 可操作步骤，可为空数组 */
  howTo: string[];
  /** 原文/参考链接 */
  links: string[];
  /** Leo 点评（一两句个人视角，人工审核环节可改） */
  comment: string;
}

export type ReportStatus = "draft" | "final";

export interface DailyReport {
  /** YYYY-MM-DD */
  date: string;
  /** 草稿（待人工审点评）或定稿 */
  status: ReportStatus;
  /** 📌 今日要点，一行一条 */
  highlights: string[];
  items: DailyItem[];
  /** 今日小结 */
  summary: string;
  /** 生成时间 ISO */
  generatedAt: string;
  /** 定稿时间 ISO */
  finalizedAt?: string;
  /** 本次候选素材数量（观测用） */
  candidateCount: number;
}

export interface Candidate {
  title: string;
  summary?: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  from: "rss" | "hn";
}
