# NikkiCube

<div align="center">
  <img src="img/wxnn.ico" alt="Nikki³ NikkiCube" width="72" height="72">
  <p><strong>Nikki³ · Infinity Nikki Toolkit</strong></p>
  <p>NikkiCube manages albums, outfit codes, home schemes, camera parameters and resonance records in your browser, with optional resonance cloud sync and targeted cleanup.</p>
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
### Official site: https://nikki3.pages.dev/

### Use it online (toolkit): https://infinity-nikki-album-manager.pages.dev/

> Toolkit Vercel fallback (VPN may be required): https://infinity-nikki-album-manager.vercel.app
>
> For local deployment, download the archive or clone the project. Jump to the local deployment guide: [Local installation](#local-installation)

---
## Website and UI

<div align="center">
  <img src="img/1.webp" alt="Nikki³ official site home page: overview and feature list" width="46%">
  <p><sub>Official home page: site overview, feature list, and UI previews, with the entry into the toolkit</sub></p>
</div>

### Browsing the album

<div align="center">
  <img src="img/2.webp" alt="Main interface: photo timeline" width="49%">
  <img src="img/3.webp" alt="Large preview: zoom, pan, and keyboard paging" width="49%">
  <p><sub>Left · Main interface: photo timeline grouped by year / month / day ｜ Right · Large preview: 50%–300% zoom, pan, and keyboard paging</sub></p>
</div>

### Outfit codes

<div align="center">
  <img src="img/9.webp" alt="Outfit codes: plans, tags, and pending plans" width="49%">
  <img src="img/10.webp" alt="Outfit editor: add an image, enter a code, and pick a tag" width="49%">
  <p><sub>Left · Outfit codes: plan list, tags, and pending plans ｜ Right · Outfit editor: add an image, enter a code, and pick a tag</sub></p>
</div>

### Home schemes

<div align="center">
  <img src="img/11.webp" alt="Home schemes: home codes and combo codes scheme list" width="49%">
  <img src="img/12.webp" alt="Home scheme editor: enter a home code, combo code, and pick a tag" width="49%">
  <p><sub>Left · Home schemes: manage home codes, combo codes, tags, and the scheme list ｜ Right · Home scheme editor: enter a home code, combo code, and pick a tag</sub></p>
</div>

### Parsing and cleanup

<div align="center">
  <img src="img/4.webp" alt="Outfit code parsing: item and makeup catalog lookup" width="49%">
  <img src="img/13.webp" alt="Outfit item details: outfit, item, and dye information" width="49%">
  <p><sub>Left · Outfit code parsing: item and makeup catalog lookup ｜ Right · Outfit item details: outfit, item, and dye information</sub></p>
</div>

### Small tools

<div align="center">
  <img src="img/7.webp" alt="Photo parameter parsing: capture time, weather, focal length, aperture, poses, lights, and filters" width="35%">
  <img src="img/5.webp" alt="Special cleanup: low-quality images, crash snapshots, runtime logs, and web cache" width="63%">
  <p><sub>Left · Photo parameter parsing: capture time, weather, focal length, aperture, normal poses, lights, and filters ｜ Right · Special cleanup: low-quality images, crash snapshots, runtime logs, and the game's built-in browser cache</sub></p>
</div>

## Features

### Browsing the album

Browse photos by date, with large previews, favorites, searchable notes, and batch import/export.

### Outfit codes and parameter parsing

Manage outfits and home schemes, parse outfit codes and photo parameters, and organize collections with tags and ZIP backups.

### Personal wardrobe

Outfit and piece card images use `img/back.png` as their shared background. Desktop outfit cards automatically fill the available width with a 160px minimum and 16px gaps, fitting six columns in a 1040px content area. Piece and mobile layouts are unchanged.

Wardrobe and Resonance share the Add data / Clear local records / Export data controls and import dialog, including bookmark and console credential guides. Both entry points open the same Add data window. After previewing, Import resonance records and Import wardrobe records appear in one row, with paste success shown only in the top notification, both selected by default, using the same rounded selection style as the date selection button. In both places, a checkmark appears only when selected; hovering only highlights the border. Confirmation replaces only selected modules; importing both commits them together. Data types absent from a file are disabled, and confirmation is disabled when neither is selected. Clearing the wardrobe requires confirmation and does not affect Resonance records. Device-storage labels and their accompanying timestamp are hidden in the wardrobe UI; storage behavior is unchanged.

On desktop, wardrobe categories and filters sit below the global navigation in the existing scrollable sidebar with the shared custom dropdown styling; open menus render outside the sidebar to avoid clipping. Both layouts use the top-bar search for names or IDs; mobile uses the header search button, without an additional wardrobe search field. Switching between outfits and pieces resets all filters, sorting and the search query.

The Resonance menu now includes **Personal wardrobe**. Open it from the desktop sidebar submenu or switch to it within Resonance on mobile. The first version tracks clothes only, with Outfit / Piece views and a separate card for every original, glow-up and evolution variant. Search names or IDs, filter rarity, variant, category, and ownership. Outfit and piece details are read-only, showing parts and collection status without manual editing or batch management. Outfit covers use the artwork's 448:656 aspect ratio without cropping, removing side gaps caused by the previous ratio and the inline image baseline gap. Piece images are unchanged.

Wardrobe data stays in the current browser and supports dedicated JSON backup / restore. Importing the CN notebook or a wardrobe backup shows a preview before replacing the entire wardrobe. Pieces absent from the notebook are **unrecorded**, not necessarily missing in game. Raw notebook JSON is supported; resonance-only exports are not. This version excludes makeup and cloud sync. Wardrobe data is included in the all-data ZIP and also supports its own JSON backup. Clearing site data also clears the wardrobe.

Desktop resonance filters, pose sorting and wardrobe menus share floating positioning outside the sidebar to prevent clipping. The sidebar remains scrollable; outer scrolling or resizing closes the menu.

### Resonance records

Import, view and analyze resonance records, with JSON import/export and account-based cloud sync.

On desktop (≥900px), the outfit artwork remains on the left, with the first and second sets shown simultaneously in two stacked sections on the right. Each set's recorded pulls and known-piece average appear above its pieces, which wrap in narrower windows. No set switching is needed; the combined total and average remain below the outfit title.

### File cleanup

Clean up low-quality photos, game screenshots, crash snapshots, logs and caches.

### Tools and help

Lucky pull times, release history, usage help and issue feedback.

## Quick Start

Official site: https://nikki3.pages.dev/. Open https://infinity-nikki-album-manager.pages.dev/ directly to use the toolkit. You can also download the archive or clone the project to run it locally. Jump to the local deployment guide: [Local installation](#local-installation).

> If the China-accessible site is temporarily unavailable, try the Vercel fallback (VPN required): https://infinity-nikki-album-manager.vercel.app

## Mobile usage

- Use bottom navigation to switch between Outfit codes, Home schemes, Camera parameters, and Resonance. Album directory access and file cleanup require a desktop browser.
- The header provides Search, View settings, and More. Tag or rarity entries filter, + adds, and the ⋯ menu provides actions such as import and export.
- Large previews support horizontal swipes, pinch-to-zoom, and panning.
- Resonance records can be manually uploaded to the cloud, then synced by signing in to the same account on another device; sign-in and local edits do not sync automatically.
- In the mobile layout (≤899px), resonance cards use a small outfit summary above a full-width piece grid: five columns, or four below 360px. The original combined total and average for both sets appear below the banner name and above owned progress; they remain unchanged when switching sets and wrap on narrow screens. First/second set buttons above the grid update the owned progress, recorded pulls, and known-piece average for that set. Manual entries count only toward owned progress; unknown pull statistics show “—”.
- Outfits, home schemes, and camera favorites can be exported as a full-data ZIP on a computer, manually transferred to a phone, and then imported.
- On phones, each empty module shows a usage screenshot below its description. The empty-state import button is removed; import remains available in the “⋯” menu. Search/filter results with no matches do not show screenshots, and desktop behavior is unchanged. Place the images at `img/page/outfits.webp` (outfit codes), `img/page/home.webp` (home schemes), `img/page/camera.webp` (camera parameters), and `img/page/resonance.webp` (resonance records). Images keep their full aspect ratio and are hidden if missing or unable to load. Rebuild and redeploy after adding or replacing these assets.

## Loading and network requests

- Home schemes, Wardrobe, Resonance and large dialogs load on demand, with a retry action if a module download fails. Downloads exceeding 15 seconds and cached module-download errors offer a Reload page action. A download completing later respects the current dialog state and does not reopen a closed dialog. The full-backup picker still opens synchronously; ZIP processing loads when importing or exporting.
- You can switch modules while a saved album directory is being read. Outfit and home-scheme migration waits for pending writes and keeps the existing write lock. Background restoration preserves your selected view; the initial game-directory outfit scan waits until you enter Outfit codes.
- Public catalog lists load the first six images eagerly, prioritizing the first one, and lazy-load later images. Main detail images load eagerly. Failed images show a retry icon that supports pointer and keyboard activation. Existing image sources, sizes and formats are retained; no image transformation service is enabled.
- Outfit piece details display the name and image immediately, then add relationships and dye information from the local catalog. Only related outfit names need a remote request; unused piece-detail requests are removed. Remote failures offer a retry action that keeps an already loaded image visible when its URL is unchanged.
- Outfit-code and Wardrobe item details use the source image's 520×724 aspect ratio and scale proportionally to fit the viewport. Images remain complete, without cropping or stretching, with rounded borders fitted to the image. The catalog-loading message above the detail content is removed; pending fields show “Loading…”. The dye column follows the available detail data, without reserving extra columns or space for the outfit link.
- Public catalog detail requests share in-flight work by entity and language. Cancelling one caller leaves other callers running. Successful responses are cached for five minutes; errors and invalid bodies are not cached. The deployed proxy bounds upstream reading and exposes Server-Timing; the local Vite proxy still forwards directly.
- Enable catalog diagnostics with `sessionStorage.setItem('nikki-catalog-diagnostics', '1')` and inspect `[catalog-timing]`. Disable with `sessionStorage.removeItem('nikki-catalog-diagnostics')`. Logs contain only stages, status and elapsed time.

## Outfit Code Management
On desktop, entering Outfit codes opens a standalone guide according to your saved preference; the guide button beside the title can also open it. Phones show neither the guide entry nor an automatic guide dialog.
- You can create up to 40 user tags, and each tag can contain up to 5 characters. Deleting a tag in use only moves related plans to Uncategorized.
- New tags appear at the top of the tag list; drag the left handle to adjust the order.
- Click Add outfit to select, drag and drop, or paste an image (click an empty area in the dialog and press `Ctrl+V`). Images prefer local WebP conversion, falling back to validated originals, the outfit code can be empty, each plan can use one tag, and double-clicking the image opens the preview.
- On desktop, the decode button appears in the upper-right corner of each outfit card; on mobile, use the decode button at the bottom of the card. The button stays disabled until a code is entered. The delete button sits to the left of the decode button and appears when the card is hovered or the button receives keyboard focus.
- Open the shared Parameter / outfit-code parser from the upper-right Tools menu and enter a code without creating a plan first; results open in the same decoder dialog.
- Outfit decoding keeps the existing local WASM and object-storage source. After deployment, the Pages Function can cache complete, valid successful bodies up to 1 MiB for one hour at the current Cloudflare location. Hits skip the upstream request; failures are never cached. Other locations may still fetch upstream, and unavailable caches fall back to fetching. The local Vite proxy does not use this cache. Browser HTTP responses remain uncacheable; existing memory and IndexedDB result lifetimes are unchanged, and clearing local caches does not purge edge entries.
- Successful results display without waiting for the background IndexedDB write. A failed write does not affect the current result; closing the page immediately may prevent persistence. Clearing caches drains already-started writes and prevents old requests from writing back.
- To diagnose decoding, run `sessionStorage.setItem('nikki-lookbook-diagnostics', '1')` in the browser console, retry, and inspect `[lookbook-timing]` for local-cache, WASM download/initialization, response headers/body, decoding, and persistence durations. Codes and raw payloads are not logged. Disable with `sessionStorage.removeItem('nikki-lookbook-diagnostics')`. The deployed endpoint exposes `X-Outfit-Cache: HIT/MISS` and `Server-Timing` for cache lookup and upstream headers/body/total durations; hits omit historical upstream timings. Production cache behavior requires verification after deployment.
- If every code immediately returns 502 with `upstream_total;dur=0`, check server-runtime compatibility before assuming an invalid code or network timeout. The immediate failure caused by Cloudflare rejecting `redirect: 'error'` has been fixed in source. Redeploy Pages Functions to apply the fix; clearing browser caches does not replace deployment.
- The outfit preview toolbar shows the current tag and outfit code, with Copy and Edit buttons.
- Outfit codes, images, notes and tags are stored in the current browser and shared across albums. No new album `clothe` folder is required. Use the collection ZIP or Import all data for batch migration.
- Selecting an album migrates its old `clothe` data. The old folder is cleaned only after successful migration and source verification. Damaged data, unassociated images and unknown files remain with a notice; loose images are not converted into plans automatically.
- Using the <span style="color: orange;">auto update outfit code</span> feature requires authorizing the current game's `X6Game` folder. You can authorize it from the Current album menu in the upper-right corner. <span style="color: red;">How to use: in the game, tap Share, tap the selection button at the lower-right corner of the outfit screenshot, tap Generate Outfit Code after the selection is complete, then return to the web page. The website imports only when both the outfit code is new and the game's outfit image has a newer last-modified time; existing codes, unchanged images, or missing images are skipped with a status message.</span>

<div align="center">
  <img src="img/自动更新步骤.webp" alt="In-game steps for auto-updating outfit codes" width="70%">
</div>

- Export data downloads ZIP backups through the browser, with the save location determined by the browser's download settings and no album folder required; large datasets produce multiple ZIP files, so allow multiple downloads. Backups preserve outfit codes, tags, notes, and creation times. Import data does not overwrite existing plans, and duplicate or invalid content is skipped; imports validate the complete backup first, then extract and write images in batches to reduce browser memory use with large backups.
- Images are read and validated locally, with WebP preferred and validated originals retained when needed. Images are never uploaded.
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

Do not select the C drive, Program Files, the game install root, or other protected or overly broad parent directories.

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
- Recently Deleted is sorted by deletion time, with total photo count and total size shown at the top; it supports single or batch restore, permanent deletion, select all, large preview, and clearing everything.
- When restoring, if a file with the same name exists in the original album, suffixes like `_restored_1` and `_restored_2` are used automatically without overwriting existing photos.
- Recently Deleted photos do not expire automatically and remain until restored or manually permanently deleted.

## FAQ

### The launcher does nothing

- Make sure the project has been fully extracted, and do not run it inside the ZIP.
- Make sure Node.js LTS version 22 or newer is installed and the `start` folder is not missing.
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
- Resonance cloud sync contacts this site’s Pages service. Manual upload stores resonance records in cloud D1 without uploading local photos. Other collections remain browser-stored; cloud sync covers resonance only.
- Photo-tail extraction, account-key derivation, AES decryption, and CameraParams parsing run locally inside WASM; photos and parsed results are not uploaded.
- Album folder authorization, Favorites, and outfit-code, home-scheme-code, and photo-action parse results are stored locally in the current browser. Clear cache in More clears these three parse caches without affecting other authorizations, settings, saved schemes or tags. After confirmation, Clear data permanently deletes all schemes, images, tags, resonance records, favorites, parse caches, UIDs, saved directory handles, game sources and migration records in this browser. It also clears local and session settings, then automatically reloads back to the initial state for each platform. This cannot be undone; export a backup first. This preserves cloud accounts and saves without actively signing out. Clearing site data through browser settings may also remove local records and login credentials; uploaded cloud saves remain.
- Browser security policies may require folder authorization again.
- Delete and Special Cleanup modify real files on your computer; Clear cache and Clear data do not delete files on your computer.

## Local installation

Requirements: Windows, [Node.js LTS version 22 or newer](https://nodejs.org/), and the latest desktop version of Chrome, Edge, or another compatible Chromium browser.

### Install Node.js

1. Open the [Node.js website](https://nodejs.org/), download the Windows installer for version 22 or newer marked **LTS**, and do not choose the Current version.
2. Run the installer with the default options, and make sure the `Add to PATH` option is not disabled.
3. After installation, close and reopen terminals, project folders, and launcher windows so the environment variables take effect.
4. Press `Win + R`, enter `cmd`, and run:

```bash
node -v
npm -v
```

Both commands should print version numbers, which means installation succeeded. If Windows says the command is not recognized, restart the computer and try again; if it still fails, uninstall Node.js and reinstall the LTS version.

### Local deployment

1. Download and extract the project from [GitHub Releases](https://github.com/sumopenny/Infinity-Nikki-Album-Manager/releases) or [Gitee Releases](https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager/releases), or clone the source repository.
2. Double-click `网站启动器.exe` in the project root.
3. On first run, dependencies are installed automatically. The browser opens `http://localhost:5173` only after resource updates finish and the dev server successfully starts listening. It does not open during updates or after a startup failure or port conflict; check the dev server window for errors.
4. Keep the window open while using it.

Local startup uses remote D1 mode exclusively; the standalone launcher without D1 has been removed. If the launcher is unavailable, double-click `start\Start-Remote-D1-Website.bat`, or use the development commands below to start manually. The root `网站启动器.exe` also uses this remote D1 launcher.

The local site uses online D1 data; double-click `start\Start-Remote-D1-Website.bat`. The local server proxies outfit-code data, home-scheme data, and Gongeo catalog details directly to their upstream services; Likes, resonance accounts and cloud-sync requests go to the deployed Pages API, so the browser never receives D1 credentials. Production deployments expose same-origin data proxies at `functions/api/gongeo/[[path]].ts` and `functions/api/home-build/[key].ts`. Likes, resonance registration, uploads and cloud deletion affect the target site’s real cloud data; check the target address first. The script defaults to `https://infinity-nikki-album-manager.pages.dev`, and accepts another Pages URL as its first argument.

### Development Commands

Internally, `useOperationCoordinator` tracks module work and `useLatestRequest` invalidates stale reads. `useDirectorySession` and `useOutfitWorkspace` handle directory authorization and outfit operations. Home and Outfit storage share commit/rollback handling in `file-system/transaction.ts`. Pose resource request timeouts cover response body reading.

`App.vue` retains page composition, startup, and coordination across modules. `useAppPreferences`, `useGameCleanup`, and `usePhotoTrashActions` manage display preferences, game-directory cleanup, and trash operations respectively. They reuse the existing operation lock and shared state without adding a global store; large modules remain loaded on demand.

Development and local Pages/D1 commands use the exact Wrangler 4.149.0 dev dependency and require Node.js 22 or newer. Use `npm ci` to install from the lockfile. `dev:pages`, `d1:migrate:local`, and `d1:migrate:remote` no longer download latest on each run.

Handwritten Vue, TypeScript, CSS, resource scripts, tests and startup dependency scripts share pinned Prettier. Run `npm run format` to format or `npm run format:check` to check; the old `format:review` commands remain compatibility aliases. Generated catalog JSON, the dependency lockfile and build output are excluded. Shared button, menu and reduced-motion rules live in `src/styles/controls.css`.

Home operations distinguish permission, storage capacity, image, data, and tag conflicts. Console diagnostics contain only the operation and error category, without raw exceptions or credentials. The Resonance submenu follows the selected language.

```bash
npm install       # Install dependencies
set REMOTE_API_ORIGIN=https://infinity-nikki-album-manager.pages.dev
npm run dev:remote # Refresh poses, lights/filters, item catalogs, and Gongeo mappings; proxy outfit and home-scheme data to storage and other /api calls to Pages
npm test          # Run automated tests
npm run build     # Type-check and build
npm run build:cloudflare # Refresh normal poses, lights/filters, item catalogs, and Gongeo mappings, then build
npm run resources:update:light-filters # Check light/filter updates separately
npm run preview   # Preview the build result
```

The local EXE launcher, `dev`, `dev:remote`, and Cloudflare builds share the resource update chain. Lights/filters check database and bilingual language-pack versions in Nikki Albums' remote hot-update manifest. Changed versions trigger downloads and validation; only light/filter names, ID mappings, and image templates are replaced, preserving normal poses and Momo data. Matching versions skip resource downloads. Failures print a warning and keep the existing snapshot. Standard `npm run build` only type-checks and builds.

Resource updates first check HTTPS_PROXY/HTTP_PROXY (including lowercase names), then enabled manual Windows system proxies. Only reachable local HTTP/HTTPS proxies are used; common ports are not scanned. With no configured or listening proxy, requests connect directly. A proxy connection failure or timeout triggers one direct attempt and switches subsequent requests in that process to direct access. HTTP errors and validation failures are not retried. Failed updates retain local resources and startup continues; explicit --strict mode still fails. NO_PROXY is respected, with local addresses bypassed by default. Detection applies only to resource-update requests and does not change system proxy settings, npm configuration or website API forwarding. PAC and SOCKS settings are not detected.

The light/filter script accepts `--force` to refresh, `--strict` to fail on errors, and `--manifest <URL>` / `--timeout <milliseconds>`. Environment overrides are `NUAN5_HOT_UPDATE_MANIFEST` for the remote manifest URL and `NUAN5_HOT_UPDATE_TIMEOUT_MS` for the timeout (15000 milliseconds by default). When passing options through npm, put `--` before them.

Local item-catalog generation requires an explicit Gongeo checkout path (or `GONGEO_ROOT`), for example `node scripts/generate-item-catalog.cjs "C:/path/to/gongeo"`. Remote synchronization still uses `npm run resources:update:items`. When rebuilding the launcher, `start/launcher/Build-Launcher.ps1` compiles a temporary file and replaces the launcher only on success; compilation failure preserves the old launcher.

Stack: Vue 3, TypeScript, Vite, File System Access API, IndexedDB.

---

## Acknowledgements and License

Some features were inspired by and use the related services of [Nikki Albums](https://github.com/RanAxro/nikki_albums) and [Gongeo.us Nikki Tracker](https://github.com/dastrokes/gongeo.us-nikki-tracker). Please refer to the root [LICENSE](LICENSE) file for this project's license.

Outfit images are copied into memory immediately upon selection; preview and saving use that copy if the original mobile file reference later becomes unreadable. Confirmation waits while “Reading image…” is shown; select the file again if reading fails. Image decoding failures are reported without extra Data URL reads, hashing or diagnostic decoding.

Image memory copies apply only in compact layouts (viewport width ≤899px). Desktop layouts (≥900px) preview and save the original selected file without an eager copy. The layout at selection time determines the path.

Camera favorite cover uploads also copy selected images into memory only in compact layouts. Saving waits for reading; failures ask for reselection, and stale results after replacement or closing are discarded. Desktop layouts continue using the original file.

Camera favorite cover reading is shown in the top operation notice, followed by completion or failure. The bottom Save favorite button retains its label and remains disabled during reading.

Camera parameter favorites and resonance cloud upload/delete work over LAN HTTP. Concurrent home tag additions preserve tags from other tabs; schemes remain editable after a tag is deleted. Photo and scheme actions wait until the next preview finishes loading. While editing a note, arrow keys, Delete and Escape do not operate the preview underneath, and Tab stays inside the note dialog. Closing or switching the parameter dialog prevents old tasks from overwriting its new state.

Unexpected cloud API failures produce structured logs containing the operation, stage, error category and a server-generated request ID. The error response's `X-Request-Id` correlates with the log. Logs omit accounts, tokens, request bodies and raw exceptions.

Image read recovery: a persistent status near the image explains reading or failure. Saving waits during reading. Failed replacements retain the previous image; camera favorites can save without an optional cover, while new outfits still require an image. Reselecting the same file retries reading.
On desktop, date, tag and resonance lists scroll independently when they exceed the available sidebar height, while the module navigation stays fixed. On mobile, scrolling remains inside the filter dialog.

### Image selection and storage compatibility

- Outfit, home, and camera favorite pickers accept images the browser can preview. Mobile layouts snapshot file bytes before validation; reading, decoding, size, and pixel checks run before replacing the previous image. Failed selections retain the previous image and can be retried with the same file.
- Saving prefers WebP. If encoding fails or returns another format, the validated original is retained. WebP, PNG, JPEG, GIF, BMP, and AVIF are supported with MIME types and extensions derived from file signatures. HEIC/HEIF still require browser decoding and successful WebP conversion; selecting a format does not guarantee it can be saved.
- Outfit and home backups preserve original-format images and still import older WebP backups. Mixed-format backups require the updated app. Camera backups preserve cover bytes and formats.
- Returning from a system picker does not refresh inactive camera favorites or a module with an open dialog. Outfit selection is independent of background reads, while saving still prevents replacement.
- Home and camera covers load near the viewport with a visibility fallback and release image URLs offscreen. Images explicitly fill their frames while keeping existing aspect ratios and centered cropping. Ordinary error messages remain; temporary debug panels are removed.

Resonance regression tests check statistic labels and values, sidebar outfit names and rarity separately, and unknown ownership in the detail dialog, without depending on decorative separators or removed elements.

Outfit codes, home codes, camera parameters, and data-import scripts share clipboard compatibility handling. The system API is preferred; when unavailable on LAN HTTP or rejected, text-selection copying is attempted. Temporary elements are removed and focus restored. Browser restrictions can still cause failure, which is reported normally.

Top notifications dismiss after 3 seconds for success, 5.2 seconds for info, and 6 seconds for warnings and errors. Loading notices stay visible; hovering pauses the timer.

The personal wardrobe shows an inline loading state and offers Retry if loading fails or takes longer than 15 seconds. Refresh the page if retries keep failing.

Catalog images in resonance records and the sidebar, wardrobe, outfit/item details and outfit parsing set `no-referrer` before assigning the image URL to prevent the initial request from sending a page referrer that triggers CDN hotlink protection. Temporary image diagnostics and image proxy fallbacks have been removed; Safari device verification is still required.

On mobile (≤899px), item details in the wardrobe and outfit parser fit their content without reserving empty rows. Long content scrolls within the body while the title and close button remain visible. Desktop layouts are unchanged.

On mobile (≤899px), the outfit-code parser also fits its content. Long item lists scroll within the body while the title, close button and item-count footer remain visible. Desktop layouts are unchanged.
