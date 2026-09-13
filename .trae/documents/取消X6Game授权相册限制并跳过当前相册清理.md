# 取消 X6Game 授权的相册限制，专项清理跳过当前相册

## Summary（需求摘要）

1. **取消授权限制**：`resolveX6GameAccountDirectory` 只保留"所选文件夹名 === `X6Game`"的硬性校验，删除"当前相册不能是 `NikkiPhotos_LowQuality` 或 `ScreenShot`"的限制（即用户截图中 `invalidX6GameDirectory` 提示的第二道触发点）。路径结构校验（用于解析账号 id）保留。
2. **专项清理新行为**：在专项清理中执行「低画质图片和截图」（lowQuality）时，如果当前管理的相册本身就是 `ScreenShot` 或某个账号的 `NikkiPhotos_LowQuality`，则：
   - 该相册目录从本次清理计划中**跳过**（避免删除用户正在浏览的相册内容），只清理"另一个"目录；
   - 在删除确认弹窗的文案中**合并提示**："当前相册为 XXX，包含在低画质图片和截图里，本次清理只会清理另一个目录，建议管理 NikkiPhotos_HighQuality 相册"（用户已确认采用合并文案、单次弹窗的形式）。

## Current State Analysis（现状分析）

### 限制所在位置

- [directoryAccess.ts:85-91](../../src/utils/file-system/directoryAccess.ts#L85-L91) `resolveX6GameAccountDirectory`：
  - 第 1 道（L85）：`x6GameHandle.name !== 'X6Game'` → 抛 `invalid-directory`（**保留**）。
  - 第 2 道（L89-91）：`isCleanupTargetDirectory(albumDirectoryHandle.name)`（相册为 `NikkiPhotos_LowQuality`/`ScreenShot`）→ 抛 `invalid-directory`（**本次删除**）。
  - L92：相册非 `NikkiPhotos_HighQuality` 且 `allowUnrelatedAlbum` → 返回 `''`（保留；删除第 2 道后，ScreenShot/LowQuality 相册在搭配码流程会走这里，授权成功）。
  - 第 3 道（L94-106）：`resolve()` 相对路径必须恰为 `Saved/GamePlayPhotos/<账号>/<相册名>`，用于解析账号 id（**保留**）。
- [directoryAccess.ts:153-154](../../src/utils/file-system/directoryAccess.ts#L153-L154) `getValidatedX6GameDirectory`：对 `!allowUnrelatedAlbum` 场景的同类拦截，使用独立文案 `invalidAlbumDirectory`。当前唯一调用方 [App.vue:714](../../src/App.vue#L714) 固定传 `allowUnrelatedAlbum: true`，该守卫实际不会触发（惰性代码），但其文案语义与新策略冲突，一并移除。
- 文案 `invalidAlbumDirectory` 仅被上述守卫使用：[types.ts:282](../../src/i18n/types.ts#L282)、[fileSystem.ts:11](../../src/i18n/messages/fileSystem.ts#L11)（zh）、[fileSystem.ts:23](../../src/i18n/messages/fileSystem.ts#L23)（en）。

### 专项清理现状

- [App.vue:321-329](../../src/App.vue#L321-L329) `cleanLowQualityPhotos`：解析账号 → `prepareSpecialCleanup(x6GameHandle, 'lowQuality', accountIds)` → 确认弹窗（`app.confirmRelatedCleanup`）→ `executeSpecialCleanup`。
- [cleanupFileSystem.ts:118-162](../../src/utils/file-system/cleanupFileSystem.ts#L118-L162) `prepareSpecialCleanup`：lowQuality 项收集每个账号的 `NikkiPhotos_LowQuality` + X6Game 根下的 `ScreenShot`，**不排除当前相册**。
- [App.vue:313-320](../../src/App.vue#L313-L320) `resolveCleanupAccountIds` 中 `resolveX6GameAccountDirectory` 的错误被 catch 静默回退到扫描全部账号。删除第 2 道后：LowQuality 相册可解析出账号 id（路径校验通过），清理自动限定到该账号；ScreenShot 相册路径长度为 1，仍抛错并回退到账号扫描——均符合预期。
- 账号确认/删除确认弹窗均走 `openConfirmDialog`；句柄比较惯例为 `resolve()`（见 `isSameOrNestedDirectory`）。
- 测试基座：`tests/utils/fileSystem.test.ts` 的 `MemoryDirectoryHandle` 通过 `resolvedPaths` Map 模拟 `resolve()`；现有测试未覆盖第 2 道校验与 `invalidAlbumDirectory`。

## Proposed Changes（变更方案）

### 1. `src/utils/file-system/directoryAccess.ts` — 移除相册限制

- 删除 `resolveX6GameAccountDirectory` 中 L89-91 的第 2 道校验（`isCleanupTargetDirectory` 抛错）。
- 删除 `getValidatedX6GameDirectory` 中 L153-154 的同类守卫（连同 `messages.invalidAlbumDirectory` 引用）。
- 清理因此不再使用的代码：`isCleanupTargetDirectory` 函数、`LOW_QUALITY_DIRECTORY_NAME`、`SCREENSHOT_DIRECTORY_NAME` 常量（`HIGH_QUALITY_DIRECTORY_NAME` 仍被 L92 使用，保留）。
- 效果：授权 X6Game 的唯一硬性要求是文件夹名为 `X6Game`；ScreenShot/LowQuality 相册在搭配码流程（`allowUnrelatedAlbum: true`）走 L92 返回 `''`，授权成功；HighQuality 相册仍走完整路径校验解析账号。

### 2. `src/i18n` — 删除旧文案、扩展确认文案

- [types.ts](../../src/i18n/types.ts)：删除 `invalidAlbumDirectory: string`；`app.confirmRelatedCleanup` 签名由 `(count, missingDirectories)` 扩展为 `(count, missingDirectories, cleanupScope?: { skippedAlbumName: string; remainingTargetNames: string[] })`。
- [fileSystem.ts](../../src/i18n/messages/fileSystem.ts)：删除 zh/en 的 `invalidAlbumDirectory`。
- [app.ts](../../src/i18n/messages/app.ts) `confirmRelatedCleanup`：
  - 无 `cleanupScope` 时文案与今天完全一致（兼容现有行为）。
  - 有 `cleanupScope` 时（zh）：`当前相册为 ${skippedAlbumName}，包含在低画质图片和截图里，本次清理只会清理 ${remainingTargetNames.join(' 和 ')}，建议管理 NikkiPhotos_HighQuality 相册。\n确定删除 ${remainingTargetNames.join(' 和 ')} 文件夹中的 ${count} 张图片吗？${missingText}`
  - en 对应翻译：`The current album is ${skippedAlbumName}, which is included in low-quality photos & screenshots. This cleanup will only clean ${remainingTargetNames.join(' and ')}. We recommend managing the NikkiPhotos_HighQuality album instead.\nDelete ${count} images from ${remainingTargetNames.join(' and ')}?${missingText}`

### 3. `src/utils/file-system/cleanupFileSystem.ts` — 支持跳过当前相册

- 新增局部辅助函数（沿用 `resolve()` 惯例，精确匹配而非嵌套匹配）：
  ```ts
  async function isSameDirectoryEntry(a: FileSystemDirectoryHandle, b: FileSystemDirectoryHandle): Promise<boolean> {
    return a === b || (await a.resolve(b))?.length === 0
  }
  ```
- `SpecialCleanupPlan` 增加字段 `skippedDirectories: string[]`。
- `prepareSpecialCleanup` 签名扩展为 `(x6GameHandle, item, accountIds = [], options?: { skipDirectoryHandle?: FileSystemDirectoryHandle })`。
- `collectCleanupTarget` 增加跳过逻辑：解析出 `directoryHandle` 后，若 `skipDirectoryHandle` 与之精确匹配（`isSameDirectoryEntry`），则把 `directoryName` 去重记入 `skippedDirectories` 并直接返回（不收集照片、不计入 `missingDirectories`）。
- 跳过逻辑只作用于 lowQuality 的照片目标；crashes/logs/webcache 的目录目标不受影响（这些目录不可能是用户相册）。
- 多账号边界情况自然处理：相册为账号 A 的 LowQuality、用户选择清理全部账号时，仅跳过 A 的 LowQuality，其他账号的 LowQuality 与 ScreenShot 仍被清理。

### 4. `src/App.vue` — 传入相册句柄并合并提示

- `cleanLowQualityPhotos` 中调用改为 `prepareSpecialCleanup(x6GameHandle, 'lowQuality', accountIds, { skipDirectoryHandle: albumDirectoryHandle.value ?? undefined })`。
- 确认弹窗文案组装：
  ```ts
  const skippedAlbumName = plan.skippedDirectories[0]
  const cleanupScope = skippedAlbumName
    ? { skippedAlbumName, remainingTargetNames: [...new Set(plan.photoTargets.map((target) => target.directoryName))] }
    : undefined
  // confirmRelatedCleanup(plan.fileCount, plan.missingDirectories, cleanupScope)
  ```
- 相册为 HighQuality 或普通文件夹时精确匹配永不命中，行为与今天完全一致。
- 相册与授权的 X6Game 不属于同一安装目录时，`resolve()` 返回 `null`，不跳过、不提示。

### 5. `tests/utils/fileSystem.test.ts` — 补充测试

- `resolveX6GameAccountDirectory` 相册为 `ScreenShot`/`NikkiPhotos_LowQuality` 且 `allowUnrelatedAlbum: true` →  resolves `''`（不再抛错）。
- 相册为 `NikkiPhotos_LowQuality` 且路径为 `Saved/GamePlayPhotos/<账号>/NikkiPhotos_LowQuality`（不传 allowUnrelatedAlbum）→ resolves 账号 id。
- `prepareSpecialCleanup` lowQuality 传入 `skipDirectoryHandle` 为 ScreenShot 句柄（`album.resolvedPaths.set(screenShotTarget, [])`）→ 计划只含 LowQuality 目标、`skippedDirectories` 为 `['ScreenShot']`、`fileCount` 不含 ScreenShot 照片。
- 传入 `skipDirectoryHandle` 为某账号的 LowQuality → 仅跳过该账号的 LowQuality，ScreenShot 目标保留。

## Assumptions & Decisions（假设与决策）

1. **提示形式**：合并进删除确认弹窗，单次弹窗（用户已确认）；不新增独立信息弹窗，零文件边界（跳过当前相册后另一个目录也没有可清理图片）沿用现有 `noRelatedPhotos` 文案，不额外提示。
2. **跳过判定用句柄精确匹配**而非目录名匹配：避免误伤"相册恰好同名但不在该 X6Game 下"以及"相册是 X6Game 上级目录"的情况；多账号 LowQuality 场景只跳过当前账号的目录。
3. **一并移除惰性守卫与 `invalidAlbumDirectory` 文案**（directoryAccess.ts L153-154 + types/messages）：该守卫当前无触发路径，且语义与新策略直接冲突；移除后 `isCleanupTargetDirectory` 及两个常量成为死代码，同步删除。
4. **路径结构校验（第 3 道）保留**：它是解析账号 id 的唯一途径，且"文件夹名等于 X6Game 就行"指授权准入条件，不改变账号解析逻辑。
5. 提示中的 XXX 使用目录名（`ScreenShot` / `NikkiPhotos_LowQuality`），与用户描述一致。

## Verification（验证步骤）

1. `npm run test` — 全部 vitest 用例通过（含新增用例）。
2. `npm run build` — `vue-tsc --noEmit` 类型检查通过（确认 `invalidAlbumDirectory` 无残留引用、`confirmRelatedCleanup` 签名更新完整）。
3. 全局搜索确认 `invalidAlbumDirectory`、`isCleanupTargetDirectory` 在 src 中零引用。
4. 手动场景核对（执行时按代码走查即可）：
   - 当前相册为 `ScreenShot`：授权 X6Game 成功；清理 lowQuality 时确认框含合并提示且只删 LowQuality。
   - 当前相册为某账号 `NikkiPhotos_LowQuality`：授权成功；清理自动限定该账号，只删 ScreenShot。
   - 当前相册为 `NikkiPhotos_HighQuality` 或普通文件夹：授权与清理行为与改动前完全一致。
