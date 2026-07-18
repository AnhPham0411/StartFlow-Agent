"""Apply Nest.js Prisma initial migration SQL directly to Supabase.
This is needed because Prisma migrate deploy fails when there are existing tables (the NBA schema tables).

Run: uv run python scripts/apply_initial_migration.py
"""
import os
import sys
import psycopg

DATABASE_URL = os.environ.get("DATABASE_URL") or "postgresql://postgres.advfjajnczcdzyuzdnfb:Meme171203%40%40@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

migration_file = os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend", "prisma", "migrations", "20260717163000_initial", "migration.sql")
if not os.path.exists(migration_file):
    sys.exit(f"Không tìm thấy file migration: {migration_file}")

with open(migration_file, "r", encoding="utf-8") as f:
    sql = f.read()

print("Connecting to database...")
conn = psycopg.connect(DATABASE_URL)
with conn.cursor() as cur:
    print("Executing SQL migration...")
    # Execute the migration sql
    cur.execute(sql)
conn.commit()
conn.close()
print("Success!")
