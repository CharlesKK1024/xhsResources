from asyncio import CancelledError
from contextlib import suppress
from typing import TYPE_CHECKING
from shutil import move
from aiosqlite import connect
import json
from datetime import datetime

if TYPE_CHECKING:
    from ..module import Manager

__all__ = ["IDRecorder", "DataRecorder", "MapRecorder", "WebRecorder"]


class IDRecorder:
    def __init__(self, manager: "Manager"):
        self.name = "ExploreID.db"
        self.file = manager.root.joinpath(self.name)
        self.changed = False
        self.switch = manager.download_record
        self.database = None
        self.cursor = None

    async def _connect_database(self):
        self.database = await connect(self.file)
        self.cursor = await self.database.cursor()
        await self.database.execute(
            "CREATE TABLE IF NOT EXISTS explore_id (ID TEXT PRIMARY KEY);"
        )
        await self.database.commit()

    async def select(self, id_: str):
        if self.switch:
            await self.cursor.execute("SELECT ID FROM explore_id WHERE ID=?", (id_,))
            return await self.cursor.fetchone()

    async def add(
        self,
        id_: str,
        name: str = None,
        *args,
        **kwargs,
    ) -> None:
        if self.switch:
            await self.database.execute("REPLACE INTO explore_id VALUES (?);", (id_,))
            await self.database.commit()

    async def __delete(self, id_: str) -> None:
        if id_:
            await self.database.execute("DELETE FROM explore_id WHERE ID=?", (id_,))
            await self.database.commit()

    async def delete(self, ids: list[str]):
        if self.switch:
            [await self.__delete(i) for i in ids]

    async def all(self):
        if self.switch:
            await self.cursor.execute("SELECT ID FROM explore_id")
            return [i[0] for i in await self.cursor.fetchmany()]

    async def __aenter__(self):
        self.compatible()
        await self._connect_database()
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        with suppress(CancelledError):
            if self.cursor:
                await self.cursor.close()
        if self.database:
            await self.database.close()

    def compatible(
        self,
    ):
        if (
            not self.changed
            and (old := self.file.parent.parent.joinpath(self.name)).exists()
            and not self.file.exists()
        ):
            move(old, self.file)


class DataRecorder(IDRecorder):
    DATA_TABLE = (
        ("采集时间", "TEXT"),
        ("作品ID", "TEXT PRIMARY KEY"),
        ("作品类型", "TEXT"),
        ("作品标题", "TEXT"),
        ("作品描述", "TEXT"),
        ("作品标签", "TEXT"),
        ("发布时间", "TEXT"),
        ("最后更新时间", "TEXT"),
        ("收藏数量", "TEXT"),
        ("评论数量", "TEXT"),
        ("分享数量", "TEXT"),
        ("点赞数量", "TEXT"),
        ("作者昵称", "TEXT"),
        ("作者ID", "TEXT"),
        ("作者链接", "TEXT"),
        ("作品链接", "TEXT"),
        ("下载地址", "TEXT"),
        ("动图地址", "TEXT"),
    )

    def __init__(self, manager: "Manager"):
        super().__init__(manager)
        self.name = "ExploreData.db"
        self.file = manager.folder.joinpath(self.name)
        self.changed = True
        self.switch = manager.record_data

    async def _connect_database(self):
        self.database = await connect(self.file)
        self.cursor = await self.database.cursor()
        await self.database.execute(f"""CREATE TABLE IF NOT EXISTS explore_data (
        {",".join(" ".join(i) for i in self.DATA_TABLE)}
        );""")
        await self.database.commit()

    async def select(self, id_: str):
        pass

    async def add(self, **kwargs) -> None:
        if self.switch:
            await self.database.execute(
                f"""REPLACE INTO explore_data (
        {", ".join(i[0] for i in self.DATA_TABLE)}
        ) VALUES (
        {", ".join("?" for _ in kwargs)}
        );""",
                self.__generate_values(kwargs),
            )
            await self.database.commit()

    async def __delete(self, id_: str) -> None:
        pass

    async def delete(self, ids: list | tuple):
        pass

    async def all(self):
        pass

    def __generate_values(self, data: dict) -> tuple:
        return tuple(data[i] for i, _ in self.DATA_TABLE)


class MapRecorder(IDRecorder):
    def __init__(self, manager: "Manager"):
        super().__init__(manager)
        self.name = "MappingData.db"
        self.file = manager.root.joinpath(self.name)
        self.switch = manager.author_archive

    async def _connect_database(self):
        self.database = await connect(self.file)
        self.cursor = await self.database.cursor()
        await self.database.execute(
            "CREATE TABLE IF NOT EXISTS mapping_data ("
            "ID TEXT PRIMARY KEY,"
            "NAME TEXT NOT NULL"
            ");"
        )
        await self.database.commit()

    async def select(self, id_: str):
        if self.switch:
            await self.cursor.execute(
                "SELECT NAME FROM mapping_data WHERE ID=?", (id_,)
            )
            return await self.cursor.fetchone()

    async def add(self, id_: str, name: str, *args, **kwargs) -> None:
        if self.switch:
            await self.database.execute(
                "REPLACE INTO mapping_data VALUES (?, ?);",
                (
                    id_,
                    name,
                ),
            )
            await self.database.commit()

    async def __delete(self, id_: str) -> None:
        pass

    async def delete(self, ids: list[str]):
        pass

    async def all(self):
        if self.switch:
            await self.cursor.execute("SELECT ID, NAME FROM mapping_data")
            return [i[0] for i in await self.cursor.fetchmany()]


