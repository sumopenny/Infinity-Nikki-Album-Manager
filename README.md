# Infinity Nikki Album Manager / 无限暖暖相册管理

一个用于整理、浏览和删除《无限暖暖》截图相册的本地网页工具。  
A local web tool for browsing, organizing, previewing, and deleting Infinity Nikki screenshots.
<div align="center">
  <a href="#简体中文教程"><b>🇨🇳 简体中文</b></a> &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#english-guide"><b>🇺🇸 English</b></a>
</div>

---

## 简体中文教程

### 1. 这个项目是做什么的？

这个项目可以在浏览器里打开一个相册管理页面，用来管理《无限暖暖》的相册文件夹。
![项目截图](img/1.png)

你可以用它做这些事：

- 选择电脑里的《无限暖暖》相册文件夹，推荐文件路径：文件所在盘和目录\InfinityNikki Launcher\InfinityNikki\X6Game\Saved\GamePlayPhotos\你的id\NikkiPhotos_HighQuality。
![项目截图](img/2.png)

- 按拍摄日期自动分组显示照片。
- 点击日期快速跳转到某一天的照片。
- 单击照片进行选中，双击照片查看大图。
![项目截图](img/3.png)

- 在大图预览里使用键盘左右方向键翻页。
- 删除选中的照片，或删除当前预览的照片。
- 调整缩略图比例，比如 1:1、16:9、4:3、9:16、3:4。
![项目截图](img/4.png)

- 浏览器会记住上次选择过的相册文件夹，下次可以尝试自动恢复。

- 浏览器会记住上次选择过的相册文件夹，下次可以尝试自动恢复。

重要提醒：删除照片会同步删除电脑文件夹里的原图，请确认不要的照片再删除。

---

### 2. 使用前需要准备什么？

请先准备下面几样东西。

#### 2.1 一台 Windows 电脑

这个项目提供了一个 `Start-Project.bat` 文件，适合 Windows 用户双击启动。

#### 2.2 Node.js

项目需要 Node.js 才能运行。

如果你的电脑还没有安装 Node.js，请这样做：

1. 打开浏览器。
2. 访问 Node.js 官网：`https://nodejs.org/`
3. 下载 LTS 版本，也就是官网推荐的长期支持版本。
4. 像安装普通软件一样一路下一步安装。
5. 安装完成后，重新打开项目文件夹，再双击 `Start-Project.bat`。

如果双击启动文件时提示 `Node.js was not found` 或 `npm was not found`，一般就是 Node.js 没装好，需要重新安装 Node.js。

#### 2.3 Chrome 或 Edge 浏览器

本项目需要浏览器支持“选择文件夹”和“读写本地文件”的能力。

推荐使用：

- Google Chrome 最新版
- Microsoft Edge 最新版

不推荐使用太旧的浏览器。某些浏览器可能无法选择文件夹，也可能无法删除本地图片。

---

### 3. 如何从 GitHub 下载项目？

如果你不熟悉 Git，也没有关系，按下面步骤操作即可。

#### 方法一：直接下载 ZIP，适合大多数人

1. 打开项目的 GitHub 页面。
2. 点击绿色的 `Code` 按钮。
3. 点击 `Download ZIP`。
4. 下载完成后，右键压缩包，选择“全部解压”或“解压到当前文件夹”。
5. 打开解压后的项目文件夹。
6. 找到 `Start-Project.bat` 文件。
7. 双击它。

注意：不要直接在压缩包里面双击运行。一定要先解压，再进入解压后的文件夹运行。

#### 方法二：使用 Git 克隆，适合开发者

如果你会使用 Git，可以运行：

```bash
git clone https://github.com/sumopenny/Infinity-Nikki-Album-Manager.git
cd Infinity-Nikki-Album-Manager
npm install
npm run dev
```

---

### 4. 最简单的启动方式：双击 Start-Project.bat

项目根目录里有一个文件：

```text
Start-Project.bat
```

使用步骤：

1. 打开项目文件夹。
2. 找到 `Start-Project.bat`。
3. 用鼠标左键双击它。
4. 第一次运行时，它会自动执行 `npm install` 安装依赖。
5. 等它安装完成后，会自动启动网站。
6. 浏览器会自动打开这个地址：

```text
http://localhost:5173
```

