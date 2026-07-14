// 视频工作台入口：ADMIN_KEY 门禁（与 /edit 一致，?key= 校验）

import Workbench from "./workbench";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; date?: string }>;
}) {
  const { key, date } = await searchParams;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        需要访问密钥：/studio?key=ADMIN_KEY
      </div>
    );
  }
  return <Workbench adminKey={key!} initialDate={date} />;
}
