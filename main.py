from asyncio import run
from asyncio.exceptions import CancelledError
from contextlib import suppress
from sys import argv

from source.web import run_web_server


async def web_server(
    host="0.0.0.0",
    port=5001,
    log_level="info",
):
    await run_web_server(
        host=host,
        port=port,
        log_level=log_level,
    )


if __name__ == "__main__":
    with suppress(
        KeyboardInterrupt,
        CancelledError,
    ):
        if len(argv) > 1 and argv[1].upper() == "WEB":
            run(web_server())
        else:
            print("请使用 'python main.py WEB' 启动 Web 服务")