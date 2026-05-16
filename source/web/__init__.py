from fastapi import FastAPI, Query, Response, Body, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import requests
import warnings
import aiofiles
import os
import json
import uuid
from typing import List, Optional

warnings.filterwarnings('ignore', message='Unverified HTTPS request')

from ..application import XHS
from ..module import Settings, logging, ERROR, HEADERS, WebRecorder, FILE_SIGNATURES
from ..expansion import Converter

from datetime import datetime
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = ROOT / "static" / "web"
CACHE_DIR = ROOT / "Cache"


def _normalize_media_url(url: str) -> str:
    """规范化媒体地址，避免 HTTPS 页面内嵌 HTTP 资源导致黑屏。"""
    if not url:
        return ""
    if "xhscdn.com" in url and url.startswith("http://"):
        return "https://" + url[len("http://"):]
    return url


def get_today_cache_dir(user_name: str = "default") -> Path:
    """获取今天的缓存目录：Cache/photos/{user_name}/YYYYMMDD/"""
    today = datetime.now().strftime("%Y%m%d")
    path = CACHE_DIR / "photos" / user_name / today
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    return path


async def download_to_cache(url: str, filename: str, note_info: dict = None, recorder: WebRecorder = None, force_refresh: bool = False, user_name: str = "default") -> str:
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
    
    today_dir = get_today_cache_dir(user_name)
    today_str = datetime.now().strftime("%Y%m%d")
    
    if note_info:
        author = clean_name(note_info.get('author', '未知作者'))
        time_str = clean_name(note_info.get('time', '未知时间'))
        title = clean_name(note_info.get('title', '无标题'))[:20]
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        
        ext = filename.split('.')[-1] if '.' in filename else 'png'
        suffix = "_cover" if "_cover" in filename else ""
        filename = f"{author}_{time_str}_{title}{suffix}_{url_hash}.{ext}"
    else:
        url_hash = hashlib.md5(url.encode()).hexdigest()
        ext = filename.split('.')[-1] if '.' in filename else 'jpg'
        filename = f"proxy_{url_hash}.{ext}"

    file_path = today_dir / filename
    relative_path = f"photos/{user_name}/{today_str}/{filename}"

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
                relative_path = f"photos/{user_name}/{today_str}/{filename}"

            async with aiofiles.open(file_path, mode='wb') as f:
                await f.write(content)
            
            if recorder:
                await recorder.add_url_cache(url, relative_path)
                
            return f"/web/cache/{relative_path.replace('\\', '/')}"
    except Exception as e:
        logging(None, f"缓存失败 {url}: {e}", ERROR)
    
    return url


def _parse_images(note: dict) -> list:
    """从 note 数据中解析图片列表，包含 Live 图支持"""
    # 如果是纯视频作品，不应该有图片列表（除非是视频的第一帧）
    if note.get("作品类型") == "视频":
        return []
        
    # 小红书原始数据中：
    # "下载地址" 存放的是图片 URL 列表
    # "动图地址" 存放的是 Live 图视频 URL 列表（如果有）
    images = note.get("下载地址", [])
    live_links = note.get("动图地址", [])
    
    # 如果是字符串，说明还没被拆分成列表（防御性处理）
    if isinstance(images, str):
        images = images.split()
    if isinstance(live_links, str):
        live_links = live_links.split()
    
    parsed = []
    for i, url in enumerate(images):
        # 排除掉 NaN 这种占位符
        if not url or url == "NaN":
            continue
            
        item = {"url": _normalize_media_url(url), "index": i + 1}
        # 匹配对应的 Live 图视频链接
        if i < len(live_links) and live_links[i] and live_links[i] != "NaN":
            item["live_url"] = _normalize_media_url(live_links[i])
        parsed.append(item)
    return parsed