如果浏览器没有自动打开，请自己打开 Chrome 或 Edge，然后把下面这个地址复制到地址栏里：

```text
http://localhost:5173
```

#### 启动时出现的黑色窗口能不能关？

会出现一个或两个黑色命令窗口。

请记住：

- 网站使用期间，不要关闭显示 `npm run dev` 或 `VITE` 的开发服务窗口。
- 如果关闭了开发服务窗口，网页就会停止运行。
- 如果不小心关掉了，重新双击 `Start-Project.bat` 即可。

---

### 5. 手动启动方式

如果你不想使用 BAT 文件，也可以手动启动。

1. 打开项目文件夹。
2. 在空白处右键，选择“在终端中打开”或“Open in Terminal”。
3. 第一次运行时，输入：

```bash
npm install
```

4. 安装完成后，输入：

```bash
npm run dev
```

5. 浏览器打开：

```text
http://localhost:5173
```

---

### 6. 如何使用网页管理相册？

#### 6.1 选择相册文件夹

打开网站后，点击页面上的：

```text
选择/恢复相册路径
```

然后选择《无限暖暖》的截图文件夹。

推荐直接选择图片文件夹，例如：

```text
NikkiPhotos_HighQuality
```

不要选择这些位置：

- C 盘根目录
- Windows 文件夹
- Program Files 文件夹
- 游戏安装根目录的上级目录
- 其他系统保护目录

如果选择了系统保护目录，浏览器可能会拒绝访问。

#### 6.2 图片文件名要求

项目会根据图片文件名里的日期来分组。

支持类似下面格式的文件名：

```text
2026_07_04_15_30.png
2026_07_04_15_30_25.jpg
```

也就是说，文件名开头需要包含：

```text
年_月_日_小时_分钟
```

或：

```text
年_月_日_小时_分钟_秒
```

如果页面提示没有找到图片，通常有两种原因：

1. 选错文件夹了。
2. 图片文件名不是项目支持的日期格式。

#### 6.3 浏览照片

选择正确的相册文件夹后，页面会显示照片。

常用操作：

- 单击照片：选中或取消选中。
- 双击照片：打开大图预览。
- 点击左侧日期：跳转到对应日期。
- 点击“全选照片”：选中全部照片。
- 再点一次“取消全选”：取消全部选中。

#### 6.4 大图预览

打开大图后可以这样操作：

- 按键盘左方向键：上一张。
- 按键盘右方向键：下一张。
- 按 `Esc`：关闭大图预览。
- 按 `Delete` 或点击删除按钮：删除当前预览的照片。

#### 6.5 删除照片

页面支持删除照片。

可以删除：

- 当前预览的单张照片。
- 已选中的多张照片。

删除前浏览器会弹出确认框，请认真确认。

再次提醒：删除操作会删除电脑文件夹里的原图，不只是从网页上移除。

---

### 7. 常见问题

#### 问：双击 Start-Project.bat 没反应怎么办？

可以按顺序检查：

1. 项目是不是已经解压出来了？不要在 ZIP 压缩包里运行。
2. 电脑是否安装了 Node.js？
3. `Start-Project.bat` 是否和 `package.json` 在同一个文件夹？
4. 是否有安全软件拦截了 BAT 文件？
5. 可以尝试右键 `Start-Project.bat`，选择“以管理员身份运行”。

#### 问：提示 npm install 失败怎么办？

一般是网络问题或 Node.js 安装不完整。

可以尝试：

1. 检查网络连接。
2. 重新安装 Node.js LTS。
3. 在项目文件夹打开终端，手动运行：

```bash
npm install
```

#### 问：网页打不开怎么办？

先确认开发服务窗口还开着。

如果窗口还在，请手动打开：

```text
http://localhost:5173
```

如果提示端口被占用，可以关闭其他正在运行的项目窗口，然后重新双击 `Start-Project.bat`。

#### 问：为什么浏览器不让我选择某个文件夹？

浏览器为了保护电脑，不允许网页访问系统文件夹或受保护目录。

请直接选择真正存放图片的文件夹，比如 `NikkiPhotos_HighQuality`，不要选择 C 盘、Windows、Program Files 这类上级目录。

#### 问：为什么没有显示照片？

可能原因：

1. 选错文件夹。
2. 文件夹里没有图片。
3. 图片扩展名不在支持范围内。
4. 文件名开头没有日期格式。

