from __future__ import annotations

from abc import ABC, abstractmethod

from src.nba.contracts import CustomerSnapshot, StageOutput


class PipelineStage(ABC):
    name: str

    @abstractmethod
    async def execute(self, customer: CustomerSnapshot) -> StageOutput:
        raise NotImplementedError

