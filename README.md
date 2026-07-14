# Leo 的 AI 日报

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs)
![Vercel](https://img.shields.io/badge/部署-Vercel-black?style=flat-square&logo=vercel)
![DeepSeek](https://img.shields.io/badge/引擎-DeepSeek-4D6BFE?style=flat-square)
![站点状态](https://img.shields.io/website?url=https%3A%2F%2Fdaily.saveme505.help&style=flat-square&label=daily.saveme505.help)

每天三分钟，看懂 AI 圈新鲜事。全自动流水线：**采集信源 → DeepSeek 撰写 → 网页归档 → 邮件送达**。

灵感来自老卫（@imwsl90）的「AI 玩耍群日报」，逆向其形式后用自己的技术栈重建。

- 线上地址：<https://daily.saveme505.help>
- 每天北京时间 **09:30**（Vercel Cron `30 1 * * *` UTC）自动生成并发邮件

## 工作流（v2：两段式生成 + 人工审核）

```
Vercel Cron（每日 09:30 北京时间）
   │
   ▼
/api/cron/daily（Bearer CRON_SECRET 鉴权，幂等：当天已有则跳过）
   │
   ├─ 1. 采集信源（lib/sources.ts）
   │      · 官方一手 RSS：OpenAI / Google AI / Google DeepMind
   │      · 科技媒体 RSS：TechCrunch AI / The Verge AI / VentureBeat AI /
   │        9to5Mac(AI过滤) / Ars Technica(AI过滤) / Simon Willison
   │      · Hacker News Algolia API（近 24h 高分 AI 帖）
   │
   ├─ 2. 两段式生成（lib/generate.ts）
   │      ① 选题：DeepSeek 从候选里挑 4-5 条 + 切入角度
   │      ② 深挖：逐条抓原文全文 → 写正文（数字/对比表/清单）+ 怎么玩 + 点评草稿
   │      ③ 收尾：汇总今日要点与小结；链接只允许取自素材
   │
   ├─ 3. 存储（lib/store.ts）
   │      Vercel Blob：reports/YYYY-MM-DD.json，status=draft
   │
   └─ 4. 草稿邮件（lib/email.ts）
          全文 + 「改点评并定稿」按钮 → /edit/[date]?key=ADMIN_KEY

人工环节：/edit/[date] 逐条改 Leo 点评和小结 → 「定稿并发送邮件」
          → status=final + Resend 正式日报邮件
```

## 页面

| 路由 | 说明 |
| --- | --- |
| `/` | 日报归档列表 |
| `/r/[date]` | 单日日报（仿长图排版；右下角「📷 导出长图」一键出 2x PNG 可发群） |
| `/edit/[date]?key=…` | 人工审核页：改点评/小结，保存草稿或定稿发信 |
| `/api/cron/daily` | 生成入口，`?date=YYYY-MM-DD&force=1` 可重跑指定日期 |
| `/api/report/update` | 审核写回（save / finalize） |

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入密钥
npm run gen                  # 本地试跑：采集+生成，落盘 tmp/（不发邮件）
npm run dev                  # 本地预览（读线上 Blob 需 BLOB_READ_WRITE_TOKEN）
```

## 环境变量

见 `.env.example`：`DEEPSEEK_API_KEY` / `LLM_MODEL` / `RESEND_API_KEY` / `MAIL_TO` / `CRON_SECRET` / `ADMIN_KEY`（审核页鉴权）/ `BLOB_READ_WRITE_TOKEN`（连接 Blob store 后 Vercel 自动注入）/ `SITE_URL`。

## 手动补一期

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://daily.saveme505.help/api/cron/daily?date=2026-07-14&force=1"
```
