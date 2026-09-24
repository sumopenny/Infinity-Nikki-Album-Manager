# NikkiCube

<div align="center">
  <img src="img/wxnn.ico" alt="Nikki³ NikkiCube" width="72" height="72">
  <p><strong>Nikki³ · Infinity Nikki Toolkit</strong></p>
  <p>NikkiCube runs locally in your browser to manage albums, outfit codes, photo parameters, and targeted cleanup.</p>
  <p style="color: orange;">If you run into any issues, please fill out the survey in the site's Feedback section, or report them through GitHub/Gitee Issues or the author's social platforms.</p>
  <p>
    <a href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager/releases">GitHub Releases</a> ·
    <a href="https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager/releases">Gitee Releases</a> ·
    <a href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager">GitHub</a> ·
    <a href="https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager">Gitee</a>
  </p>
  <p><a href="README.md"><strong>简体中文</strong></a></p>
</div>

---
### Open the website directly: https://infinity-nikki-album-manager.pages.dev/ .
### Or use Vercel (VPN may be required): https://infinity-nikki-album-manager.vercel.app .

> For local deployment, download the archive or clone the project. Jump to the local deployment guide: [Local Setup for Developers](#local-setup-for-developers)

---
## Website UI
<div align="center">
  <img src="img/1.webp" alt="Project UI" width="49%">
  <img src="img/2.webp" alt="Project UI" width="49%">
  <img src="img/3.webp" alt="Project UI" width="49%">
  <img src="img/搭配码编辑.webp" alt="Project UI" width="49%">
  <img src="img/搭配码.webp" alt="Project UI" width="90%">

</div>


## Features

- Group photos by year, month, and date with a collapsible timeline and quick date jumps.
- Report issues directly through the Feedback entry in the More menu.
- The Release history window shows the current release and historical release notes; Help and introduction contains the site overview, features, tutorials, and important notes.
- The Release history window opens automatically when the site loads; check "Don't show again" to hide it until the next version update.
- Deleted high-quality photos move to the current album's `trash` folder for preview, restore, or permanent deletion.
- Single-click to select a photo and show the bottom action bar.
- Double-click to open the large preview with 50%–300% zoom, mouse-wheel zooming, and drag-to-pan after zooming in.
- Use the keyboard to navigate photos and delete the current preview photo.
- Choose 1:1, Half 1:1, 16:9, 4:3, 9:16, or 3:4 thumbnail ratios.
- Store outfit images, outfit codes, and tags locally, with pending plans, automatic image intake, and ZIP import/export.
- Add notes of up to 15 characters to photos and outfit plans, then search the current view by file name, note, or outfit code.
- Parse CameraParams from photo thumbnails or the full-size viewer. The upper-right Tools menu opens a shared Parameter / outfit-code parser window for direct camera-parameter and outfit-code input. Photo parsing shows capture time, weather, focal length, aperture, vignette, image adjustments, normal poses, lights, filters, Momo poses, and camera parameters that can be imported into the game. The Parameter / outfit-code parser window in the Tools menu can also be used on mobile devices.
- The photo-parameter window can parse one local original game image selected on a computer or phone. The file is read temporarily in the browser only: it is not uploaded or added to the album. Saved UIDs are tried automatically, with manual UID retry when needed.
- After selecting one or more photos, use the selection bar to permanently delete same-name images from `ScreenShot` and the current account's `NikkiPhotos_LowQuality` folder. The action requires confirmation and cannot be undone; selected photos in the current album are never deleted.
- Open Special Cleanup from the upper-right Tools menu to clean low-quality photos and game screenshots, crash snapshots, runtime logs, and the game's built-in browser cache.
- Open Lucky pull times from the upper-right Tools menu to view the entertainment-only Version 2.10 timing table; actual drop rates still follow the game's probabilities.

## Quick Start

Open https://infinity-nikki-album-manager.pages.dev/ directly to use it. You can also download the archive or clone the project to run it locally. Jump to the local deployment guide: [Local Setup for Developers](#local-setup-for-developers).

> If the China-accessible site is temporarily unavailable, try the Vercel fallback (VPN required): https://infinity-nikki-album-manager.vercel.app

## Outfit Code Management
Entering Outfit codes opens a standalone guide. Please read it carefully.
- You can create up to 40 user tags, and each tag can contain up to 5 characters. Deleting a tag in use only moves related plans to Uncategorized.
- New tags appear at the top of the tag list; drag the left handle to adjust the order.
- Click Add outfit to select, drag and drop, or paste an image (click an empty area in the dialog and press `Ctrl+V`). JPG and PNG files are converted locally to WebP, the outfit code can be empty, each plan can use one tag, and double-clicking the image opens the preview.
- The decode button is always visible in the upper-right corner of each outfit card and remains disabled until a code is entered. The delete button sits to its left and appears when the card is hovered or the button receives keyboard focus.
- Open the shared Parameter / outfit-code parser from the upper-right Tools menu and enter a code without creating a plan first; results open in the same decoder dialog.
- The outfit preview toolbar shows the current tag and outfit code, with Copy and Edit buttons.
- The app creates a `clothe` folder inside the current album as needed to manage outfit codes. <span style="color: red;">For bulk import, move saved outfit images directly into this folder; opening, refreshing, or refocusing the website page automatically converts them into pending plans.</span>
- If a delete operation cannot fully restore files, the app lists the affected outfits in a dialog; manually inspect the current album's `clothe` folder.
- Using the <span style="color: orange;">auto update outfit code</span> feature requires authorizing the current game's `X6Game` folder. You can authorize it from the Current album menu in the upper-right corner. <span style="color: red;">How to use: in the game, tap Share, tap the selection button at the lower-right corner of the outfit screenshot, tap Generate Outfit Code after the selection is complete, then return to the web page. The website imports only when both the outfit code is new and the game's outfit image has a newer last-modified time; existing codes, unchanged images, or missing images are skipped with a status message.</span>

<div align="center">
  <img src="img/自动更新步骤.webp" alt="Project UI" width="70%">
</div>

- Export data generates a ZIP file in the currently selected album folder and preserves outfit codes, tags, notes, and creation times. Import data validates and merges the ZIP without replacing existing plans; duplicate or invalid content is skipped. Imports validate the complete backup first, then extract and write images in bounded batches to reduce browser memory use with large backups. <span style="color: red;">Deleting an outfit plan is permanent and does not go to Recently Deleted.</span>
- JPG, PNG, and WebP sources are decoded for validation only once before saving. JPG and PNG files are still converted locally to WebP, and images are never uploaded.
- The album supports batch image import through the file picker. The gallery header exports all photos, while the selection bar exports only selected photos. After a successful export, you can choose to move successfully exported source photos to Recently Deleted. Cancelling keeps completed target files and all source photos.
- Single-click outfit plans to select multiple items and show the bottom toolbar. <span style="color: red;">Deleted outfit plans cannot be restored, so check the plan information before confirming.</span>

## Special Cleanup

Open Special Cleanup from the upper-right Tools menu to open the cleanup window. Using the cleanup features requires authorizing the `X6Game` folder.

The following cleanup items are available:

- Low-quality photos and screenshots (`...\X6Game\ScreenShot` and `NikkiPhotos_LowQuality`): lower-quality images produced by in-game photography; only image files are deleted. When multiple account folders exist, you can choose to clean all accounts or a specific account ID. If the album you are currently managing is itself `ScreenShot` or `NikkiPhotos_LowQuality`, the cleanup skips that album folder and only cleans the other one, with a note in the confirmation prompt; managing the `NikkiPhotos_HighQuality` album is recommended.
- Crash snapshots (`...\X6Game\Saved\Crashes`): after deletion, historical crash causes can no longer be reported to the official team via local logs.
- Runtime logs (`...\X6Game\Saved\Logs`): deleting them has no side effects.
- Built-in browser and login cache (`...\X6Game\Saved\webcache_4430`): clears expired web data, but event pages and announcements load more slowly the first time they are opened afterwards.

## Choose an Album

Click `Choose / restore album folder`; it is recommended to select:

```text
...\InfinityNikki Launcher\InfinityNikki\X6Game\Saved\GamePlayPhotos\Your ID\NikkiPhotos_HighQuality
```

Do not select drive roots, Windows, Program Files, the game install root, or other protected or overly broad parent directories.

## Controls

| Action | Result |
| --- | --- |
| Single-click photo | Select or unselect |
| Double-click photo | Open large preview |
| Click the heart | Add to or remove from Favorites |
| Click a sidebar date | Jump to that date |
| Left / Right Arrow | Switch photos in large preview |
| Mouse wheel / zoom buttons | Zoom the large preview in 25% steps |
| Drag the large preview | Move the image after zooming in to view details |
| `Esc` | Close the large preview |
| `Delete` | Move the current preview photo to Recently Deleted |
| Bottom action bar | Select all, batch favorite, delete, restore, or permanently delete |
| Import photos | Choose multiple local image files and copy them into the current album |
| Export all photos | Copy every photo to a selected folder with a progress window |
| Selection bar Export | Copy only the selected photos to a selected folder |

> Normal album deletion moves the original file to the current album's `trash` folder; <span style="color: red;">Permanent deletion in Recently Deleted and Special Cleanup directly delete files from your computer and cannot be restored.</span>

## Recently Deleted and Refresh

- Click Refresh album to sync the folder immediately; the page also syncs when it regains focus and reports newly added or externally removed photos.
- Recently Deleted is sorted by deletion time, with total photo count and total size shown at the top.
- Supports single or batch restore, permanent deletion, select all, large preview, and permanently clearing everything.
- Recently Deleted photos do not expire automatically and remain until restored or manually permanently deleted.


## FAQ

### The launcher does nothing

- Make sure the project has been fully extracted, and do not run it inside the ZIP.
- Make sure Node.js LTS is installed and the `start` folder is not missing.
- Check whether security software blocked the EXE or BAT file.
- You can also run `start\Start-Remote-D1-Website.bat` directly to view error details.

### No photos are displayed

- Make sure you selected the actual image folder.
- Make sure the file extension is supported. Photos whose filenames start with a date use that date; other photos use the file's last modified time.
- If browser authorization expires, click Choose / restore album folder again.

### The browser refuses to open a folder

Browsers block web pages from accessing system folders. Please select `NikkiPhotos_HighQuality` directly, and <span style="color: red;">do not select the drive root or a high-level game install directory.</span>

## Privacy and Safety

- Photos are read locally in your browser.
- Photo-tail extraction, account-key derivation, AES decryption, and CameraParams parsing run locally inside WASM; photos and parsed results are not uploaded.
- Album folder authorization and Favorites are stored locally in the current browser; Clear cache in More only clears the `X6Game` authorization and the Outfit Guide “don't show again” state while keeping the current album authorization. Clear data asks for confirmation twice, then clears all website local records and authorizations so the website returns to first-open state.
- Browser security policies may require folder authorization again.
- Delete and Special Cleanup modify real files on your computer; Clear cache and Clear data do not delete real photos, `clothe`, `trash`, or other files on your computer.

## Local Setup for Developers

Most users should use the online version first. Download the project only when you need to study the code, customize it, or debug it locally.

Requirements: Windows, [Node.js LTS](https://nodejs.org/), and the latest desktop version of Chrome, Edge, or another compatible Chromium browser.

### Install Node.js

1. Open the [Node.js website](https://nodejs.org/), download the Windows installer marked **LTS**, and do not choose the Current version.
2. Run the installer with the default options, and make sure the `Add to PATH` option is not disabled.
3. After installation, close and reopen terminals, project folders, and launcher windows so the environment variables take effect.
4. Press `Win + R`, enter `cmd`, and run:

```bash
node -v
npm -v
```

Both commands should print version numbers, which means installation succeeded. If Windows says the command is not recognized, restart the computer and try again; if it still fails, uninstall Node.js and reinstall the LTS version.

### Study Code or Run Locally

1. Download and extract the project from [GitHub Releases](https://github.com/sumopenny/Infinity-Nikki-Album-Manager/releases) or [Gitee Releases](https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager/releases), or clone the source repository.
2. Double-click `网站启动器.exe` in the project root.
3. On first run, dependencies are installed automatically and `http://localhost:5173` opens.
4. Keep the window open while using it.

If the launcher is unavailable, double-click `start\Start-Remote-D1-Website.bat`, or use the development commands below to start manually. The root `网站启动器.exe` also uses this remote D1 launcher.

To run the local site against the online D1 data, double-click `start\Start-Remote-D1-Website.bat`. It proxies only `/api` requests to the deployed Pages API, so the browser never receives D1 credentials. Like actions from this local site write to the online database; use this launcher carefully. The script defaults to `https://infinity-nikki-album-manager.pages.dev`, and accepts another Pages URL as its first argument.

### Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Refresh poses and bilingual catalogs, then start the dev server
set REMOTE_API_ORIGIN=https://infinity-nikki-album-manager.pages.dev
npm run dev:remote # Also refresh poses and catalogs before proxying /api to the online D1 API
npm test          # Run automated tests
npm run build     # Type-check and build
npm run build:cloudflare # Refresh normal poses and item catalogs, then build
npm run preview   # Preview the build result
```

The generated photo resource catalog is included in the build. To refresh light, filter, and Momo-pose resources from `nikki_albums` together with the NikkiGallery normal-pose catalog, run:

```bash
npm run resources:update -- --manifest ../nikki_albums/app_api/hot_update.json
```

The command decrypts and converts `v1.db` and the language resources, then reads the NikkiGallery pose API during the update step. The deployed site only reads the generated static catalog and does not call the pose API or parse hot-update files at runtime.

To refresh the Chinese and English item and makeup catalogs used by outfit-code parsing separately, run:

```bash
npm run resources:update:items
```

The command reads `item.json` and `makeup.json` for both languages from the `master` branch of `dastrokes/gongeo.us-nikki-tracker`, validates them, and atomically replaces `src/data/itemCatalog.json`. By default, a timeout, HTTP error, or validation failure keeps the existing catalog and lets the build continue; `npm run resources:update:items -- --strict` makes synchronization failures return a non-zero exit code. Item images are still loaded at runtime from `cdn.gongeo.us`; the build updates the ID and name mapping only.

Set the Cloudflare Pages build command to `npm run build:cloudflare` and keep the output directory as `dist`. Each build checks the NikkiGallery pose version and fetches the latest Chinese and English item catalogs. If an upstream request times out, returns an error, or fails validation, the build keeps the catalog committed in the repository and continues. Upstream changes do not trigger Cloudflare Pages builds by themselves, so use a scheduled job or Deploy Hook to run deployments periodically. To roll back to a fully offline and reproducible build, change the Cloudflare build command back to `npm run build`.

Optional environment variables: `NIKKIGALLERY_API_BASE` overrides the pose API root, `NIKKIGALLERY_API_TIMEOUT_MS` adjusts the pose request timeout, `GONGEO_CATALOG_BASE_URL` overrides the raw item-catalog JSON base URL, and `GONGEO_CATALOG_TIMEOUT_MS` adjusts the item-catalog request timeout. Run `npm run resources:update:poses -- --strict` and `npm run resources:update:items -- --strict` for strict synchronization checks.

`npm run dev` does not connect to the remote database. Remote mode only proxies the deployed Pages API. Wrangler is needed only for remote migrations or Cloudflare deployment commands, not for starting the remote-backed local website.

Running `npm run dev` or `npm run dev:remote` first checks and updates the NikkiGallery normal-pose catalog and the Chinese and English item/makeup catalogs, then starts Vite. On synchronization failure, the scripts keep the existing catalogs and continue by default. This does not run a full production build or update light, filter, and Momo-pose resources.

Stack: Vue 3, TypeScript, Vite, File System Access API, IndexedDB.

---


---

## Support the Author

This site is a labor of love and took real effort to build. If you find it useful, you can support me here~

<div align="center">
  <img src="img/wx.jpg" alt="WeChat Pay" width="30%">
  <img src="img/zfb.jpg" alt="Alipay" width="30%">
</div>
