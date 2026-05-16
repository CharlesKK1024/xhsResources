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
            note_id TEXT NOT NULL,
            user_id TEXT NOT NULL DEFAULT '1',
            note_data TEXT,
            cache_time TEXT,
            is_starred INTEGER DEFAULT 0,
            tags TEXT,
            author_id TEXT,
            author_name TEXT,
            source_url TEXT,
            PRIMARY KEY (note_id, user_id)
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
        # 迁移：web_history 从单主键 note_id 迁移到复合主键 (note_id, user_id)
        cursor_info = await self.database.execute("PRAGMA table_info(web_history)")
        columns_info = await cursor_info.fetchall()
        pk_cols = [c[1] for c in columns_info if c[5] > 0]
        if pk_cols == ['note_id']:
            await self.database.executescript("""
                CREATE TABLE web_history_new (
                    note_id TEXT NOT NULL,
                    user_id TEXT NOT NULL DEFAULT '1',
                    note_data TEXT,
                    cache_time TEXT,
                    is_starred INTEGER DEFAULT 0,
                    tags TEXT,
                    author_id TEXT,
                    author_name TEXT,
                    source_url TEXT,
                    PRIMARY KEY (note_id, user_id)
                );
                INSERT INTO web_history_new
                    SELECT note_id, COALESCE(user_id, '1'), note_data, cache_time,
                           is_starred, tags, author_id, author_name, source_url
                    FROM web_history;
                DROP TABLE web_history;
                ALTER TABLE web_history_new RENAME TO web_history;
            """)
            await self.database.commit()
        # 作者私信表
        await self.database.execute(
            """CREATE TABLE IF NOT EXISTS author_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author_id TEXT NOT NULL,
            user_id INTEGER,
            content TEXT NOT NULL,
            is_self INTEGER DEFAULT 1,
            created_at TEXT
            );"""
        )
        # 站内用户私信表
        await self.database.execute(
            """CREATE TABLE IF NOT EXISTS user_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT
            );"""
        )
        await self.database.execute(
            "CREATE INDEX IF NOT EXISTS idx_um_conv ON user_messages(sender_id, receiver_id, id);"
        )
        # 用户关注表
        await self.database.execute(
            """CREATE TABLE IF NOT EXISTS user_follows (
            follower_id INTEGER NOT NULL,
            following_id INTEGER NOT NULL,
            created_at TEXT,
            PRIMARY KEY (follower_id, following_id)
            );"""
        )
        await self.database.commit()

    async def add_history(self, note_id: str, data: dict, author_id: str, author_name: str, source_url: str = None, user_id: int = 1):
        cache_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await self.database.execute(
            "INSERT OR REPLACE INTO web_history (note_id, note_data, cache_time, author_id, author_name, source_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?);",
            (note_id, json.dumps(data, ensure_ascii=False), cache_time, author_id, author_name, source_url, user_id),
        )
        await self.database.commit()

    async def get_history_by_url(self, url: str, user_id: int = None):
        if user_id is not None:
            await self.cursor.execute("SELECT note_data, is_starred, tags FROM web_history WHERE source_url = ? AND user_id = ?", (url, user_id))
        else:
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

    async def update_star(self, note_id: str, is_starred: int, user_id: int = None):
        if user_id is not None:
            await self.database.execute(
                "UPDATE web_history SET is_starred = ? WHERE note_id = ? AND user_id = ?;",
                (is_starred, note_id, user_id),
            )
        else:
            await self.database.execute(
                "UPDATE web_history SET is_starred = ? WHERE note_id = ?;",
                (is_starred, note_id),
            )
        await self.database.commit()

    async def update_tags(self, note_id: str, tags: str, user_id: int = None):
        if user_id is not None:
            await self.database.execute(
                "UPDATE web_history SET tags = ? WHERE note_id = ? AND user_id = ?;",
                (tags, note_id, user_id),
            )
        else:
            await self.database.execute(
                "UPDATE web_history SET tags = ? WHERE note_id = ?;",
                (tags, note_id),
            )
        await self.database.commit()

    async def delete_history(self, note_id: str, user_id: int = None):
        """删除指定作品的历史记录"""
        if user_id is not None:
            await self.database.execute("DELETE FROM web_history WHERE note_id = ? AND user_id = ?;", (note_id, user_id))
        else:
            await self.database.execute("DELETE FROM web_history WHERE note_id = ?;", (note_id,))
        await self.database.commit()

    async def update_note_data(self, note_id: str, data: dict, user_id: int = None):
        """更新作品的 JSON 数据（如修改封面、删除部分媒体）"""
        if user_id is not None:
            await self.database.execute(
                "UPDATE web_history SET note_data = ? WHERE note_id = ? AND user_id = ?;",
                (json.dumps(data, ensure_ascii=False), note_id, user_id),
            )
        else:
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

    async def get_note_by_id_global(self, note_id: str):
        await self.cursor.execute(
            "SELECT note_data FROM web_history WHERE note_id = ? LIMIT 1",
            (note_id,),
        )
        row = await self.cursor.fetchone()
        if row:
            return json.loads(row[0])
        return None

    async def search_authors(self, name: str, user_id: int = None, include_legacy: bool = False):
        query = "SELECT DISTINCT author_id, author_name, COUNT(*) as cnt FROM web_history WHERE author_name LIKE ?"
        params = [f"%{name}%"]
        if user_id is not None:
            if include_legacy:
                query += " AND (user_id = ? OR user_id IS NULL)"
            else:
                query += " AND user_id = ?"
            params.append(user_id)
        query += " GROUP BY author_id, author_name ORDER BY cnt DESC"
        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()
        return [{"author_id": r[0], "author_name": r[1], "count": r[2]} for r in rows if r[0]]

    async def get_existing_note_ids(self, user_id: int = None, include_legacy: bool = False):
        query = "SELECT note_id FROM web_history"
        params = []
        if user_id is not None:
            if include_legacy:
                query += " WHERE (user_id = ? OR user_id IS NULL)"
            else:
                query += " WHERE user_id = ?"
            params.append(user_id)
        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()
        return {r[0] for r in rows}

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

    async def get_history_by_tag(self, tag: str, author_id: str = None, user_id: int = None, include_legacy: bool = False):
        query = "SELECT note_data, cache_time, is_starred, tags, author_id FROM web_history"
        params = []
        conditions = []

        if user_id is not None:
            if include_legacy:
                conditions.append("(user_id = ? OR user_id IS NULL)")
            else:
                conditions.append("user_id = ?")
            params.append(user_id)

        conditions.append("note_data LIKE ?")
        params.append(f"%{tag}%")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY cache_time DESC"
        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()

        results = []
        for row in rows:
            data = json.loads(row[0])
            tags_str = data.get("tags", "")
            tag_list = [t.strip() for t in tags_str.replace("#", " ").split() if t.strip()]
            if tag not in tag_list:
                continue
            results.append({
                "data": data,
                "cache_time": row[1],
                "is_starred": bool(row[2]),
                "tags": row[3].split(",") if row[3] else [],
                "author_id": row[4] or "",
            })

        if author_id:
            priority = [r for r in results if r["author_id"] == author_id]
            others = [r for r in results if r["author_id"] != author_id]
            results = priority + others

        return results

    async def get_history_by_location(self, location: str, user_id: int = None, include_legacy: bool = False):
        query = "SELECT note_data, cache_time, is_starred, tags, author_id FROM web_history"
        params = []
        conditions = []

        if user_id is not None:
            if include_legacy:
                conditions.append("(user_id = ? OR user_id IS NULL)")
            else:
                conditions.append("user_id = ?")
            params.append(user_id)

        conditions.append("note_data LIKE ?")
        params.append(f'%"ipLocation": "{location}"%')

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY cache_time DESC"
        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()

        results = []
        for row in rows:
            data = json.loads(row[0])
            if data.get("ipLocation") != location:
                continue
            results.append({
                "data": data,
                "cache_time": row[1],
                "is_starred": bool(row[2]),
                "tags": row[3].split(",") if row[3] else [],
                "author_id": row[4] or "",
            })
        return results

    async def get_location_stats(self, user_id: int = None, include_legacy: bool = False):
        query = "SELECT note_data FROM web_history"
        params = []
        conditions = []

        if user_id is not None:
            if include_legacy:
                conditions.append("(user_id = ? OR user_id IS NULL)")
            else:
                conditions.append("user_id = ?")
            params.append(user_id)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()

        stats = {}
        for row in rows:
            data = json.loads(row[0])
            loc = data.get("ipLocation", "")
            if loc:
                stats[loc] = stats.get(loc, 0) + 1

        return [{"name": k, "value": v} for k, v in sorted(stats.items(), key=lambda x: -x[1])]

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

    # ---- 作者详情 ----

    async def search_users(self, query: str, exclude_user_id: int = None):
        sql = """SELECT u.id, u.nickname, u.avatar_url,
                        (SELECT COUNT(*) FROM web_history WHERE user_id = u.id) as work_count
                 FROM users u WHERE u.nickname LIKE ?"""
        params = [f"%{query}%"]
        if exclude_user_id is not None:
            sql += " AND u.id != ?"
            params.append(exclude_user_id)
        sql += " ORDER BY work_count DESC"
        await self.cursor.execute(sql, tuple(params))
        rows = await self.cursor.fetchall()
        return [{"id": r[0], "nickname": r[1], "avatar_url": r[2] or "", "work_count": r[3]} for r in rows]

    async def import_notes(self, note_ids: list, source_user_id: int, target_user_id: int):
        imported = 0
        skipped = 0
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for nid in note_ids:
            await self.cursor.execute(
                "SELECT 1 FROM web_history WHERE note_id = ? AND user_id = ?",
                (nid, target_user_id))
            if await self.cursor.fetchone():
                skipped += 1
                continue
            await self.cursor.execute(
                "SELECT note_data, author_id, author_name, source_url FROM web_history WHERE note_id = ? AND user_id = ?",
                (nid, source_user_id))
            row = await self.cursor.fetchone()
            if row:
                await self.database.execute(
                    """INSERT INTO web_history (note_id, note_data, cache_time, is_starred, tags, author_id, author_name, source_url, user_id)
                       VALUES (?, ?, ?, 0, '', ?, ?, ?, ?)""",
                    (nid, row[0], now, row[1], row[2], row[3], target_user_id))
                imported += 1
            else:
                skipped += 1
        await self.database.commit()
        return {"imported": imported, "skipped": skipped}

    async def get_author_detail(self, author_id: str, user_id: int = None, include_legacy: bool = False):
        query = "SELECT note_data, cache_time, is_starred, tags FROM web_history WHERE author_id = ?"
        params = [author_id]
        if user_id is not None:
            if include_legacy:
                query += " AND (user_id = ? OR user_id IS NULL)"
            else:
                query += " AND user_id = ?"
            params.append(user_id)
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

    # ---- 作者私信 ----
    async def add_message(self, author_id: str, user_id: int, content: str, is_self: int = 1):
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await self.database.execute(
            "INSERT INTO author_messages (author_id, user_id, content, is_self, created_at) VALUES (?, ?, ?, ?, ?);",
            (author_id, user_id, content, is_self, created_at),
        )
        await self.database.commit()
        await self.cursor.execute("SELECT last_insert_rowid()")
        row = await self.cursor.fetchone()
        return row[0] if row else None

    async def get_messages(self, author_id: str, user_id: int = None, limit: int = 100):
        query = "SELECT id, content, is_self, created_at FROM author_messages WHERE author_id = ?"
        params = [author_id]
        if user_id is not None:
            query += " AND user_id = ?"
            params.append(user_id)
        query += " ORDER BY created_at ASC LIMIT ?"
        params.append(limit)
        await self.cursor.execute(query, tuple(params))
        rows = await self.cursor.fetchall()
        return [{"id": r[0], "content": r[1], "is_self": bool(r[2]), "time": r[3]} for r in rows]

    async def delete_message(self, message_id: int, user_id: int = None):
        query = "DELETE FROM author_messages WHERE id = ?"
        params = [message_id]
        if user_id is not None:
            query += " AND user_id = ?"
            params.append(user_id)
        await self.database.execute(query, tuple(params))
        await self.database.commit()

    # ---- 站内用户私信 ----
    async def send_user_message(self, sender_id: int, receiver_id: int, content: str) -> int:
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await self.database.execute(
            "INSERT INTO user_messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?);",
            (sender_id, receiver_id, content, created_at),
        )
        await self.database.commit()
        await self.cursor.execute("SELECT last_insert_rowid()")
        row = await self.cursor.fetchone()
        return row[0] if row else 0

    async def get_user_messages(self, user_id: int, peer_id: int, limit: int = 100) -> list:
        await self.cursor.execute(
            """SELECT id, sender_id, receiver_id, content, is_read, created_at
               FROM user_messages
               WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
               ORDER BY id ASC LIMIT ?""",
            (user_id, peer_id, peer_id, user_id, limit),
        )
        rows = await self.cursor.fetchall()
        return [
            {"id": r[0], "sender_id": r[1], "receiver_id": r[2],
             "content": r[3], "is_read": bool(r[4]), "time": r[5],
             "is_self": r[1] == user_id}
            for r in rows
        ]

    async def get_new_user_messages(self, user_id: int, peer_id: int, after_id: int) -> list:
        await self.cursor.execute(
            """SELECT id, sender_id, receiver_id, content, is_read, created_at
               FROM user_messages
               WHERE id > ?
                 AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
               ORDER BY id ASC""",
            (after_id, user_id, peer_id, peer_id, user_id),
        )
        rows = await self.cursor.fetchall()
        return [
            {"id": r[0], "sender_id": r[1], "receiver_id": r[2],
             "content": r[3], "is_read": bool(r[4]), "time": r[5],
             "is_self": r[1] == user_id}
            for r in rows
        ]

    async def mark_messages_read(self, user_id: int, peer_id: int):
        await self.database.execute(
            "UPDATE user_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0;",
            (peer_id, user_id),
        )
        await self.database.commit()

    async def delete_user_message(self, message_id: int, user_id: int):
        await self.database.execute(
            "DELETE FROM user_messages WHERE id = ? AND sender_id = ?;",
            (message_id, user_id),
        )
        await self.database.commit()

    async def get_unread_count(self, user_id: int) -> int:
        await self.cursor.execute(
            "SELECT COUNT(*) FROM user_messages WHERE receiver_id = ? AND is_read = 0;",
            (user_id,),
        )
        row = await self.cursor.fetchone()
        return row[0] if row else 0

    async def get_conversations(self, user_id: int) -> list:
        await self.cursor.execute(
            """SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at,
                      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS peer_id
               FROM user_messages m
               INNER JOIN (
                   SELECT MAX(id) AS max_id
                   FROM user_messages
                   WHERE sender_id = ? OR receiver_id = ?
                   GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
               ) latest ON m.id = latest.max_id
               ORDER BY m.id DESC""",
            (user_id, user_id, user_id, user_id),
        )
        rows = await self.cursor.fetchall()
        conversations = []
        for r in rows:
            peer_id = r[5]
            peer = await self.get_user_by_id(peer_id)
            await self.cursor.execute(
                "SELECT COUNT(*) FROM user_messages WHERE sender_id = ? AND receiver_id = ? AND is_read = 0;",
                (peer_id, user_id),
            )
            unread_row = await self.cursor.fetchone()
            conversations.append({
                "peer_id": peer_id,
                "peer_name": peer["nickname"] if peer else "未知用户",
                "peer_avatar": peer["avatar_url"] if peer else "",
                "last_message": r[3],
                "last_time": r[4],
                "is_self": r[1] == user_id,
                "unread": unread_row[0] if unread_row else 0,
            })
        return conversations

    # ---- 用户关注 ----
    async def follow_user(self, follower_id: int, following_id: int):
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await self.database.execute(
            "INSERT OR IGNORE INTO user_follows (follower_id, following_id, created_at) VALUES (?, ?, ?);",
            (follower_id, following_id, created_at),
        )
        await self.database.commit()

    async def unfollow_user(self, follower_id: int, following_id: int):
        await self.database.execute(
            "DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?;",
            (follower_id, following_id),
        )
        await self.database.commit()

    async def is_following(self, follower_id: int, following_id: int) -> bool:
        await self.cursor.execute(
            "SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ?;",
            (follower_id, following_id),
        )
        return await self.cursor.fetchone() is not None

    async def get_following_list(self, user_id: int) -> list:
        await self.cursor.execute(
            """SELECT f.following_id, u.nickname, u.avatar_url,
                      (SELECT COUNT(*) FROM web_history WHERE user_id = f.following_id) as work_count
               FROM user_follows f
               JOIN users u ON u.id = f.following_id
               WHERE f.follower_id = ?
               ORDER BY f.created_at DESC""",
            (user_id,),
        )
        rows = await self.cursor.fetchall()
        return [{"id": r[0], "nickname": r[1], "avatar_url": r[2] or "", "work_count": r[3]} for r in rows]

    async def get_follow_counts(self, user_id: int) -> dict:
        await self.cursor.execute(
            "SELECT COUNT(*) FROM user_follows WHERE follower_id = ?;", (user_id,)
        )
        following = (await self.cursor.fetchone())[0]
        await self.cursor.execute(
            "SELECT COUNT(*) FROM user_follows WHERE following_id = ?;", (user_id,)
        )
        followers = (await self.cursor.fetchone())[0]
        return {"following_count": following, "followers_count": followers}
