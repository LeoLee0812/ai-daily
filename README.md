# Leo 的 AI 日报

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs)
![Vercel](https://img.shields.io/badge/部署-Vercel-black?style=flat-square&logo=vercel)
![DeepSeek](https://img.shields.io/badge/引擎-DeepSeek-4D6BFE?style=flat-square)
![站点状态](https://img.shields.io/website?url=https%3A%2F%2Fdaily.saveme505.help&style=flat-square&label=daily.saveme505.help)

每天三分钟，看懂 AI 圈新鲜事。全自动流水线：**采集信源 → DeepSeek 撰写 → 网页归档 → 邮件送达**。

灵感来自老卫（@imwsl90）的「AI 玩耍群日报」，逆向其形式后用自己的技术栈重建。

- 线上地址：<https://daily.saveme505.help>
- 每天北京时间 **09:30**（Vercel Cron `30 1 * * *` UTC）自动生成并发邮件

## 工作流

```
Vercel Cron（每日 09:30 北京时间）
   │
   ▼
/api/cron/daily（Bearer CRON_SECRET 鉴权，幂等：当天已有则跳过）
   │
   ├─ 1. 采集信源（lib/sources.ts）
   │      · aihot.virxact.com 精选流（中文 AI 热点聚合，守限流契约）
   │      · Hacker News Algolia API（近 24h 高分 AI 帖）
   │
   ├─ 2. 生成日报（lib/generate.ts）
   │      DeepSeek generateObject 结构化输出：
   │      今日要点 4-6 条 + 正文条目 4-5 个（正文/怎么玩/链接/Leo 点评）+ 今日小结
   │      链接只允许取自素材，不许编造
   │
   ├─ 3. 存储（lib/store.ts）
   │      Vercel Blob：reports/YYYY-MM-DD.json（固定路径、公开读、可覆盖）
   │
   └─ 4. 邮件（lib/email.ts）
          Resend 发内联样式 HTML 到收件人（claude@saveme505.help 发出）
```

## 页面

| 路由 | 说明 |
| --- | --- |
| `/` | 日报归档列表 |
| `/r/[date]` | 单日日报（仿长图排版：要点、条目、点评引用块、小结） |
| `/api/cron/daily` | 生成入口，`?date=YYYY-MM-DD&force=1` 可重跑指定日期 |

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入密钥
npm run gen                  # 本地试跑：采集+生成，落盘 tmp/（不发邮件）
npm run dev                  # 本地预览（读线上 Blob 需 BLOB_READ_WRITE_TOKEN）
```

## 环境变量

见 `.env.example`：`DEEPSEEK_API_KEY` / `LLM_MODEL` / `RESEND_API_KEY` / `MAIL_TO` / `CRON_SECRET` / `BLOB_READ_WRITE_TOKEN`（连接 Blob store 后 Vercel 自动注入）/ `SITE_URL`。

## 手动补一期

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://daily.saveme505.help/api/cron/daily?date=2026-07-14&force=1"
```
