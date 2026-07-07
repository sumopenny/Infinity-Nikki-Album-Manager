## 2026-07-07

1.问题：下滑网页时左侧日期侧栏上方会被顶部工具栏遮住一点，侧栏看起来会往上跑。
- 状态：已解决
- 技术/方法：侧栏本身使用 `position: sticky`，但顶部还有一个同样 sticky 的工具栏；原先侧栏 `top` 偏移依赖估算值，遇到工具栏换行、窗口缩放或内容高度变化时，滚动后容易被顶栏压住。处理时改为通过 `ResizeObserver` 实时测量顶部工具栏高度，并写入 CSS 变量驱动 `.sidebar-column` 的 sticky 偏移，让侧栏始终跟随顶部模块实际高度；同时移除 `.app-shell` 的 `overflow-x: clip/hidden` 限制，避免父级 overflow 影响 sticky 定位稳定性。
---
