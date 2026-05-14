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
from ..module import Settings, logging, ERROR, HEADERS, WebRecorder, FILE_SIGNATURES

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
        # 移除非法字符，并将空格替换为下划线，确保 URL 兼容性
        name = str(name).strip()
        name = re.sub(r'[\\/:*?"<>| ]', '_', name)
        return name
    
    today_dir = get_today_cache_dir()
    today_str = datetime.now().strftime("%Y%m%d")
    
    if note_info:
        author = clean_name(note_info.get('author', '未知作者'))
        time_str = clean_name(note_info.get('time', '未知时间'))
        title = clean_name(note_info.get('title', '无标题'))[:20]
        # 去掉可能导致编码问题的非 ASCII 字符，仅保留语义部分（可选，但为了安全建议保留）
        # 这里我们保持原样，但确保 re.sub 已经处理了非法字符
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        
        ext = filename.split('.')[-1] if '.' in filename else 'png'
        suffix = "_cover" if "_cover" in filename else ""
        filename = f"{author}_{time_str}_{title}{suffix}_{url_hash}.{ext}"
    else:
        url_hash = hashlib.md5(url.encode()).hexdigest()
        ext = filename.split('.')[-1] if '.' in filename else 'jpg'
        filename = f"proxy_{url_hash}.{ext}"

    file_path = today_dir / filename
    relative_path = f"{today_str}/{filename}"

    if file_path.exists() and not force_refresh:
        if recorder:
            await recorder.add_url_cache(url, relative_path)
        return f"/web/cache/{relative_path.replace('\\', '/')}"
    
    try:
        headers = HEADERS.copy()
        # 强制增加 referer，防止小红书 403
        headers["referer"] = "https://www.xiaohongshu.com/"
        if filename.endswith(('.png', '.jpg', '.jpeg', '.webp')):
             headers["accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        
        response = requests.get(url, headers=headers, verify=False, timeout=30)
        if response.status_code == 200:
            content = response.content
            
            # 根据二进制签名校验真实后缀
            real_ext = None
            for offset, signature, ext_name in FILE_SIGNATURES:
                if content[offset:offset+len(signature)] == signature:
                    real_ext = ext_name
                    break
            
            # 如果真实后缀和预期不符（特别是 HEIC），修正文件名
            if real_ext and not file_path.name.endswith(f".{real_ext}"):
                # 如果是 HEIC 但我们要的是 PNG/JPG，说明 auto 模式导致了不兼容
                if real_ext == "heic":
                    logging(None, f"检测到 HEIC 格式: {url}，建议在设置中切换为 WebP/JPEG 以兼容电脑端", 30) # WARNING level
                
                filename = filename.rsplit('.', 1)[0] + f".{real_ext}"
                file_path = today_dir / filename
                relative_path = f"{today_str}/{filename}"

            async with aiofiles.open(file_path, mode='wb') as f:
                await f.write(content)
            
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
    # 增加 html=True 和 follow_symlinks=True 以增强兼容性
    app.mount("/web/cache", StaticFiles(directory=str(CACHE_DIR.absolute())), name="cache")

    @app.get("/web/")
    @app.get("/web/index.html")
    async def index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/web/static/{path:path}")
    async def static_files(path: str):
        file_path = STATIC_DIR / path
        if file_path.exists():
            return FileResponse(str(file_path))
        return JSONResponse({"error": "File not found"}, status_code=404)

    @app.get("/web/api/note")
    async def get_note(
        url: str = Query(..., description="小红书作品链接"),
        cookie: str = Query("", description="Cookie"),
        proxy: str = Query("", description="代理地址"),
        image_format: str = Query("webp", description="图片格式"),
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
                "likeCount": int(note.get("点赞数量") or 0),
                "collectCount": int(note.get("收藏数量") or 0),
                "commentCount": int(note.get("评论数量") or 0),
                "shareCount": int(note.get("分享数量") or 0),
                "tags": note.get("作品标签", ""),
                "time": note.get("发布时间", ""),
                "images": _parse_images(note),
                "videos": _parse_videos(note),
                "cover": _get_cover(note),
                "raw_cover": _get_cover(note), # 保留原始封面供移动端直连
                "url": url
            }

            # 自动缓存封面（带上作品信息进行命名优化）
            if data["cover"]:
                ext = "png" if data["type"] == "图文" else "jpg"
                cache_url = await download_to_cache(data["cover"], f"{note_id}_cover.{ext}", data, recorder, force_refresh=refresh)
                data["cover"] = cache_url

            # 预先为作品中的所有媒体建立缓存映射，并更新返回的 URL 为本地路径
            for img in data["images"]:
                img["raw_url"] = img["url"] # 保留原始 URL
                cache_url = await download_to_cache(img["url"], f"{note_id}_img.png", data, recorder, force_refresh=refresh)
                if cache_url.startswith("/web/cache"):
                    img["url"] = cache_url
                    
            for vid in data["videos"]:
                vid["raw_url"] = vid["url"] # 保留原始 URL
                cache_url = await download_to_cache(vid["url"], f"{note_id}_vid.mp4", data, recorder, force_refresh=refresh)
                if cache_url.startswith("/web/cache"):
                    vid["url"] = cache_url

            # 保存到历史记录（此时 data 中的 URL 已经是本地缓存路径了）
            await recorder.add_history(note_id, data, data["authorId"], data["author"], url)

            return data

        except Exception as e:
            # 修正：直接传入 print 作为 log 回调函数，防止 logging 内部 func = log() 报错
            logging(lambda: print, f"Web API 错误: {e}", ERROR)
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

    @app.delete("/web/api/history/{note_id}")
    async def delete_history(note_id: str):
        await recorder.delete_history(note_id)
        return {"status": "success"}

    @app.delete("/web/api/cache")
    async def delete_cache(url: str = Query(...)):
        """物理删除缓存文件并清理数据库记录"""
        try:
            cached_path = await recorder.get_url_cache(url)
            if cached_path:
                full_path = CACHE_DIR / cached_path
                if full_path.exists():
                    os.remove(full_path)
                # 从数据库 url_cache 表中删除
                await recorder.delete_url_cache(url)
            return {"status": "success"}
        except Exception as e:
            logging(None, f"物理删除失败 {url}: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/web/api/note/update")
    async def update_note(payload: dict = Body(...)):
        note_id = payload.get("note_id")
        data = payload.get("data")
        if note_id and data:
            await recorder.update_note_data(note_id, data)
            return {"status": "success"}
        return JSONResponse({"error": "Invalid payload"}, status_code=400)

    @app.get("/web/api/proxy")
    async def proxy_media(url: str = Query(...)):
        try:
            clean_url = url.strip()
            if not clean_url.startswith('http'):
                return JSONResponse({"error": "Invalid URL"}, status_code=400)
            
            # 1. 优先从数据库查询缓存路径（支持跨日期查找）
            cached_path = await recorder.get_url_cache(clean_url)
            if cached_path:
                full_path = CACHE_DIR / cached_path
                if full_path.exists():
                    # 检查文件大小，如果太小可能是损坏的
                    if full_path.stat().st_size > 100:
                        return FileResponse(str(full_path))
                    else:
                        os.remove(full_path) # 删除损坏的文件

            # 2. 如果数据库没有，则下载并存入“今天”的目录
            today_dir = get_today_cache_dir()
            today_str = datetime.now().strftime("%Y%m%d")
            
            url_hash = hashlib.md5(clean_url.encode()).hexdigest()
            cache_name = f"proxy_{url_hash}.jpg"
            file_path = today_dir / cache_name
            relative_path = f"{today_str}/{cache_name}"
            
            headers = HEADERS.copy()
            headers["referer"] = "https://www.xiaohongshu.com/"
            headers["accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            
            resp = requests.get(clean_url, headers=headers, verify=False, timeout=30)
            if resp.status_code != 200:
                return JSONResponse({"error": f"Failed to fetch image: {resp.status_code}"}, status_code=resp.status_code)
            
            content = resp.content
            if len(content) < 100:
                return JSONResponse({"error": "Empty or invalid image content"}, status_code=502)

            # 校验真实后缀并修正 cache_name
            real_ext = "jpg"
            for offset, signature, ext_name in FILE_SIGNATURES:
                if content[offset:offset+len(signature)] == signature:
                    real_ext = ext_name
                    break
            
            if real_ext != "jpg":
                cache_name = f"proxy_{url_hash}.{real_ext}"
                file_path = today_dir / cache_name
                relative_path = f"{today_str}/{cache_name}"

            # 保存到硬盘
            async with aiofiles.open(file_path, mode='wb') as f:
                await f.write(content)
            
            # 记录到数据库
            await recorder.add_url_cache(clean_url, relative_path)
            
            return Response(
                content=content,
                media_type=f"image/{real_ext}",
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
        except Exception as e:
            # 修正：直接传入 print 作为 log 回调函数，防止 logging 内部 func = log() 报错
            logging(lambda: print, f"代理缓存失败: {e}", ERROR)
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