def _parse_videos(note: dict) -> list:
    # 只有当作品类型确实是 "视频" 时，才返回视频列表
    # 如果是 Live 图（图文类型），视频链接已经在 images 里处理了，这里不重复返回
    if note.get("作品类型") != "视频":
        return []
        
    urls = note.get("下载地址", [])
    if isinstance(urls, str):
        urls = urls.split()
        
    if not urls or urls[0] == "NaN":
        return []
    return [{"url": _normalize_media_url(urls[0])}]


def _get_cover(note: dict) -> str:
    # 优先使用我们在 app.py 中新增的 "封面" 字段
    cover = note.get("封面") or (note.get("下载地址", [])[0] if note.get("下载地址") else "")
    return _normalize_media_url(cover)


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
        token: str = Query("", description="用户令牌"),
    ):
        try:
            # 解析 token 获取 user_id 和 user_name
            user_id = 1
            user_name = "default"
            if token:
                user_data = await recorder.get_user_by_token(token)
                if user_data:
                    user_id = user_data["id"]
                    user_name = user_data["nickname"] or "default"
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
                        await download_to_cache(old_data["cover"], "", recorder=recorder, force_refresh=True, user_name=user_name)
                    # 清理图片
                    for img in old_data.get("images", []):
                        await download_to_cache(img["url"], "", recorder=recorder, force_refresh=True, user_name=user_name)
                    # 清理视频
                    for vid in old_data.get("videos", []):
                        await download_to_cache(vid["url"], "", recorder=recorder, force_refresh=True, user_name=user_name)

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

            # 【调试代码】保存原始数据结构到文件
            try:
                debug_path = Path("f:/AIcoding/XHSresources/xhsResources/debug_note.json")
                debug_data = {
                    "result_length": len(result),
                    "note_keys": list(note.keys()) if isinstance(note, dict) else str(type(note)),
                    "note": note,
                    "full_result": result,
                }
                with open(debug_path, "w", encoding="utf-8") as f:
                    json.dump(debug_data, f, ensure_ascii=False, indent=4)
                print(f"DEBUG: 原始数据已保存至 {debug_path}")
            except Exception as e:
                print(f"DEBUG: 保存失败 {e}")

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
                "raw_cover": _get_cover(note),
                "ipLocation": note.get("IP归属地", ""),
                "url": url
            }

            # 自动缓存封面（带上作品信息进行命名优化）
            if data["cover"]:
                ext = "png" if data["type"] == "图文" else "jpg"
                cache_url = await download_to_cache(data["cover"], f"{note_id}_cover.{ext}", data, recorder, force_refresh=refresh, user_name=user_name)
                data["cover"] = cache_url

            # 预先为作品中的所有媒体建立缓存映射，并更新返回的 URL 为本地路径
            for img in data["images"]:
                img["raw_url"] = img["url"] # 保留原始 URL
                # 如果是 Live 图，识别其视频部分
                live_url = img.get("live_url")
                if live_url:
                    img["raw_live_url"] = live_url
                    # 缓存 Live 图的视频部分
                    cache_live_url = await download_to_cache(live_url, f"{note_id}_live_{img['index']}.mp4", data, recorder, force_refresh=refresh, user_name=user_name)
                    img["live_url_cached"] = cache_live_url

                cache_url = await download_to_cache(img["url"], f"{note_id}_img_{img['index']}.png", data, recorder, force_refresh=refresh, user_name=user_name)
                if cache_url.startswith("/web/cache"):
                    img["url"] = cache_url
                    
            for vid in data["videos"]:
                vid["raw_url"] = vid["url"] # 保留原始 URL
                cache_url = await download_to_cache(vid["url"], f"{note_id}_vid.mp4", data, recorder, force_refresh=refresh, user_name=user_name)
                if cache_url.startswith("/web/cache"):
                    vid["url"] = cache_url

            # 保存到历史记录（此时 data 中的 URL 已经是本地缓存路径了）
            await recorder.add_history(note_id, data, data["authorId"], data["author"], url, user_id=user_id)

            return data

        except Exception as e:
            # 修正：直接传入 print 作为 log 回调函数，防止 logging 内部 func = log() 报错
            logging(lambda: print, f"Web API 错误: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/history")
    async def get_history(
        search: Optional[str] = None,
        sort: str = "time_desc",
        token: str = Query("", description="用户令牌"),
    ):
        user_id = None
        include_legacy = False
        if token:
            user_data = await recorder.get_user_by_token(token)
            if user_data:
                user_id = user_data["id"]
                if user_data.get("nickname") == "龙哥":
                    include_legacy = True
        return await recorder.get_history(search, sort, user_id, include_legacy)

    @app.get("/web/api/collection")
    async def get_collection(
        search: Optional[str] = None,
        tag: Optional[str] = None,
        token: str = Query("", description="用户令牌"),
    ):
        user_id = None
        include_legacy = False
        if token:
            user_data = await recorder.get_user_by_token(token)
            if user_data:
                user_id = user_data["id"]
                if user_data.get("nickname") == "龙哥":
                    include_legacy = True
        return await recorder.get_collections(search, tag, user_id, include_legacy)

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

    @app.get("/web/api/history/by-tag")
    async def get_history_by_tag(
        tag: str = Query(..., description="标签名"),
        author_id: str = Query("", description="优先作者ID"),
        token: str = Query("", description="用户令牌"),
    ):
        user_id = None
        include_legacy = False
        if token:
            user_data = await recorder.get_user_by_token(token)
            if user_data:
                user_id = user_data["id"]
                if user_data.get("nickname") == "龙哥":
                    include_legacy = True
        return await recorder.get_history_by_tag(tag, author_id, user_id, include_legacy)

    @app.get("/web/api/history/by-location")
    async def get_history_by_location(
        location: str = Query(..., description="IP归属地省份名"),
        token: str = Query("", description="用户令牌"),
    ):
        user_id = None
        include_legacy = False
        if token:
            user_data = await recorder.get_user_by_token(token)
            if user_data:
                user_id = user_data["id"]
                if user_data.get("nickname") == "龙哥":
                    include_legacy = True
        return await recorder.get_history_by_location(location, user_id, include_legacy)

    @app.get("/web/api/history/location-stats")
    async def get_location_stats(
        token: str = Query("", description="用户令牌"),
    ):
        user_id = None
        include_legacy = False
        if token:
            user_data = await recorder.get_user_by_token(token)
            if user_data:
                user_id = user_data["id"]
                if user_data.get("nickname") == "龙哥":
                    include_legacy = True
        stats = await recorder.get_location_stats(user_id, include_legacy)
        return {"stats": stats}

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
            today_dir = get_today_cache_dir("default")
            today_str = datetime.now().strftime("%Y%m%d")
            
            url_hash = hashlib.md5(clean_url.encode()).hexdigest()
            cache_name = f"proxy_{url_hash}.jpg"
            file_path = today_dir / cache_name
            relative_path = f"photos/default/{today_str}/{cache_name}"
            
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
                relative_path = f"photos/default/{today_str}/{cache_name}"

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

    # ---- 用户管理 API ----

    AVATAR_DIR = CACHE_DIR / "Avatars"
    if not AVATAR_DIR.exists():
        AVATAR_DIR.mkdir(parents=True, exist_ok=True)

    def _hash_password(password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    @app.post("/web/api/user/login")
    async def user_login(payload: dict = Body(...)):
        try:
            nickname = payload.get("nickname", "").strip()
            password = payload.get("password", "").strip()
            token = payload.get("token", "").strip()

            if not nickname and not token:
                return JSONResponse({"error": "请提供昵称或密码"}, status_code=400)

            # 如果有 token，尝试自动登录
            if token:
                user = await recorder.get_user_by_token(token)
                if user:
                    return user
                return JSONResponse({"error": "令牌无效，请重新登录"}, status_code=401)

            if not nickname:
                return JSONResponse({"error": "请提供昵称"}, status_code=400)
            if not password:
                return JSONResponse({"error": "请提供密码"}, status_code=400)

            # 检查昵称是否已存在
            existing_user = await recorder.get_user_by_nickname(nickname)
            if existing_user:
                # 已有用户 → 验证密码
                stored_hash = existing_user.get("password_hash", "")
                if not stored_hash:
                    # 旧用户没有密码，首次登录设置密码
                    password_hash = _hash_password(password)
                    await recorder.database.execute(
                        "UPDATE users SET password_hash = ?, token = ? WHERE id = ?",
                        (password_hash, str(uuid.uuid4()), existing_user["id"]),
                    )
                    await recorder.database.commit()
                    # 重新获取用户（含新 token）
                    existing_user = await recorder.get_user_by_nickname(nickname)
                    return {
                        "id": existing_user["id"],
                        "nickname": existing_user["nickname"],
                        "avatar_url": existing_user["avatar_url"],
                        "theme": existing_user["theme"],
                        "token": existing_user["token"],
                        "is_new": False,
                    }
                if stored_hash != _hash_password(password):
                    return JSONResponse({"error": "密码错误"}, status_code=401)
                # 密码正确，返回已有用户
                return {
                    "id": existing_user["id"],
                    "nickname": existing_user["nickname"],
                    "avatar_url": existing_user["avatar_url"],
                    "theme": existing_user["theme"],
                    "token": existing_user["token"],
                    "is_new": False,
                }

            # 新用户注册
            password_hash = _hash_password(password)
            new_token = str(uuid.uuid4())
            user = await recorder.create_user(nickname, new_token, password_hash)
            user["is_new"] = True
            return user

        except Exception as e:
            logging(lambda: print, f"用户登录失败: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/web/api/user/reset-password")
    async def reset_password(payload: dict = Body(...)):
        try:
            nickname = payload.get("nickname", "").strip()
            if not nickname:
                return JSONResponse({"error": "请提供昵称"}, status_code=400)

            user = await recorder.get_user_by_nickname(nickname)
            if not user:
                return JSONResponse({"error": "用户不存在"}, status_code=404)

            new_token = str(uuid.uuid4())
            await recorder.database.execute(
                "UPDATE users SET password_hash = '', token = ? WHERE id = ?",
                (new_token, user["id"]),
            )
            await recorder.database.commit()

            return {
                "status": "success",
                "message": "密码已重置，请用任意密码登录",
                "token": new_token,
            }
        except Exception as e:
            logging(lambda: print, f"重置密码失败: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/author/avatar")
    async def get_author_avatar(
        author_id: str = Query("", description="作者ID"),
        token: str = Query("", description="用户令牌"),
    ):
        try:
            if not author_id:
                return JSONResponse({"error": "缺少作者ID"}, status_code=400)
            user_id = None
            if token:
                user = await recorder.get_user_by_token(token)
                if user:
                    user_id = user["id"]
            cover_url = await recorder.get_author_first_cover(author_id, user_id)
            return {"cover": cover_url}
        except Exception as e:
            logging(lambda: print, f"获取作者头像失败: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/author/search")
    async def search_authors(
        name: str = Query("", description="作者名关键字"),
        token: str = Query("", description="用户令牌"),
    ):
        if not name.strip():
            return []
        user_id = None
        include_legacy = False
        if token:
            user = await recorder.get_user_by_token(token)
            if user:
                user_id = user["id"]
                if user.get("nickname") == "龙哥":
                    include_legacy = True
        results = await recorder.search_authors(name.strip(), user_id, include_legacy)
        return results

    @app.get("/web/api/author/notes")
    async def get_author_notes(
        author_id: str = Query(..., description="作者ID"),
        cookie: str = Query("", description="小红书Cookie"),
        proxy: str = Query("", description="代理"),
        token: str = Query("", description="用户令牌"),
    ):
        try:
            user_id = None
            include_legacy = False
            if token:
                user = await recorder.get_user_by_token(token)
                if user:
                    user_id = user["id"]
                    if user.get("nickname") == "龙哥":
                        include_legacy = True

            profile_url = f"https://www.xiaohongshu.com/user/profile/{author_id}"

            # 直接用 httpx 客户端请求，不走 retry 装饰器（避免重试加重封禁）
            headers = xhs.html.headers.copy()
            if cookie:
                headers["Cookie"] = cookie
            try:
                from httpx import HTTPError
                response = await xhs.manager.request_client.get(
                    profile_url, headers=headers,
                )
                status = response.status_code
                if status == 429 or status == 403:
                    return JSONResponse(
                        {"error": f"小红书访问受限 (HTTP {status})，请稍后再试或更换 Cookie"},
                        status_code=400,
                    )
                if status == 461:
                    return JSONResponse(
                        {"error": "触发小红书安全验证，请在浏览器中打开小红书完成验证后重试"},
                        status_code=400,
                    )
                if status >= 400:
                    return JSONResponse(
                        {"error": f"主页请求失败 (HTTP {status})"},
                        status_code=400,
                    )
                html = response.text
            except HTTPError as e:
                return JSONResponse(
                    {"error": f"网络请求异常: {e}"},
                    status_code=400,
                )

            if not html or len(html) < 500:
                return JSONResponse(
                    {"error": "主页返回内容为空，请检查 Cookie 是否有效"},
                    status_code=400,
                )

            converter = Converter()
            raw_text = converter._extract_object(html)
            if not raw_text:
                return JSONResponse(
                    {"error": "主页数据解析失败，页面可能需要登录"},
                    status_code=400,
                )
            state = converter._convert_object(raw_text)
            if not state:
                return JSONResponse(
                    {"error": "主页 JSON 解析失败"},
                    status_code=400,
                )

            note_ids = set()
            def extract_note_ids(obj):
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        if k == "noteId" and isinstance(v, str) and len(v) > 10:
                            note_ids.add(v)
                        else:
                            extract_note_ids(v)
                elif isinstance(obj, list):
                    for item in obj:
                        extract_note_ids(item)

            extract_note_ids(state)

            if not note_ids:
                return JSONResponse(
                    {"error": "未在主页中找到作品，可能需要登录 Cookie"},
                    status_code=400,
                )

            existing = await recorder.get_existing_note_ids(user_id, include_legacy)
            new_ids = [nid for nid in note_ids if nid not in existing]
            urls = [
                f"https://www.xiaohongshu.com/explore/{nid}"
                for nid in new_ids
            ]

            author_name = ""
            def find_author_name(obj):
                nonlocal author_name
                if author_name:
                    return
                if isinstance(obj, dict):
                    if "nickname" in obj and isinstance(obj["nickname"], str):
                        author_name = obj["nickname"]
                        return
                    if "nickName" in obj and isinstance(obj["nickName"], str):
                        author_name = obj["nickName"]
                        return
                    for v in obj.values():
                        find_author_name(v)
                elif isinstance(obj, list):
                    for item in obj:
                        find_author_name(item)

            find_author_name(state)

            return {
                "author_name": author_name,
                "author_id": author_id,
                "total": len(note_ids),
                "new_count": len(new_ids),
                "existing_count": len(note_ids) - len(new_ids),
                "urls": urls,
            }
        except Exception as e:
            logging(lambda: print, f"获取作者作品列表失败: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/author/detail")
    async def get_author_detail(
        author_id: str = Query(..., description="作者ID"),
        token: str = Query("", description="用户令牌"),
    ):
        try:
            if not author_id:
                return JSONResponse({"error": "缺少作者ID"}, status_code=400)
            user_id = None
            include_legacy = False
            if token:
                user = await recorder.get_user_by_token(token)
                if user:
                    user_id = user["id"]
                    if user.get("nickname") == "龙哥":
                        include_legacy = True

            works = await recorder.get_author_detail(author_id, user_id, include_legacy)
            if not works:
                return JSONResponse({"error": "未找到该作者的作品"}, status_code=404)

            author_name = works[0]["data"].get("author", "") if works else ""
            avatar = await recorder.get_author_first_cover(author_id, user_id)

            all_tags = set()
            for w in works:
                tags_str = w["data"].get("tags", "")
                if tags_str:
                    for t in tags_str.replace("[话题]", "").replace("#", " ").split():
                        t = t.strip()
                        if t:
                            all_tags.add(t)

            return {
                "author_name": author_name,
                "author_id": author_id,
                "avatar": avatar,
                "tags": sorted(all_tags),
                "works": works,
            }
        except Exception as e:
            logging(lambda: print, f"获取作者详情失败: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/author/messages")
    async def get_author_messages(
        author_id: str = Query(..., description="作者ID"),
        token: str = Query("", description="用户令牌"),
    ):
        try:
            user_id = None
            if token:
                user = await recorder.get_user_by_token(token)
                if user:
                    user_id = user["id"]
            messages = await recorder.get_messages(author_id, user_id)
            return messages
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/web/api/author/message")
    async def send_author_message(payload: dict = Body(...)):
        try:
            author_id = payload.get("author_id")
            content = payload.get("content", "").strip()
            token = payload.get("token", "")
            if not author_id or not content:
                return JSONResponse({"error": "缺少参数"}, status_code=400)
            user_id = 1
            if token:
                user = await recorder.get_user_by_token(token)
                if user:
                    user_id = user["id"]
            msg_id = await recorder.add_message(author_id, user_id, content)
            return {"status": "success", "id": msg_id}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.delete("/web/api/author/message/{message_id}")
    async def delete_author_message(
        message_id: int,
        token: str = Query("", description="用户令牌"),
    ):
        try:
            user_id = None
            if token:
                user_data = await recorder.get_user_by_token(token)
                if user_data:
                    user_id = user_data["id"]
            await recorder.delete_message(message_id, user_id)
            return {"status": "success"}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/user/profile")
    async def get_user_profile(token: str = Query("", description="用户令牌")):
        try:
            if not token:
                return JSONResponse({"error": "缺少令牌"}, status_code=400)
            user = await recorder.get_user_by_token(token)
            if user:
                return user
            return JSONResponse({"error": "用户不存在"}, status_code=404)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.put("/web/api/user/profile")
    async def update_user_profile(payload: dict = Body(...)):
        try:
            token = payload.get("token", "")
            nickname = payload.get("nickname")
            theme = payload.get("theme")

            if not token:
                return JSONResponse({"error": "缺少令牌"}, status_code=400)

            user = await recorder.get_user_by_token(token)
            if not user:
                return JSONResponse({"error": "用户不存在"}, status_code=404)

            await recorder.update_user_profile(user["id"], nickname=nickname, theme=theme)
            return {"status": "success"}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.post("/web/api/user/avatar")
    async def upload_avatar(token: str = Form(...), file: UploadFile = File(...)):
        try:
            user = await recorder.get_user_by_token(token)
            if not user:
                return JSONResponse({"error": "用户不存在"}, status_code=404)

            nickname = user.get("nickname", "user")
            safe_name = re.sub(r'[\\/:*?"<>| ]', '_', nickname)
            ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
            avatar_name = f"avatar_{safe_name}.{ext}"
            avatar_path = AVATAR_DIR / avatar_name

            content = await file.read()
            async with aiofiles.open(avatar_path, "wb") as f:
                await f.write(content)

            avatar_url = f"/web/cache/Avatars/{avatar_name}"
            await recorder.update_user_avatar(user["id"], avatar_url)
            return {"avatar_url": avatar_url}

        except Exception as e:
            logging(lambda: print, f"头像上传失败: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    return app


async def run_web_server(
    host: str = "0.0.0.0",
    port: int = 5006,
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
