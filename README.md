# 无限暖暖相册管理

<div align="center">
  <img src="img/wxnn.ico" alt="无限暖暖相册管理" width="72" height="72">
  <p><strong>在浏览器中整理、浏览、收藏和清理《无限暖暖》本地相册。</strong></p>
  <p style="color: orange;">如果遇到问题，请及时在 GitHub / Gitee 的 Issues 或作者社交平台反馈。</p>
  <p>
    <a href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager/releases">GitHub Releases</a> ·
    <a href="https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager/releases">Gitee Releases</a> ·
    <a href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager">GitHub</a> ·
    <a href="https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager">Gitee</a>
  </p>
  <p><a href="README_EN.md"><strong>English</strong></a></p>
</div>

---
### 使用可以直接打开：https://infinity-nikki-album-manager.pages.dev/ 。
### 或者访问 Vercel （需要VPN）：https://infinity-nikki-album-manager.vercel.app 。

> 本地部署运行时再下载压缩包或clone项目。点击跳转本地部署教程：[开发者本地运行](#开发者本地运行)

---
## 网站界面
<div align="center">
  <img src="img/1.webp" alt="项目界面" width="49%">
  <img src="img/2.webp" alt="项目界面" width="49%">
  <img src="img/3.webp" alt="项目界面" width="49%">
  <img src="img/搭配码编辑.webp" alt="项目界面" width="49%">
  <img src="img/搭配码.webp" alt="项目界面" width="90%">
 
</div>


## 功能

- 按“年份 > 月份 > 日期”分组，支持折叠时间轴和日期快速跳转。
- 顶部通过“当前相册 / 视图 / 更多”菜单集中管理目录、主题、缩略图、语言、缓存/数据清理、帮助和项目链接。
- 删除的高画质照片会移动到当前相册的 `trash` 文件夹，可预览、恢复或永久删除。
- 单击选择后从页面底部显示批量收藏、删除、恢复或永久删除操作栏。
- 双击打开大图预览，支持 50%–300% 缩放、滚轮缩放和放大后拖动。
- 支持键盘翻页和删除当前预览照片。
- 提供 1:1、半尺寸 1:1、16:9、4:3、9:16、3:4 缩略图比例；半尺寸模式的悬浮信息只显示拍摄时间。
- 记住相册目录和收藏状态，支持中英文与亮暗主题。
- 在本地保存搭配图片、搭配码和单选标签，支持待填写方案、自动接收图片以及 ZIP 导入导出。
- 一键清理同账号的低画质照片与游戏截图。

## 快速开始

直接打开 https://infinity-nikki-album-manager.pages.dev/ 即可使用，也可通过下载压缩包或 clone 项目来本地运行，点击跳转本地部署教程：[开发者本地运行](#开发者本地运行)。

> 如果国内直连地址临时不可用，可尝试 Vercel 备选地址：https://infinity-nikki-album-manager.vercel.app

## 搭配码管理
进入“搭配码”后会显示独立操作指南，请仔细阅读说明。
- 最多可创建 40 个用户标签，每个标签不超过 5 个字符。删除使用中的标签只会让相关方案归入“未分类”。
- 点击“添加方案”可选择、拖拽或粘贴图片（点击窗口空白处后按 `Ctrl+V`）；JPG 和 PNG 会在本地转换为 WebP，搭配码允许留空，标签最多选择一个，双击图片可打开预览。
- 搭配方案大图预览的底部工具栏会显示当前标签和搭配码，并提供复制与编辑按钮；从大图打开编辑窗口后，保存或关闭编辑仍返回当前大图。
- 网站会在当前相册中按需创建 `clothe` 文件夹来管理搭配码。<span style="color: red;">批量导入时可直接把保存好的搭配图片移动进该文件夹，打开、刷新或重新聚焦网站页面时会自动转为待填写方案。</span>
- 使用<span style="color: orange;">自动更新搭配码</span>功能需要授权当前游戏的 `X6Game` 文件夹。<span style="color: red;">在游戏内点击分享按钮，需要在搭配截图右下角点击框选按钮，框选完成后点击生成搭配码，再返回网页，网站会自动获取搭配码和图片，已有相同搭配码会跳过，避免重复。</span>

<div align="center">
  <img src="img/自动更新步骤.webp" alt="项目界面" width="70%">
</div>

- “导出数据”会在当前相册文件夹中生成 ZIP 文件，成功提示会显示文件名和保存位置。“导入数据”会校验并合并 ZIP，不覆盖已有方案；重复或无效内容会跳过。<span style="color: red;">删除搭配方案是永久删除，不会进入最近删除。</span>
- 单击搭配方案可进行多选并显示底部工具栏，<span style="color: red;">搭配方案删除后不可恢复，确认前请核对方案信息。</span>

## 一键清理低画质与截图

选择 `NikkiPhotos_HighQuality` 后，点击“一键清理低画质与截图”，可清理：

- `NikkiPhotos_LowQuality` 中的图片。
- 当前游戏 `X6Game\ScreenShot` 中的图片。

首次使用需要额外选择并授权对应的 `X6Game` 文件夹。程序会验证相册路径，删除前显示数量并再次确认；只删除图片，保留文件夹和其他文件。完成后会显示实际清理数量和释放容量；无法读取或删除的文件会保留并列出具体原因。

## 选择相册

点击“选择/恢复相册路径”，推荐直接选择：

```text
...\InfinityNikki Launcher\InfinityNikki\X6Game\Saved\GamePlayPhotos\你的ID\NikkiPhotos_HighQuality
```

不要选择 C 盘、Windows、Program Files、游戏安装根目录等受保护或过大的上级目录。

## 常用操作

| 操作 | 结果 |
| --- | --- |
| 单击照片 | 选中或取消选中 |
| 双击照片 | 打开大图预览 |
| 点击爱心 | 加入或移出收藏夹 |
| 点击左侧日期 | 跳转到对应日期 |
| 左右方向键 | 在大图预览中切换照片 |
| 滚轮 / 缩放按钮 | 在大图预览中按 25% 步长缩放 |
| 拖动大图 | 放大后移动图片查看细节 |
| `Esc` | 关闭大图预览 |
| `Delete` | 将当前预览照片移到最近删除 |
| 底部操作栏 | 全选、批量收藏、删除、恢复或永久删除 |

> 普通相册删除会把原图移动到当前相册的 `trash` 文件夹；<span style="color: red;">最近删除中的“永久删除”和“一键清理低画质与截图”会直接删除电脑文件，无法恢复。</span>

## 最近删除与刷新

- 点击“刷新相册”可立即同步目录；页面重新获得焦点时也会自动同步，并提示新增和外部移除数量。
- 最近删除按删除时间倒序展示，顶部显示照片总数和总大小。
- 支持单张或批量恢复、永久删除、全选、大图预览和永久清空全部。
- 恢复时如果原相册已有同名文件，会自动使用 `_restored_1`、`_restored_2` 等后缀，不会覆盖现有照片。
- 最近删除中的照片不会自动过期，会一直保留到恢复或手动永久删除。


## 常见问题

### 启动器没有反应

- 确认项目已经完整解压，不要在 ZIP 内运行。
- 确认已安装 Node.js LTS，且 `start` 文件夹没有缺失。
- 检查安全软件是否拦截 EXE 或 BAT 文件。
- 也可直接运行 `start\Start-Project.bat` 查看错误信息。

### 网页没有显示照片

- 确认选择的是实际图片目录。
- 确认文件扩展名受支持，且文件名以日期格式开头。
- 浏览器授权失效时，重新点击“选择/恢复相册路径”。

### 浏览器拒绝打开文件夹

浏览器会阻止网页访问系统目录。请直接选择 `NikkiPhotos_HighQuality`，<span style="color: red;">不要选择磁盘根目录或游戏安装上级目录。</span>

## 隐私与安全

- 照片在本地浏览器中读取，不会上传到项目服务器。
- 相册目录授权和收藏记录保存在当前浏览器本地；“更多”里的“清除缓存”只清除 `X6Game` 授权和搭配码指南“不再提示”状态并保留当前相册授权，“清除数据”会二次确认后清除全部网站本地记录和授权，让网站回到首次打开状态。
- 浏览器可能因安全策略要求重新授权文件夹。
- 删除和一键清理会修改电脑中的真实文件；“清除缓存”和“清除数据”不会删除电脑里的真实照片、`clothe`、`trash` 或其他文件。

## 开发者本地运行

普通用户优先使用在线版；只有需要研究代码、二次开发或本地调试时，才需要下载项目。

环境要求：Windows、[Node.js LTS](https://nodejs.org/)、最新版 Chrome 或 Edge。

### 安装 Node.js

1. 打开 [Node.js 官网](https://nodejs.org/)，下载标有 **LTS** 的 Windows 安装包，不要选择 Current 版本。
2. 双击安装包，保持默认选项并继续安装；确保 `Add to PATH` 相关选项没有被取消。
3. 安装完成后关闭并重新打开终端、项目文件夹和启动器窗口，让环境变量生效。
4. 按 `Win + R`，输入 `cmd` 并回车，然后分别运行：

```bash
node -v
npm -v
```

两个命令都能显示版本号，说明安装成功。如果提示“不是内部或外部命令”，请重启电脑后再试；仍然失败时，卸载 Node.js 并重新安装 LTS 版本。

### 研究代码或本地开发

1. 从 [GitHub Releases](https://github.com/sumopenny/Infinity-Nikki-Album-Manager/releases) 或 [Gitee Releases](https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager/releases) 下载并解压项目，或从仓库克隆源码。
2. 双击根目录的 `无限暖暖相册启动器.exe`。
3. 首次运行会自动安装依赖并打开 `http://localhost:5173`。
4. 使用期间不要关闭窗口。

启动器不可用时，可双击 `start\Start-Project.bat`，或使用下方开发命令手动启动。

### 开发命令

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器
npm test          # 运行自动化测试
npm run build     # 类型检查并构建
npm run preview   # 预览构建结果
```

技术栈：Vue 3、TypeScript、Vite、File System Access API、IndexedDB。

---

如果这个项目对你有帮助，欢迎在 [GitHub](https://github.com/sumopenny/Infinity-Nikki-Album-Manager) 或者 [Gitee](https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager) 里点一个 Star。