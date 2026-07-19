from __future__ import annotations

from dataclasses import dataclass

from src.core.settings import Settings


@dataclass(frozen=True, slots=True)
class NbaConfig:
    enabled: bool
    demo_mode: bool
    stage_max_attempts: int
    stage_timeout_seconds: float
    geo_confidence_threshold: float

    @classmethod
    def from_settings(cls, settings: Settings) -> NbaConfig:
        return cls(
            enabled=settings.nba_enabled,
            demo_mode=settings.nba_demo_mode,
            stage_max_attempts=settings.nba_stage_max_attempts,
            stage_timeout_seconds=settings.nba_stage_timeout_seconds,
            geo_confidence_threshold=settings.nba_geo_confidence_threshold,
        )