支持的图片扩展名包括：

```text
jpg, jpeg, png, webp, gif, bmp, avif
```

#### 问：为什么下次打开还要授权？

浏览器会尽量记住上次选择的文件夹，但出于安全原因，有时仍然需要你重新授权。

如果看到授权提示，请再次点击“选择/恢复相册路径”。

---

### 8. 开发者命令

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

打包项目：

```bash
npm run build
```

预览打包结果：

```bash
npm run preview
```

---

### 9. 项目结构说明

```text
.
├─ Start-Project.bat        # Windows 一键启动文件
├─ index.html               # 网页入口
├─ package.json             # 项目信息和 npm 命令
├─ src/                     # 源代码目录
│  ├─ App.vue               # 主页面逻辑
│  ├─ main.ts               # Vue 入口
│  ├─ styles.css            # 全局样式
│  ├─ components/           # 页面组件
│  ├─ types/                # TypeScript 类型
│  └─ utils/                # 工具函数
└─ vite.config.ts           # Vite 配置
```

---

## English Guide

### 1. What is this project?

Infinity Nikki Album Manager is a local web app for managing Infinity Nikki screenshot folders in your browser.
![Project Screenshot](img/1.png)

You can use it to:

- Choose your local Infinity Nikki screenshot folder. Recommended path: `drive and directory\InfinityNikki Launcher\InfinityNikki\X6Game\Saved\GamePlayPhotos\your id\NikkiPhotos_HighQuality`.
![Project Screenshot](img/2.png)
- Automatically group photos by date.
- Jump to a specific date from the sidebar.
- Single-click photos to select them.
- Double-click photos to preview them in a larger view.
![Project Screenshot](img/3.png)
- Use keyboard shortcuts in the preview window.
- Delete selected photos or delete the photo currently being previewed.
- Change thumbnail ratios, including 1:1, 16:9, 4:3, 9:16, and 3:4.
![Project Screenshot](img/4.png)
- Let the browser remember the last selected album folder when possible.

Important: deleting a photo in this app also deletes the original file from your computer folder.

---

### 2. What do you need before using it?

Please prepare the following items first.

#### 2.1 A Windows computer

This project includes a `Start-Project.bat` file for Windows users. You can double-click it to start the project.

#### 2.2 Node.js

This project needs Node.js to run.

If Node.js is not installed:

1. Open your browser.
2. Visit the Node.js website: `https://nodejs.org/`
3. Download the LTS version.
4. Install it like a normal Windows program.
5. After installation, open the project folder again and double-click `Start-Project.bat`.

If the launcher says `Node.js was not found` or `npm was not found`, Node.js is missing or not installed correctly.

#### 2.3 Chrome or Edge browser

This app needs browser support for folder selection and local file read/write access.

Recommended browsers:

- Latest Google Chrome
- Latest Microsoft Edge

Older browsers may not support folder selection or local file deletion.

---

### 3. How to download the project from GitHub

If you are not familiar with Git, use the ZIP download method.

#### Method 1: Download ZIP, recommended for most users

1. Open the project's GitHub page.
2. Click the green `Code` button.
3. Click `Download ZIP`.
4. After downloading, right-click the ZIP file and choose `Extract All`.
5. Open the extracted project folder.
6. Find `Start-Project.bat`.
7. Double-click it.

Do not run the BAT file directly inside the ZIP archive. Extract the ZIP first.

#### Method 2: Clone with Git, for developers

```bash
git clone https://github.com/sumopenny/Infinity-Nikki-Album-Manager.git
cd Infinity-Nikki-Album-Manager
npm install
npm run dev
```

---

### 4. Easiest way to start: double-click Start-Project.bat

In the project root folder, find this file:

```text
Start-Project.bat
```

Steps:

1. Open the project folder.
2. Find `Start-Project.bat`.
3. Double-click it.
4. On first run, it will automatically run `npm install`.
5. After dependencies are installed, it will start the website.
6. Your browser should open this address automatically:

```text
http://localhost:5173
```

If the browser does not open automatically, open Chrome or Edge and paste this address into the address bar:

```text
http://localhost:5173
```

#### Can I close the black command windows?

You may see one or two black command windows.

Please remember:

