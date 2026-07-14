import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leo 的 AI 日报",
  description: "每天三分钟，看懂 AI 圈新鲜事 · 自动采集、AI 撰写、邮件送达",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
