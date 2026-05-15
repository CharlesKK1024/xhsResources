"""清理数据库：删除重复用户 + 重置所有用户密码为空"""
import sqlite3
from pathlib import Path
import time

db_path = Path(__file__).parent / "Volume" / "WebData.db"
print(f"数据库路径: {db_path}")

# SQLite busy timeout - 等待其他进程释放锁
conn = sqlite3.connect(str(db_path), timeout=30)
cur = conn.cursor()

# 1️⃣ 查看当前用户
cur.execute("SELECT id, nickname, password_hash, theme FROM users")
users = cur.fetchall()
print("\n=== 当前用户 ===")
for u in users:
    print(f"  id={u[0]}, nickname={u[1]:15s}, 有密码={bool(u[2])}, 主题={u[3]}")

# 2️⃣ 找出重复昵称，只保留最新的那个（id最大的）
cur.execute("""
    SELECT nickname FROM users 
    GROUP BY nickname 
    HAVING COUNT(*) > 1
""")
duplicates = cur.fetchall()
print(f"\n重复昵称数量: {len(duplicates)}")

for dup in duplicates:
    nickname = dup[0]
    cur.execute("SELECT id FROM users WHERE nickname = ? ORDER BY id DESC", (nickname,))
    ids = [r[0] for r in cur.fetchall()]
    keep_id = ids[0]  # 保留最新的
    delete_ids = ids[1:]  # 删除旧的
    print(f"  昵称 '{nickname}': 保留 id={keep_id}, 删除 ids={delete_ids}")
    for did in delete_ids:
        cur.execute("DELETE FROM web_history WHERE user_id = ?", (did,))
        cur.execute("DELETE FROM users WHERE id = ?", (did,))

# 3️⃣ 重置所有用户密码为空（这样登录时输入任意密码就会设置为新密码）
cur.execute("UPDATE users SET password_hash = ''")
print("\n✅ 所有用户密码已重置为空")

# 4️⃣ 查看清理后结果
cur.execute("SELECT id, nickname, password_hash, theme FROM users")
users = cur.fetchall()
print("\n=== 清理后用户 ===")
for u in users:
    print(f"  id={u[0]}, nickname={u[1]:15s}, 有密码={bool(u[2])}, 主题={u[3]}")

conn.commit()
conn.close()
print("\n✅✅ 数据库清理成功！所有用户密码已清空")
print("   现在重启服务，打开页面输入昵称+任意密码即可登录")
