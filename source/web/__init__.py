from fastapi import FastAPI, Query, Response
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import requests
import warnings
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

from ..application import XHS
from ..module import Settings, logging, ERROR, HEADERS

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "web"


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


def create_web_app(xhs: XHS) -> FastAPI:
    app = FastAPI(title="XHS-Downloader Web")

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
    ):
        try:
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
            if not isinstance(note, dict) or not note.get("作品ID"):
                return JSONResponse(
                    {"error": "数据解析失败"},
                    status_code=400,
                )

            return {
                "id": note.get("作品ID", ""),
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
            }

        except Exception as e:
            logging(None, f"Web API 错误: {e}", ERROR)
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/web/api/proxy")
    def proxy_media(url: str = Query(...)):
        try:
            clean_url = url.strip()
            headers = HEADERS.copy()
            headers["accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            
            resp = requests.get(clean_url, headers=headers, verify=False, timeout=30)
            resp.raise_for_status()
            content_type = resp.headers.get("Content-Type", "image/png")
            
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                    "Content-Length": str(len(resp.content)),
                },
            )
        except requests.exceptions.HTTPError as e:
            return JSONResponse({"error": f"HTTP错误: {e.response.status_code}"}, status_code=e.response.status_code)
        except requests.exceptions.RequestException as e:
            return JSONResponse({"error": f"请求错误: {str(e)}"}, status_code=502)
        except Exception as e:
            logging(None, f"代理请求失败: {e}", ERROR)
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
        app = create_web_app(xhs)
        config = Config(app, host=host, port=port, log_level=log_level)
        server = Server(config)
        print(f"\n  [Web 界面已启动] http://localhost:{port}/web/")
        print(f"  [按 Ctrl+C 停止服务]\n")
        await server.serve()