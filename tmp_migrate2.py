import sqlite3

conn = sqlite3.connect('backend/linhoking.db')
c = conn.cursor()

cols = [row[1] for row in c.execute("PRAGMA table_info(users)").fetchall()]
new_cols = [
    ("mt5_account_number", "TEXT"),
    ("mt5_broker", "TEXT"),
    ("mt5_leverage", "INTEGER"),
    ("mt5_currency", "TEXT")
]

for col_name, col_type in new_cols:
    if col_name not in cols:
        c.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
        print(f"Added column {col_name}")
    else:
        print(f"Column {col_name} already exists")

conn.commit()
conn.close()
