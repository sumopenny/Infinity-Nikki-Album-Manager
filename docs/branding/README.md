# 网站品牌图标

- `暖盒星裙型-original.svg`：保留的 SVG 原稿。
- `brand-original.png`：用户提供的原始 PNG，包含不透明白色背景。
- `../../img/brand-mark.png`：由原始 PNG 等比例缩放导出的 256 × 256 网页图标，供顶栏使用，保留原图白底及完整构图。
- `../../img/favicon.svg`：本次会话制作的简化礼盒裙子图标，供支持 SVG 的浏览器使用。
- `../../img/favicon.ico`：由简化 SVG 分别渲染 16、32、48px 后封装的多尺寸 ICO，作为兼容资源。

顶栏 PNG 只进行尺寸缩放，不使用 AI 重绘或抠图。更新顶栏图标时始终从 `brand-original.png` 导出，避免重复缩放损失细节。标签页使用独立的简化图形。

顶栏入口位于 `src/components/TopBar.vue`，标签页入口位于根目录 `index.html`。更换资源后运行 `npm run build`，并检查 34/38px 顶栏显示及 16/32px 标签页显示。更新 favicon 后，浏览器可能需要清理图标缓存才显示新版本。
