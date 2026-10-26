# 共鸣与衣橱云同步：Cloudflare Pages + D1

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

4. 本项目包含 `pages_build_output_dir`，采用 Wrangler 配置部署后，以 `wrangler.toml` 为绑定配置来源；Git 自动构建和 Wrangler 上传均可使用该配置。控制台中的对应字段可能只读。仍由控制台管理绑定的项目，可在 Pages 设置 → Bindings → Add → D1 database bindings 中关联 `RESONANCE_DB`，保存后重新部署。不要假定 Git 部署会忽略 Wrangler 配置。
5. Preview 环境使用另一个测试数据库并单独应用迁移，不能指向生产共鸣数据库。生产部署后验证注册、刷新登录、上传、下载、删除和退出。

根据维护者提供的执行结果，数据库创建、仓库绑定配置和首次云端迁移 `0001_cloud.sql` 已完成；线上 Pages 部署及接口验证状态需另行核实。其他部署请按自己的环境执行上述步骤。未生效的绑定会使 API 返回 `503 / NOT_CONFIGURED`，本地共鸣功能继续可用。

## 页面操作与备份

电脑端按钮在共鸣操作行展开，手机端通过“⋯”菜单使用。账号名／密码用于本站云同步，美鸭梨导入凭据用于获取游戏记录，两者互不替代。注册、登录不会自动上传或下载；本地导入、清空或修改也不会自动同步。登录、注册的成功和失败统一显示顶部提示，成功分别显示“登录成功”“注册成功”，失败保留表单输入。

一个账号各有一份共鸣和衣橱云端存档，两者独立操作。共鸣上传以全部本地记录完整覆盖云端，下载完整覆盖本地，先核对账号和数量再确认；不受筛选影响。共鸣本地记录为空时不能上传，云端无存档不能清空本地，版本冲突需重新预览。清空本地记录不删除云端；删除云端无需再次输入密码，保留账号、会话和本地数据。衣橱有效空存档的规则见下文。

全部数据 ZIP 和共鸣 JSON 只备份本地记录，不包含云端账号、密码或会话，也不自动读取云端存档。需要备份最新云端记录时，先下载再导出；导入备份不更新云端。“清除数据”清理当前浏览器数据，保留云端账号和存档，不主动撤销登录 Cookie；浏览器清除站点数据则可能移除登录凭据。

构建 `npm run build:cloudflare` 只生成本地部署文件；通过 Git 推送触发 Pages 构建或在项目根目录执行 `npx wrangler pages deploy dist --project-name infinity-nikki-album-manager --branch main` 才更新线上。命令中的项目名和生产分支需与实际项目一致。

## 本地验证

本地开发与点赞使用相同的远程方式：`npm run dev:remote` 将共鸣和衣橱 API 代理到已部署的 Pages，由 Pages Functions 访问真实云端 D1，不使用电脑上的模拟 D1。先完成上述云端绑定、迁移和部署，再在 `.env.remote.local` 配置：

```dotenv
REMOTE_API_ORIGIN=https://你的站点.pages.dev
```

然后运行 `npm run dev:remote`。本地网页 → Vite 代理 → 线上 Pages Functions → `RESONANCE_DB`。本地操作会修改该站点的真实云端存档；本地与线上登录 Cookie 各自独立，使用相同账号即可访问同一份存档。本地代理只转换本站 Origin，并为 HTTP 开发页面适配共鸣 Cookie，线上 HttpOnly、SameSite、Secure 和来源校验保持原样。

浏览器内的共鸣和衣橱记录仍保存在 IndexedDB，点击上传或下载才完整覆盖目标。普通 `npm run dev` 不启用远程 API；`dev:pages` 默认属于本地模拟模式，不是这里的云端联调入口。后端代码修改需要重新部署目标 Pages 才会生效。

```powershell
npx vitest run tests/resonanceCloud.test.ts tests/components/ResonanceCloudActions.test.ts tests/utils/resonanceStorage.test.ts
npx vue-tsc --noEmit
npx wrangler pages functions build --outdir .wrangler-functions-build
```

接口集成测试使用安装的 Miniflare/workerd 和实际本地 D1 引擎，使用独立临时数据库，不接触生产数据。

## 密码与 Pages Functions 计算额度