- Do not close the dev server window that shows `npm run dev` or `VITE` while using the website.
- If you close the dev server window, the website will stop working.
- If that happens, simply double-click `Start-Project.bat` again.

---

### 5. Manual start method

If you prefer not to use the BAT file, you can start it manually.

1. Open the project folder.
2. Right-click an empty area and choose `Open in Terminal`.
3. On first run, enter:

```bash
npm install
```

4. After installation, enter:

```bash
npm run dev
```

5. Open this address in your browser:

```text
http://localhost:5173
```

---

### 6. How to use the album manager

#### 6.1 Choose the album folder

After opening the website, click:

```text
选择/恢复相册路径
```

Then choose your Infinity Nikki screenshot folder.

It is recommended to choose the actual image folder directly, for example:

```text
NikkiPhotos_HighQuality
```

Do not choose these locations:

- Root of drive C
- Windows folder
- Program Files folder
- A parent folder above the game installation directory
- Other protected system folders

Browsers may block access to protected folders.

#### 6.2 Photo filename format

The app groups photos by dates found in filenames.

Supported filename examples:

```text
2026_07_04_15_30.png
2026_07_04_15_30_25.jpg
```

The filename should start with:

```text
year_month_day_hour_minute
```

or:

```text
year_month_day_hour_minute_second
```

If the page says no photos were found, usually either the wrong folder was selected or the filenames do not match this date format.

#### 6.3 Browse photos

After choosing the correct folder, the page will display your photos.

Common actions:

- Single-click a photo: select or unselect it.
- Double-click a photo: open large preview.
- Click a date in the sidebar: jump to that date.
- Click `全选照片`: select all photos.
- Click `取消全选`: clear all selected photos.

#### 6.4 Large preview

In the large preview:

- Press Left Arrow: previous photo.
- Press Right Arrow: next photo.
- Press `Esc`: close preview.
- Press `Delete` or click the delete button: delete the current photo.

#### 6.5 Delete photos

The app can delete photos.

You can delete:

- The current photo in preview.
- Multiple selected photos.

The browser will ask for confirmation before deleting.

Again: deleting in this app deletes the original file from your computer folder.

---

### 7. FAQ

#### Q: Nothing happens when I double-click Start-Project.bat. What should I do?

Check these items in order:

1. Did you extract the ZIP first? Do not run inside the ZIP archive.
2. Is Node.js installed?
3. Is `Start-Project.bat` in the same folder as `package.json`?
4. Did Windows security software block the BAT file?
5. Try right-clicking `Start-Project.bat` and choosing `Run as administrator`.

#### Q: npm install failed. What should I do?

This is usually caused by network issues or an incomplete Node.js installation.

Try:

1. Check your internet connection.
2. Reinstall Node.js LTS.
3. Open a terminal in the project folder and run:

```bash
npm install
```

#### Q: The website does not open. What should I do?

First, make sure the dev server window is still open.

If it is open, manually visit:

```text
http://localhost:5173
```

If port 5173 is already in use, close other running project windows and double-click `Start-Project.bat` again.

#### Q: Why does the browser refuse to open a folder?

For safety, browsers do not allow websites to access system folders or protected directories.

Choose the actual image folder, such as `NikkiPhotos_HighQuality`, instead of choosing C drive, Windows, Program Files, or a high-level parent directory.

#### Q: Why are no photos displayed?

Possible reasons:

1. Wrong folder selected.
2. The folder contains no images.
3. The image extension is not supported.
4. The filename does not start with a supported date format.

Supported image extensions:

```text
jpg, jpeg, png, webp, gif, bmp, avif
```

#### Q: Why do I need to grant folder permission again?

The browser tries to remember the last folder, but for security reasons, it may still ask for permission again.

If that happens, click `选择/恢复相册路径` again and grant permission.

---

### 8. Developer commands

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

### 9. Project structure

```text
.
├─ Start-Project.bat        # Windows one-click launcher
├─ index.html               # HTML entry
├─ package.json             # Project metadata and npm scripts
├─ src/                     # Source code
│  ├─ App.vue               # Main app logic
│  ├─ main.ts               # Vue entry
│  ├─ styles.css            # Global styles
│  ├─ components/           # UI components
│  ├─ types/                # TypeScript types
│  └─ utils/                # Utility functions
└─ vite.config.ts           # Vite configuration
```
