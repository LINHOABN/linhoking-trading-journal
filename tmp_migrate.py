import sqlite3
conn = sqlite3.connect('backend/linhoking.db')
c = conn.cursor()
# Check if column exists
cols = [row[1] for row in c.execute("PRAGMA table_info(users)").fetchall()]
if 'mt5_balance' not in cols:
    c.execute("ALTER TABLE users ADD COLUMN mt5_balance REAL")
    conn.commit()
    print("Colonne mt5_balance ajoutée avec succès.")
else:
    print("Colonne mt5_balance existe déjà.")
conn.close()