- 用户名为 4～32 位 ASCII 字母、数字、下划线，去除首尾空格后转为小写；密码按 Unicode 字符计数为 6～128 位，不裁剪空格。
- 密码使用 Argon2id：19 MiB 内存、2 次迭代、并行度 1、16 字节随机盐、32 字节输出。数据库保存算法版本、盐及哈希。原始密码、会话令牌不写日志或本地存储。
- 该实现使用现有 `@noble/hashes`，不增加密码依赖。密码哈希属于 CPU 密集操作；**D1 免费存储额度不等于 Pages Functions 的免费计算额度**。Workers Free 的 10 ms CPU 限额不能作为本实现可用的部署保证；生产使用应准备 Workers Paid 计算额度，并在实际 Pages 环境测量注册和登录的 CPU。不要通过降低哈希强度规避限额。
- 本地 workerd 测试验证 API/算法可运行，不代表模拟了生产 CPU 计费限制。
- 会话是 32 字节随机令牌，D1 仅保存 SHA-256 摘要。Cookie 使用 HttpOnly、SameSite=Strict，HTTPS 时使用 Secure；会话无服务端固定到期日，浏览器 Cookie 设置 400 天并在恢复会话时续期。浏览器仍可能主动清理凭据，不能承诺绝对永久登录。
- 退出撤销当前设备会话；其他设备不退出。第一版无密码修改、找回和邮箱绑定。用户应自行保存密码。
- 注册/登录按 IP 每 15 分钟最多 30 次、按账号最多 10 次；同步按账号最多 60 次；删除操作额外最多 10 次。跨源写请求被拒绝；所有写请求要求 JSON 和自定义请求头。

## 存档与覆盖协议

共鸣模块每个账号一份当前存档。`cloud_users.active_snapshot` 指向当前版本；`cloud_records` 一行保存一条 `bannerId:outfitId` 的完整 JSON。

上传不是增量合并：验证完整数据 → 创建暂存版本 → 分段写入所有行 → 比较预览版本和会话 → 事务内切换指针并保存请求回执 → 清理旧版本记录。写入中断不影响当前存档。并发上传只允许一个预期版本提交成功，失败者必须重新预览。每段 SQL JSON 参数小于 300 KB，避免每条记录单独请求导致 D1 调用数超限。

下载在同一 D1 批事务内读取版本和全部记录；确认时重读并核对云端版本，再在同一个 IndexedDB 事务内比较本地预览快照并替换。两边任一发生变化时阻止旧预览覆盖。

空本地不能上传，云端无存档不能清空本地。删除云端要求已登录并确认，无需重新输入密码，原子清空云端指针并清理旧版本数据，保留账号、会话和本地记录。上传/下载不受页面星级筛选影响。

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
| POST | delete | `{ requestId, revision }`，删除云端存档 |

