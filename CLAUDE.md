# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XHS-Downloader fork with a custom Web UI. Extracts and downloads content (images, videos, live photos) from Xiaohongshu (RedNote). This fork's `main.py` only supports the WEB mode — the upstream TUI/CLI/API/MCP modes are accessed through the `XHS` class directly.

## Commands

```bash
# Install dependencies (recommended)
uv sync --no-dev

# Run the web server (only supported mode in this fork's main.py)
uv run main.py WEB
# Server starts at http://localhost:5008/web/

# Lint
uv run ruff check .
uv run ruff format --check .

# Format
uv run ruff format .
```

Python >= 3.12 required. Uses `uv` for dependency management (`pyproject.toml` + `uv.lock`).

## Architecture

### Entry Point

`main.py` — only accepts `WEB` argument. Calls `source.web.run_web_server()` which initializes the `XHS` singleton and `WebRecorder`, then starts a FastAPI/uvicorn server on port 5008.

### Core Layer (`source/application/`)

- **`app.py`** — `XHS` class (singleton). Central orchestrator: extracts links from URLs (4 URL patterns), fetches HTML, parses data via `Explore`, resolves download addresses via `Image`/`Video`, downloads via `Download`. Also contains API server (`run_api_server`) and MCP server (`run_mcp_server`) setup — these are upstream features, not exposed by this fork's `main.py`.
- **`explore.py`** — Parses the Namespace data object into a flat dict with Chinese keys (`作品ID`, `作者昵称`, `发布时间`, etc.). This dict is the canonical data format used everywhere.
- **`download.py`** — Async file downloader with semaphore-limited concurrency (`MAX_WORKERS=4`), resume support, and file-type detection via binary signatures.
- **`image.py` / `video.py`** — Extract download URLs from the parsed Namespace for images and videos respectively.
- **`request.py`** — HTTP request wrapper around `httpx.AsyncClient` with retry logic and cookie/proxy support.

### Web Layer (`source/web/`)

Custom to this fork. All backend logic lives in `source/web/__init__.py`. `create_web_app()` builds a FastAPI app with:
- **`/web/api/note`** — Main endpoint: fetches a XHS post by URL, caches all media locally, returns structured JSON. Supports per-user data isolation via token auth.
- **`/web/api/history`**, **`/web/api/collection`** — History browsing and starred collections with search/sort.
- **`/web/api/proxy`** — Media proxy with local caching to avoid CORS/referer issues. Desktop clients route images through this endpoint; mobile clients use direct CDN URLs with `no-referrer`.
- **User management** — Login (nickname + SHA-256 hashed password), avatar upload, profile, password reset (`/web/api/user/*`). Auth is token-based (UUID stored in `users` table).
- **Media caching** — Downloads media to `Cache/photos/{user}/{date}/` with naming based on author/time/title. Cache lookups go through the `url_cache` SQLite table. Binary signature detection corrects file extensions after download.

### Frontend (`static/web/`)

Vanilla HTML/CSS/JS, no build step. Served by FastAPI's `StaticFiles` mount.

- **`index.html`** — Single-page app shell with sidebar nav (提取作品 / 作品集 / 个人收藏), settings panel, login/profile modals, and three viewer overlays.
- **`script.js`** — `XHSWebUI` class: the entire application logic. Manages page routing (`switchPage`), API calls, note rendering, card interactions, and all viewer states. State is held in instance properties (no external store). User settings and auth token persist in `localStorage`.
- **`style.css`** — CSS variables for theming (`data-theme="dark"|"light"`). Uses `vh` units extensively for responsive sizing. Card scaling via `--card-scale` CSS variable.
- **`utils/swipe.js`** — `StackSwipe` class: iOS-task-switcher-style horizontal card stacking with 3D transforms, inertia, and snap-to-card. Instantiated per author row in the data list.
- **`utils/tools.js`** — Loading wave animation generator.
- **`utils/svg.js`** — SVG icon definitions (share icon).
- **`componentUtils/toast.js`** — Global `showToast()` notification system.

#### Frontend key patterns

