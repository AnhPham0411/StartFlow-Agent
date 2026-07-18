"""Kết nối PostgreSQL (Supabase) qua psycopg3 — dùng chung cho batch + API.

Giữ tối giản: mỗi thao tác mở 1 kết nối trong context manager. Batch chạy thưa
(đêm/nút bấm) nên chưa cần pool; có thể nâng lên psycopg_pool sau.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from src.core.config import get_settings


def _dsn() -> str:
    dsn = get_settings().database_url
    if not dsn:
        raise RuntimeError("AI_DATABASE_URL/DATABASE_URL chưa cấu hình trong .env")
    return dsn


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    """Kết nối có transaction: commit nếu ok, rollback nếu lỗi."""
    conn = psycopg.connect(_dsn(), row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def fetch_one(sql: str, params: tuple = ()) -> dict | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()
