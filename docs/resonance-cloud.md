# 共鸣云同步：Cloudflare Pages + D1

共鸣云同步继续运行在本项目的 Cloudflare Pages Functions 中，入口为 `/api/resonance/cloud`。无需迁移到独立 Worker。点赞使用 `DB`，共鸣使用独立绑定 `RESONANCE_DB`；不要将共鸣迁移应用到点赞数据库。

## 创建和绑定

1. 在 Cloudflare 控制台创建 D1 数据库 `wxnn-resonance`，或运行 `npx wrangler d1 create wxnn-resonance`。
2. 本项目已根据创建结果在根目录 `wrangler.toml` 填入真实 UUID 并启用绑定。以下为配置模板，其他部署应换成自己的数据库 UUID：

```toml
[[d1_databases]]
binding = "RESONANCE_DB"
database_name = "wxnn-resonance"
database_id = "实际数据库 UUID"
migrations_dir = "migrations-resonance"
```

3. 确认数据库名称后，将迁移应用到真实云端 D1：

```powershell
npx wrangler d1 migrations apply wxnn-resonance --remote
```

4. 按现有流程构建并重新部署 Pages。若使用控制台管理绑定，在 Pages 项目的设置 → 绑定中将 `RESONANCE_DB` 关联到共鸣数据库；保持控制台与已提交 Wrangler 配置一致。
5. Preview 环境使用另一个测试数据库并单独应用迁移，不能指向生产共鸣数据库。生产部署后验证注册、刷新登录、上传、下载、删除和退出。

当前数据库已由维护者创建，仓库已配置其真实 UUID；远程迁移和 Pages 部署仍需执行。未生效的绑定会使 API 返回 `503 / NOT_CONFIGURED`，本地共鸣功能继续可用。

## 本地验证

本地开发与点赞使用相同的远程方式：`npm run dev:remote` 将共鸣 API 代理到已部署的 Pages，由 Pages Functions 访问真实云端 D1，不使用电脑上的模拟 D1。先完成上述云端绑定、迁移和部署，再在 `.env.remote.local` 配置：

```dotenv
REMOTE_API_ORIGIN=https://你的站点.pages.dev
```

然后运行 `npm run dev:remote`。本地网页 → Vite 代理 → 线上 Pages Functions → `RESONANCE_DB`。本地操作会修改该站点的真实云端存档；本地与线上登录 Cookie 各自独立，使用相同账号即可访问同一份存档。本地代理只转换本站 Origin，并为 HTTP 开发页面适配共鸣 Cookie，线上 HttpOnly、SameSite、Secure 和来源校验保持原样。

浏览器内的共鸣记录仍保存在 IndexedDB，点击上传或下载才完整覆盖目标。普通 `npm run dev` 不启用远程 API；`dev:pages` 默认属于本地模拟模式，不是这里的云端联调入口。后端代码修改需要重新部署目标 Pages 才会生效。

```powershell
npx vitest run tests/resonanceCloud.test.ts tests/components/ResonanceCloudActions.test.ts tests/utils/resonanceStorage.test.ts
npx vue-tsc --noEmit
npx wrangler pages functions build --outdir .wrangler-functions-build
```

接口集成测试使用安装的 Miniflare/workerd 和实际本地 D1 引擎，使用独立临时数据库，不接触生产数据。

## 密码与 Pages Functions 计算额度

- 用户名为 4～32 位 ASCII 字母、数字、下划线，去除首尾空格后转为小写；密码按 Unicode 字符计数为 6～128 位，不裁剪空格。
- 密码使用 Argon2id：19 MiB 内存、2 次迭代、并行度 1、16 字节随机盐、32 字节输出。数据库保存算法版本、盐及哈希。原始密码、会话令牌不写日志或本地存储。
- 该实现使用现有 `@noble/hashes`，不增加密码依赖。密码哈希属于 CPU 密集操作；**D1 免费存储额度不等于 Pages Functions 的免费计算额度**。Workers Free 的 10 ms CPU 限额不能作为本实现可用的部署保证；生产使用应准备 Workers Paid 计算额度，并在实际 Pages 环境测量注册、登录和密码确认删除的 CPU。不要通过降低哈希强度规避限额。
- 本地 workerd 测试验证 API/算法可运行，不代表模拟了生产 CPU 计费限制。
- 会话是 32 字节随机令牌，D1 仅保存 SHA-256 摘要。Cookie 使用 HttpOnly、SameSite=Strict，HTTPS 时使用 Secure；会话无服务端固定到期日，浏览器 Cookie 设置 400 天并在恢复会话时续期。浏览器仍可能主动清理凭据，不能承诺绝对永久登录。
- 退出撤销当前设备会话；其他设备不退出。第一版无密码修改、找回和邮箱绑定。用户应自行保存密码。
- 注册/登录按 IP 每 15 分钟最多 30 次、按账号最多 10 次；同步按账号最多 60 次；删除密码校验额外最多 10 次。跨源写请求被拒绝；所有写请求要求 JSON 和自定义请求头。

## 存档与覆盖协议

每个账号一份当前存档。`cloud_users.active_snapshot` 指向当前版本；`cloud_records` 一行保存一条 `bannerId:outfitId` 的完整 JSON。

上传不是增量合并：验证完整数据 → 创建暂存版本 → 分段写入所有行 → 比较预览版本和会话 → 事务内切换指针并保存请求回执 → 清理旧版本记录。写入中断不影响当前存档。并发上传只允许一个预期版本提交成功，失败者必须重新预览。每段 SQL JSON 参数小于 300 KB，避免每条记录单独请求导致 D1 调用数超限。

下载在同一 D1 批事务内读取版本和全部记录；确认时重读并核对云端版本，再在同一个 IndexedDB 事务内比较本地预览快照并替换。两边任一发生变化时阻止旧预览覆盖。

空本地不能上传，云端无存档不能清空本地。删除云端要求重新输入当前密码，原子清空云端指针并清理旧版本数据，保留账号、会话和本地记录。上传/下载不受页面星级筛选影响。

写请求使用 UUID 和内容摘要作为幂等标识；请求结果不明时原窗口重试同一个 ID，服务端返回已有回执，不重复覆盖。关闭窗口或刷新后丢弃内存中的待重试请求，下一次操作先重新读取云端预览。回执保留 30 天，不保留旧存档内容；中断上传最多两个，在下次写操作中清理超过 24 小时的暂存数据。无后台定时清理，长期不活跃账号的暂存数据由管理员维护。

应用上限：2000 条记录、每条 UTF-8 JSON 64 KiB、完整记录数组 8 MiB。暂存期间需预留新旧两份记录空间；最终 D1 大小还包括索引、会话与回执。监控 `rows_read`、`rows_written`、存储大小与 Functions CPU，按实际流量评估套餐。

## API

所有操作使用同源 Cookie；除登录、注册、查询会话外，要求 `X-Resonance-Account` 与当前会话用户 ID 一致，防止其他标签页切换账号后误操作。

| 方法 | action | 作用 |
| --- | --- | --- |
| GET | session | 恢复登录，不读写本地记录 |
| POST | register / login | `{ username, password }`，建立会话 |
| POST | logout | `{}`，撤销当前会话 |
| GET | snapshot | 返回版本、更新时间和完整记录 |
| POST | upload | `{ requestId, revision, records }`，完整覆盖 |
| POST | delete | `{ requestId, revision, password }`，删除云端存档 |

官方参考：[Pages D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)、[Pages Functions 价格](https://developers.cloudflare.com/pages/functions/pricing/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)。