- **Media URL strategy**: `getMediaUrl()` branches on platform — mobile (iOS/Android) uses raw CDN URLs with `referrerpolicy="no-referrer"` to bypass hotlink protection; desktop routes through `/web/api/proxy` which adds the required `referer` header server-side.
- **Three viewer modes**: Full-screen image viewer (swipe/arrow key navigation), waterfall grid viewer (per-author), and note detail viewer (mimics XHS native UI with pull-down-to-close gesture).
- **Card display modes**: Each author row can toggle between scroll (StackSwipe), wrap (CSS grid), and ring (circular CSS transform layout).
- **Card interactions**: Short press opens note detail overlay; long press (500ms) loads note into extract page; swipe navigates cards. Edit mode toggle shows delete buttons on cards.
- **Clipboard auto-detection**: Non-iOS listens for `focus`/`visibilitychange` to auto-fill XHS links; iOS uses a manual paste button due to Safari permission restrictions.

### Module Layer (`source/module/`)

- **`manager.py`** — `Manager` class. Holds all runtime configuration, HTTP clients (`request_client` for data, `download_client` for files), path management, and cookie/proxy handling.
- **`settings.py`** — Reads/writes `Volume/settings.json`. Auto-creates with defaults on first run, migrates from old locations.
- **`recorder.py`** — Four SQLite recorders, all inheriting from `IDRecorder`:
  - `IDRecorder` — Download history (`ExploreID.db`)
  - `DataRecorder` — Full post metadata (`ExploreData.db`)
  - `MapRecorder` — Author ID-to-nickname mapping (`MappingData.db`)
  - `WebRecorder` — Web UI state: history, collections, URL cache, users (`WebData.db`)
- **`static.py`** — Constants: version, headers, file signatures for type detection, color codes.
- **`model.py`** — Pydantic models for API request/response.
- **`script.py`** — WebSocket server for receiving download tasks from the Tampermonkey userscript.

### Expansion Layer (`source/expansion/`)

- **`converter.py`** — Extracts JSON data from XHS HTML pages.
- **`namespace.py`** — `Namespace` wrapper for nested dict access with `safe_extract("a.b.c")`.
- **`cleaner.py`** — Filename sanitization.
- **`truncate.py`** — String length limiting utilities.

### Translation (`source/translation/`)

Uses Python `gettext`. Locale files in `locale/{zh_CN,en_US}/LC_MESSAGES/xhs.{po,mo}`. All user-facing strings in the core use `_()` for translation. The `switch_language()` function swaps locale at runtime.

## Key Data Flow

1. User provides a XHS URL → `XHS.extract_links()` normalizes it (resolves short links, matches 4 URL patterns)
2. `Html.request_url()` fetches the page HTML
3. `Converter.run()` extracts the embedded JSON from HTML
4. `Namespace()` wraps the JSON for safe nested access
5. `Explore.run()` extracts a flat dict with Chinese keys
6. `Image`/`Video` classes extract download URLs from the Namespace
7. `Download.run()` downloads files with resume support and binary signature-based type detection
8. In Web mode: `source/web` additionally caches media locally and stores history in `WebData.db`

### Web frontend data flow

1. `XHSWebUI.fetchNote()` calls `/web/api/note` with URL, settings, and user token
2. Backend calls `xhs.extract()`, builds a response dict mapping Chinese keys to JSON fields (`作品ID` → `id`, `作者昵称` → `author`, etc.)
3. Backend downloads and caches all media (cover, images, live photos, videos), replacing CDN URLs with local `/web/cache/` paths in the response
4. Frontend stores the note in `this.currentNote` and renders it; history/collection lists are fetched separately and rendered per-author with `renderDataList()`

## Data Storage

- `Volume/settings.json` — Configuration file (auto-created)
- `Volume/ExploreID.db` — Downloaded post IDs (skip duplicates)
- `Volume/Download/ExploreData.db` — Full post metadata
- `Volume/MappingData.db` — Author nickname mappings
- `WebData.db` (project root) — Web UI history, collections, URL cache, users
- `Cache/` — Locally cached media files, organized as `photos/{user}/{date}/`
- `Cache/Avatars/` — User avatar uploads

## Code Style

- Ruff for linting and formatting (line length 88, Python 3.12 target)
- Data fields use Chinese keys throughout the pipeline: `作品ID`, `作者昵称`, `下载地址`, `动图地址`, etc.
- `XHS` is a singleton — only one instance exists
- All recorders use async context managers (`async with`)
- Frontend is zero-dependency vanilla JS — no npm, no bundler, no framework
- Contributions go to the `develop` branch
