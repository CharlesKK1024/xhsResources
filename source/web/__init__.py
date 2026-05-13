from fastapi import FastAPI, Query, Response, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import requests
import warnings
import aiofiles
import os
import json
from typing import List, Optional

warnings.filterwarnings('ignore', message='Unverified HTTPS request')

from ..application import XHS
from ..module import Settings, logging, ERROR, HEADERS, WebRecorder

from datetime import datetime
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = ROOT / "static" / "web"
CACHE_DIR = ROOT / "Cache"


def get_today_cache_dir() -> Path:
    """获取今天的缓存目录：Cache/YYYYMMDD/"""
    today = datetime.now().strftime("%Y%m%d")
    path = CACHE_DIR / today
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    return path


async def download_to_cache(url: str, filename: str, note_info: dict = None, recorder: WebRecorder = None, force_refresh: bool = False) -> str:
    """下载并缓存文件，返回本地路径或 URL"""
    # 1. 先查数据库有没有这个 URL 的缓存
    if recorder and not force_refresh:
        cached_path = await recorder.get_url_cache(url)
        if cached_path:
            full_path = CACHE_DIR / cached_path
            if full_path.exists():
                return f"/web/cache/{cached_path.replace('\\', '/')}"

    # 2. 如果是强制刷新，先尝试删除旧的物理文件记录
    if recorder and force_refresh:
        old_path = await recorder.get_url_cache(url)
        if old_path:
            full_old_path = CACHE_DIR / old_path
            if full_old_path.exists():
                try:
                    os.remove(full_old_path)
                except:
                    pass
            await recorder.delete_url_cache(url)

    # 3. 优化命名规则：作者_时间_标题_哈希.后缀
    def clean_name(name):
        return re.sub(r'[\\/:*?"<>|]', '_', str(name))
    
    today_dir = get_today_cache_dir()
    today_str = datetime.now().strftime("%Y%m%d")
    
    if note_info:
        author = clean_name(note_info.get('author', '未知作者'))
        time_str = clean_name(note_info.get('time', '未知时间'))
        title = clean_name(note_info.get('title', '无标题'))[:20]
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        
        ext = filename.split('.')[-1]
        suffix = "_cover" if "_cover" in filename else ""
        filename = f"{author}_{time_str}_{title}{suffix}_{url_hash}.{ext}"
    else:
        url_hash = hashlib.md5(url.encode()).hexdigest()
        ext = filename.split('.')[-1]
        filename = f"proxy_{url_hash}.{ext}"

    file_path = today_dir / filename
    relative_path = f"{today_str}/{filename}"

    if file_path.exists() and not force_refresh:
        if recorder:
            await recorder.add_url_cache(url, relative_path)
        return f"/web/cache/{relative_path.replace('\\', '/')}"
    
    try:
        headers = HEADERS.copy()
        if filename.endswith(('.png', '.jpg', '.jpeg', '.webp')):
             headers["accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        
        response = requests.get(url, headers=headers, verify=False, timeout=30)
        if response.status_code == 200:
            async with aiofiles.open(file_path, mode='wb') as f:
                await f.write(response.content)
            
            if recorder:
                await recorder.add_url_cache(url, relative_path)
                
            return f"/web/cache/{relative_path.replace('\\', '/')}"
    except Exception as e:
        logging(None, f"缓存失败 {url}: {e}", ERROR)
    
    return url


def _parse_images(note: dict) -> list:
    urls = note.get("下载地址", [])
    if not urls:
        return []
    return [{"url": u, "index": i + 1} for i, u in enumerate(urls)]


def _parse_videos(note: dict) -> list:
    urls = note.get("下载地址", [])
    if not urls:
        return []
    return [{"url": urls[0]}]


def _get_cover(note: dict) -> str:
    urls = note.get("下载地址", [])
    return urls[0] if urls else ""


def create_web_app(xhs: XHS, recorder: WebRecorder) -> FastAPI:
    app = FastAPI(title="XHS-Downloader Web")

    # 1. 启动前强制创建缓存目录，确保挂载成功
    if not CACHE_DIR.exists():
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    # 2. 挂载静态服务（/web/cache 对应硬盘上的 Cache 文件夹）
    app.mount("/web/cache", StaticFiles(directory=str(CACHE_DIR)), name="cache")

    @app.get("/web/")
    @app.get("/web/index.html")
    async def index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/web/static/{filename}")
    async def static_files(filename: str):
        file_path = STATIC_DIR / filename
        if file_path.exists():
            return FileResponse(str(file_path))
        return JSONResponse({"error": "File not found"}, status_code=404)

    @app.get("/web/api/note")
    async def get_note(
        url: str = Query(..., description="小红书作品链接"),
        cookie: str = Query("", description="Cookie"),
        proxy: str = Query("", description="代理地址"),
        image_format: str = Query("auto", description="图片格式"),
        video_preference: str = Query("resolution", description="视频偏好"),
        refresh: bool = Query(False, description="是否强制刷新"),
    ):
        try:
            # 如果不是强制刷新，先看数据库有没有这个 URL
            if not refresh:
                history = await recorder.get_history_by_url(url)
                if history:
                    return history["data"]
            else:
                # 强制刷新：先尝试清理旧的媒体缓存
                old_history = await recorder.get_history_by_url(url)
                if old_history:
                    old_data = old_history["data"]
                    # 清理封面
                    if old_data.get("cover"):
                        await download_to_cache(old_data["cover"], "", recorder=recorder, force_refresh=True)
                    # 清理图片
                    for img in old_data.get("images", []):
                        await download_to_cache(img["url"], "", recorder=recorder, force_refresh=True)
                    # 清理视频
                    for vid in old_data.get("videos", []):
                        await download_to_cache(vid["url"], "", recorder=recorder, force_refresh=True)

            xhs.manager.image_format = image_format
            xhs.manager.video_preference = video_preference
            if proxy:
                xhs.manager.proxy = proxy

            result = await xhs.extract(url, download=False, data=True)

            if not result or not isinstance(result, list) or not result[0]:
                return JSONResponse(
                    {"error": "无法获取作品数据，请检查链接或 Cookie"},
                    status_code=400,
                )

            note = result[0]
            note_id = note.get("作品ID")
            if not note_id:
                return JSONResponse({"error": "数据解析失败"}, status_code=400)

            # 构造返回数据
            data = {
                "id": note_id,
                "title": note.get("作品标题", ""),
                "desc": note.get("作品描述", ""),
                "author": note.get("作者昵称", ""),
                "authorId": note.get("作者ID", ""),
                "type": note.get("作品类型", ""),
                "likeCount": int(note.get("点赞数量", 0)),
                "collectCount": int(note.get("收藏数量", 0)),
                "commentCount": int(note.get("评论数量", 0)),
                "shareCount": int(note.get("分享数量", 0)),
                "tags": note.get("作品标签", ""),
                "time": note.get("发布时间", ""),
                "images": _parse_images(note),
                "videos": _parse_videos(note),
                "cover": _get_cover(note),
                "url": url
            }

            # 自动缓存封面（带上作品信息进行命名优化）
            if data["cover"]:
                ext = "png" if data["type"] == "图文" else "jpg"
                cache_url = await download_to_cache(data["cover"], f"{note_id}_cover.{ext}", data, recorder, force_refresh=refresh)
                data["cover"] = cache_url

            # 预先为作品中的所有媒体建立缓存映射（命名优化）
            for img in data["images"]:
                await download_to_cache(img["url"], f"{note_id}_img.png", data, recorder, force_refresh=refresh)
            for vid in data["videos"]:
                await download_to_cache(vid["url"], f"{note_id}_vid.mp4", data, recorder, force_refresh=refresh)

            # 保存到历史记录（带上原始 URL 供缓存判断）
            await recorder.add_history(note_id, data, data["authorId"], data["author"], url)

            return data

        except Exception as e:
            logging(None, f"Web API 错误: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/history")
    async def get_history(
        search: Optional[str] = None,
        sort: str = "time_desc"
    ):
        return await recorder.get_history(search, sort)

    @app.get("/web/api/collection")
    async def get_collection(
        search: Optional[str] = None,
        tag: Optional[str] = None
    ):
        return await recorder.get_collections(search, tag)

    @app.post("/web/api/star")
    async def toggle_star(payload: dict = Body(...)):
        note_id = payload.get("note_id")
        is_starred = payload.get("is_starred", 0)
        await recorder.update_star(note_id, is_starred)
        return {"status": "success"}

    @app.post("/web/api/tag")
    async def update_tags(payload: dict = Body(...)):
        note_id = payload.get("note_id")
        tags = payload.get("tags", "")
        await recorder.update_tags(note_id, tags)
        return {"status": "success"}

    @app.get("/web/api/proxy")
    async def proxy_media(url: str = Query(...)):
        try:
            clean_url = url.strip()
            
            # 1. 优先从数据库查询缓存路径（支持跨日期查找）
            cached_path = await recorder.get_url_cache(clean_url)
            if cached_path:
                full_path = CACHE_DIR / cached_path
                if full_path.exists():
                    return FileResponse(str(full_path))

            # 2. 如果数据库没有，则下载并存入“今天”的目录
            today_dir = get_today_cache_dir()
            today_str = datetime.now().strftime("%Y%m%d")
            
            import hashlib
            url_hash = hashlib.md5(clean_url.encode()).hexdigest()
            cache_name = f"proxy_{url_hash}.jpg"
            file_path = today_dir / cache_name
            relative_path = f"{today_str}/{cache_name}"
            
            # 再次检查物理文件是否存在
            if file_path.exists():
                await recorder.add_url_cache(clean_url, relative_path)
                return FileResponse(str(file_path))

            headers = HEADERS.copy()
            headers["accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            
            resp = requests.get(clean_url, headers=headers, verify=False, timeout=30)
            resp.raise_for_status()
            
            # 保存到硬盘
            async with aiofiles.open(file_path, mode='wb') as f:
                await f.write(resp.content)
            
            # 记录到数据库
            await recorder.add_url_cache(clean_url, relative_path)
            
            content_type = resp.headers.get("Content-Type", "image/png")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
        except Exception as e:
            logging(None, f"代理缓存失败: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=502)

    return app


async def run_web_server(
    host: str = "0.0.0.0",
    port: int = 5001,
    log_level: str = "info",
):
    from uvicorn import Config, Server

    settings = Settings().run()
    async with XHS(**settings) as xhs:
        async with WebRecorder(xhs.manager) as recorder:
            app = create_web_app(xhs, recorder)
            config = Config(app, host=host, port=port, log_level=log_level)
            server = Server(config)
            print(f"\n  [Web 界面已启动] http://localhost:{port}/web/")
            print(f"  [按 Ctrl+C 停止服务]\n")
            await server.serve()
