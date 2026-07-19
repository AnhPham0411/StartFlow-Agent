from __future__ import annotations

import ssl
from pathlib import Path
from typing import Any

from sqlalchemy.engine import URL, make_url


def prepare_asyncpg_connection(
    database_url: str,
    ssl_mode: str,
    ssl_root_cert: str | None,
) -> tuple[URL, dict[str, Any]]:
    """Convert a shared libpq-style URL into SQLAlchemy asyncpg arguments."""
    url = make_url(database_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+asyncpg")
    elif url.drivername != "postgresql+asyncpg":
        raise ValueError("Generated database URL must use PostgreSQL")
    query = {
        key: value
        for key, value in url.query.items()
        if key not in {"sslmode", "sslrootcert", "sslcert", "sslkey"}
    }
    url = url.set(query=query)
    if ssl_mode == "disable":
        return url, {"ssl": False}
    if ssl_mode in {"allow", "prefer"}:
        return url, {"ssl": ssl_mode}

    context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    if ssl_root_cert:
        certificate = Path(ssl_root_cert)
        if not certificate.is_file():
            raise ValueError("DB_SSL_ROOT_CERT does not point to a readable file")
        context.load_verify_locations(cafile=str(certificate))
    if ssl_mode == "require":
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    elif ssl_mode == "verify-ca":
        context.check_hostname = False
        context.verify_mode = ssl.CERT_REQUIRED
    elif ssl_mode == "verify-full":
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
    else:
        raise ValueError(f"Unsupported DB_SSL_MODE: {ssl_mode}")
    return url, {"ssl": context}