class WebRecorder(IDRecorder):
    def __init__(self, manager: "Manager"):
        super().__init__(manager)
        self.name = "WebData.db"
        self.file = manager.root.joinpath(self.name)
        self.switch = True

    async def _connect_database(self):
        self.database = await connect(self.file)
        self.cursor = await self.database.cursor()
        await self.database.execute(
            """CREATE TABLE IF NOT EXISTS web_history (
            note_id TEXT PRIMARY KEY,
            note_data TEXT,
            cache_time TEXT,
            is_starred INTEGER DEFAULT 0,
            tags TEXT,
            author_id TEXT,
            author_name TEXT,
            source_url TEXT
            );"""
        )
        await self.database.execute(
            """CREATE TABLE IF NOT EXISTS url_cache (
            url TEXT PRIMARY KEY,
            local_path TEXT,
            cache_date TEXT
            );"""
        )
        await self.database.execute(
            """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL UNIQUE,
            password_hash TEXT DEFAULT '',
            avatar_url TEXT DEFAULT '',
            theme TEXT DEFAULT 'dark',
            token TEXT UNIQUE,
            created_at TEXT
            );"""
        )
        await self.database.commit()
        # 兼容旧数据库：添加缺失的列
        for col in ['source_url', 'user_id']:
            try:
                await self.database.execute(f"ALTER TABLE web_history ADD COLUMN {col} TEXT;")
                await self.database.commit()
            except:
                pass
        # 兼容旧数据库：添加 password_hash 列
        try:
            await self.database.execute("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT '';")
            await self.database.commit()
        except:
            pass
        # 兼容旧数据库：添加 nickname UNIQUE 约束（SQLite 不支持 ALTER ADD CONSTRAINT，用 recreate 太复杂，业务层保证）
        try:
            await self.database.execute("ALTER TABLE users ADD COLUMN nickname TEXT;")
            await self.database.commit()
        except:
            pass

    async def add_history(self, note_id: str, data: dict, author_id: str, author_name: str, source_url: str = None, user_id: int = 1):
        cache_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await self.database.execute(
            "INSERT OR REPLACE INTO web_history (note_id, note_data, cache_time, author_id, author_name, source_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?);",
            (note_id, json.dumps(data, ensure_ascii=False), cache_time, author_id, author_name, source_url, user_id),
        )
        await self.database.commit()

    async def get_history_by_url(self, url: str):
        await self.cursor.execute("SELECT note_data, is_starred, tags FROM web_history WHERE source_url = ?", (url,))
        row = await self.cursor.fetchone()
        if row:
            return {
                "data": json.loads(row[0]),
                "is_starred": bool(row[1]),
                "tags": row[2].split(",") if row[2] else [],
            }
        return None

    async def add_url_cache(self, url: str, local_path: str):
        cache_date = datetime.now().strftime("%Y%m%d")
        await self.database.execute(
            "INSERT OR REPLACE INTO url_cache (url, local_path, cache_date) VALUES (?, ?, ?);",
            (url, local_path, cache_date),
        )
        await self.database.commit()

    async def get_url_cache(self, url: str):
        await self.cursor.execute("SELECT local_path FROM url_cache WHERE url = ?", (url,))
        row = await self.cursor.fetchone()
        return row[0] if row else None

    async def delete_url_cache(self, url: str):
        """删除指定 URL 的数据库记录"""
        await self.database.execute("DELETE FROM url_cache WHERE url = ?;", (url,))
        await self.database.commit()

    async def update_star(self, note_id: str, is_starred: int):
        await self.database.execute(
            "UPDATE web_history SET is_starred = ? WHERE note_id = ?;",
            (is_starred, note_id),
        )
        await self.database.commit()

    async def update_tags(self, note_id: str, tags: str):
        await self.database.execute(
            "UPDATE web_history SET tags = ? WHERE note_id = ?;",
            (tags, note_id),
        )
        await self.database.commit()

    async def delete_history(self, note_id: str):
        """删除指定作品的历史记录"""
        await self.database.execute("DELETE FROM web_history WHERE note_id = ?;", (note_id,))
        await self.database.commit()

    async def update_note_data(self, note_id: str, data: dict):
        """更新作品的 JSON 数据（如修改封面、删除部分媒体）"""
        await self.database.execute(
            "UPDATE web_history SET note_data = ? WHERE note_id = ?;",
            (json.dumps(data, ensure_ascii=False), note_id),
        )
        await self.database.commit()

    async def get_history(self, search: str = None, sort: str = "time_desc", user_id: int = None, include_legacy: bool = False):
        query = "SELECT note_data, cache_time, is_starred, tags FROM web_history"
        params = []
        conditions = []
        
        if user_id is not None:
            if include_legacy:
                conditions.append("(user_id = ? OR user_id IS NULL)")
            else:
                conditions.append("user_id = ?")
            params.append(user_id)
        
        if search:
            conditions.append("(note_data LIKE ? OR tags LIKE ? OR author_name LIKE ?)")
            p = f"%{search}%"
            params.extend([p, p, p])
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        if sort == "time_desc":
            query += " ORDER BY cache_time DESC"
        elif sort == "time_asc":
            query += " ORDER BY cache_time ASC"
        elif sort == "author":
            query += " ORDER BY author_name ASC, cache_time DESC"
            
        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()
        return [
            {
                "data": json.loads(row[0]),
                "cache_time": row[1],
                "is_starred": bool(row[2]),
                "tags": row[3].split(",") if row[3] else [],
            }
            for row in rows
        ]

    async def get_author_first_cover(self, author_id: str, user_id: int = None) -> str:
        """获取该作者第一个缓存作品的封面 URL"""
        query = "SELECT note_data FROM web_history WHERE author_id = ? AND note_data LIKE '%\"cover\"%'"
        params = [author_id]
        if user_id is not None:
            query += " AND (user_id = ? OR user_id IS NULL)"
            params.append(user_id)
        query += " ORDER BY cache_time ASC LIMIT 1"
        await self.cursor.execute(query, tuple(params))
        row = await self.cursor.fetchone()
        if row:
            try:
                data = json.loads(row[0])
                return data.get("cover") or data.get("raw_cover") or ""
            except:
                pass
        return ""

    async def get_collections(self, search: str = None, tag: str = None, user_id: int = None, include_legacy: bool = False):
        query = "SELECT note_data, cache_time, is_starred, tags FROM web_history WHERE is_starred = 1"
        params = []
        
        if user_id is not None:
            if include_legacy:
                query += " AND (user_id = ? OR user_id IS NULL)"
            else:
                query += " AND user_id = ?"
            params.append(user_id)
        
        if search:
            query += " AND (note_data LIKE ? OR tags LIKE ? OR author_name LIKE ?)"
            p = f"%{search}%"
            params.extend([p, p, p])
        if tag and tag != "all":
            query += " AND tags LIKE ?"
            params.append(f"%{tag}%")
            
        query += " ORDER BY cache_time DESC"
        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()
        return [
            {
                "data": json.loads(row[0]),
                "cache_time": row[1],
                "is_starred": bool(row[2]),
                "tags": row[3].split(",") if row[3] else [],
            }
            for row in rows
        ]

    # ---- 用户管理 ----
    async def create_user(self, nickname: str, token: str, password_hash: str = '') -> dict:
        from datetime import datetime
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await self.database.execute(
            "INSERT INTO users (nickname, password_hash, token, created_at) VALUES (?, ?, ?, ?);",
            (nickname, password_hash, token, created_at),
        )
        await self.database.commit()
        # 获取新插入的用户 ID
        await self.cursor.execute("SELECT last_insert_rowid()")
        user_id = (await self.cursor.fetchone())[0]
        return {
            "id": user_id,
            "nickname": nickname,
            "avatar_url": "",
            "theme": "dark",
            "token": token,
        }

    async def get_user_by_nickname(self, nickname: str) -> dict:
        await self.cursor.execute(
            "SELECT id, nickname, password_hash, avatar_url, theme, token FROM users WHERE nickname = ?",
            (nickname,),
        )
        row = await self.cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "nickname": row[1],
                "password_hash": row[2] or "",
                "avatar_url": row[3] or "",
                "theme": row[4] or "dark",
                "token": row[5],
            }
        return None

    async def get_user_by_token(self, token: str) -> dict:
        await self.cursor.execute(
            "SELECT id, nickname, avatar_url, theme, token FROM users WHERE token = ?",
            (token,),
        )
        row = await self.cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "nickname": row[1],
                "avatar_url": row[2] or "",
                "theme": row[3] or "dark",
                "token": row[4],
            }
        return None

    async def update_user_profile(self, user_id: int, nickname: str = None, theme: str = None):
        if nickname:
            await self.database.execute("UPDATE users SET nickname = ? WHERE id = ?;", (nickname, user_id))
        if theme:
            await self.database.execute("UPDATE users SET theme = ? WHERE id = ?;", (theme, user_id))
        await self.database.commit()

    async def update_user_avatar(self, user_id: int, avatar_url: str):
        await self.database.execute("UPDATE users SET avatar_url = ? WHERE id = ?;", (avatar_url, user_id))
        await self.database.commit()

    async def get_user_by_id(self, user_id: int) -> dict:
        await self.cursor.execute(
            "SELECT id, nickname, avatar_url, theme, token FROM users WHERE id = ?",
            (user_id,),
        )
        row = await self.cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "nickname": row[1],
                "avatar_url": row[2] or "",
                "theme": row[3] or "dark",
                "token": row[4],
            }
        return None
