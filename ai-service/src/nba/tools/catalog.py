from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CatalogProduct:
    code: str
    active: bool = True


DEMO_CATALOG = (CatalogProduct("CASA"),)

