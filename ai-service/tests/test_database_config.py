import ssl

from src.core.database import prepare_asyncpg_connection


def test_libpq_url_is_normalized_for_asyncpg() -> None:
    url, connect_args = prepare_asyncpg_connection(
        "postgresql://demo:secret@db.example:5432/ai?sslmode=require",
        "require",
        None,
    )
    assert url.drivername == "postgresql+asyncpg"
    assert "sslmode" not in url.query
    assert isinstance(connect_args["ssl"], ssl.SSLContext)


def test_disable_ssl_uses_explicit_false() -> None:
    _, connect_args = prepare_asyncpg_connection(
        "postgresql://demo:secret@db.example:5432/ai", "disable", None
    )
    assert connect_args == {"ssl": False}