官方参考：[Pages D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)、[Pages Functions 价格](https://developers.cloudflare.com/pages/functions/pricing/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)。

## 衣橱云同步

衣橱使用同一个账号和 `resonance_session` Cookie，但有独立版本、当前快照、暂存记录和幂等回执。登录或退出同时影响两个模块的页面状态；上传、下载、删除只作用于当前模块，不自动同步。

衣橱操作位于个人衣橱操作栏，手机通过“⋯”菜单使用。预览显示整份存档的拥有记录数量、未知套装数、区服和云端更新时间。这里的数量包括暂未收录的服装 ID，不受当前图鉴筛选影响，可能与主列表的展示数量不同。区服不同会显示目标区服；下载后恢复存档区服。

- 成功导入但拥有 0 件是有效存档，允许上传或下载，确认时会明确说明完整覆盖。
- 未导入或清空后的空状态不能上传；云端不存在存档时不能下载清空本地。
- 保留旧版 `manual` 来源、`owned=false`、未知服装和套装 ID。图鉴与图片不进入个人云存档。
- 总备份及衣橱 JSON 保留原格式；云端协议版本为 1，未知协议版本拒绝恢复。
- 容量为 8 MiB、最多 50000 条服装记录和 10000 个去重未知套装。上传请求体另留 16 KiB 协议开销。

### 数据库迁移与实际运行

在现有 `wxnn-resonance` 上追加 `migrations-resonance/0002_wardrobe_cloud.sql`，创建 `cloud_wardrobe_state`、`cloud_wardrobe_snapshots` 和 `cloud_wardrobe_records`。保留旧共鸣表和用户会话，不需要重新注册。

本地开发和线上运行的云同步均连接 **Cloudflare 上的真实 D1**。本地通过 Vite 代理转发到已部署 Pages；自动化测试中的隔离 D1 仅用于测试，不是运行时数据源。可使用现有 `start/Start-Remote-D1-Website.bat`，或设置 `REMOTE_API_ORIGIN` 后运行 `npm run dev:remote`。衣橱和共鸣路径使用相同的 Origin/Cookie 代理规则。

```powershell
# 先检查当前账号，再核对数据库和生产备份／恢复点。
npx wrangler whoami
# 追加衣橱迁移，不能使用指向 wxnn-likes 的 npm d1:migrate:remote。
npx wrangler d1 migrations apply wxnn-resonance --remote
```

后端变更必须部署到目标 Pages 后，本地远程代理才能访问新接口。应用部署顺序为：独立测试数据库验证 → 生产备份／恢复点 → 追加迁移 → 部署前后端 → 专用账号验证。应用回退时保留新增衣橱表，先恢复上一版部署；不要删表或盲目整库回滚。Preview 不应绑定生产数据库。

### 衣橱接口

账号操作仍在 `/api/resonance/cloud`；衣橱业务路径为 `/api/wardrobe/cloud`，继续使用现有 `X-Resonance-Request` 与 `X-Resonance-Account` 头以兼容登录体系。

| 方法 | action | 请求／返回 |
| --- | --- | --- |
| GET | summary | 版本、指针、更新时间、数量和区服；不扫描服装记录 |
| GET | snapshot | 同一事务读取版本、元数据和完整衣橱；无存档时 data 为 null |
| POST | upload | `{ requestId, revision, schemaVersion: 1, data }` |
| POST | delete | `{ requestId, revision }` |

上传和删除只读取摘要作为预览；下载确认后读取一次完整快照并核对预览版本。本地基线采用无副作用读取和稳定序列化，区服补齐只发生在上传副本中。本地最终比较与替换仍在一个 IndexedDB 事务中完成。设备时间不决定覆盖顺序。

暂存写入按 JSON 参数分段，提交时核对实际行数、内容摘要对应的请求、衣橱版本及有效会话，原子更新指针和回执。清理旧内容失败会记录安全诊断，但不把已经提交的上传／删除误报为失败。请求结果不明时复用原请求 ID 和原数据；不能把重试内容换成新本地数据。

衣橱每账号 15 分钟最多 60 次业务请求，删除额外最多 10 次，计数与共鸣业务独立。最多两个未完成暂存；非当前暂存超过 24 小时、回执超过 30 天时在后续写操作中回收。当前存档不按年龄清理，无后台定时服务；长期不活跃数据可能需要维护者处理。

诊断只包含固定 operation/stage、服务端 traceId、错误类别和必要耗时。错误响应头 `X-Request-Id` 用于排查；不是客户端的幂等 requestId。衣橱错误弹窗显示服务端提供的追踪编号，可用该编号在 Functions 日志中定位请求；网络中断未收到响应头时没有编号。不要在日志中加入账号、密码、令牌、完整衣橱或原始异常内容。

### 验证

```powershell
npx vitest run tests/wardrobeCloud.test.ts tests/utils/wardrobeCloudSchema.test.ts tests/utils/wardrobeCloudClient.test.ts tests/components/WardrobeCloudActions.test.ts tests/components/CloudSession.test.ts tests/resonanceCloud.test.ts tests/components/ResonanceCloudActions.test.ts tests/resonanceCloudProxy.test.ts
npm test
npm run build
npx wrangler pages functions build --outdir .wrangler-functions-build
```

容量测试使用 50000 条服装及 10000 个未知套装的合成数据，并检查摘要响应小于 1 KB、往返完整；图鉴规模测试记录纯规范化耗时。这些本地测试不证明真实 Cloudflare 配额、计费或线上吞吐。

### 2026-10-22 实施验证记录

本轮按维护者要求完成代码与测试，**未执行远程迁移、部署和线上存档验收**。开发代理已接入衣橱路径，但目标 Pages 必须部署新接口后才能实际使用。数据库测试在隔离 Miniflare/workerd D1 中执行，不访问用户真实存档。

| 检查 | 结果 |
| --- | --- |
| `npm test` | 105 个 Vitest 文件、903 项测试通过；25 项 Node 启动／网络测试通过 |
| `npm run build` | vue-tsc 与生产构建通过；仍有混合静态／动态导入及大包警告 |
| Functions build | Wrangler 4.149.0 编译通过 |
| 修改文件格式与差异 | 本次修改和新增的 TS／Vue 文件 Prettier 检查通过；`git diff --check` 通过 |
| 全仓格式检查 | 275 个未修改文件存在既有格式问题，未进行无关重写 |
| 浏览器检查 | 本地远程代理模式下检查手机宽度的衣橱操作菜单与登录弹窗；未提交登录或云端写操作 |

数据与协议测试覆盖旧库追加迁移、现有账号与共鸣数据保留、账号隔离、有效空存档、区服和未知记录往返、预览后的版本变化、同请求重放、暂存失败、提交前撤销会话、清理失败和损坏响应。组件测试覆盖本地条件替换、无云存档不清空、固定请求重试、共享会话旧响应及错误追踪编号。

性能记录环境为 Windows x64、Node v24.18.0，本轮与全量测试及构建并行，未使用公网传输：当前图鉴 8277 个服装 ID 的纯规范化耗时 49 ms；上限样本的上传、摘要和下载总耗时 1495 ms，摘要小于 1 KB。当前全图鉴拥有记录的合成 JSON 基线约 380 KiB；生产主 JS 构建结果为 1669.91 kB（gzip 534.50 kB）。这些数值用于后续比较，尚未测量真实浏览器完整预览／保存耗时和线上各阶段耗时。

架构决定及取舍见 [衣橱云同步 ADR](adr/0001-wardrobe-cloud.md)。正式上线仍需独立测试环境、数据库备份／恢复点、真实 D1 追加迁移、Pages 部署以及专用账号验收。
