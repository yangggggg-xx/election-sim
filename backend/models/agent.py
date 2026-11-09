from pydantic import BaseModel
from typing import Optional
from enum import Enum


class CharacterType(str, Enum):
    SUSCEPTIBLE = "susceptible"
    ORDINARY = "ordinary"
    CALM = "calm"


class PartyType(str, Enum):
    REPUBLICAN = "republican"
    DEMOCRAT = "democrat"
    INDEPENDENT = "independent"


class EmotionState(BaseModel):
    happy: float = 0.0
    sad: float = 0.0
    angry: float = 0.0


class AttitudeState(BaseModel):
    positive: float = 0.5
    negative: float = 0.5


class MemoryItem(BaseModel):
    day: int
    event_id: str
    event_title: str
    emotion_snapshot: EmotionState
    attitude_snapshot: AttitudeState
    freshness: float = 1.0  # 1.0=fresh, decays over time


class GroupAgent(BaseModel):
    id: str
    state_abbr: str
    state_name: str
    party: PartyType
    population: int
    character: CharacterType
    emotions: EmotionState
    attitudes: AttitudeState
    memory_queue: list[MemoryItem] = []
    layer: int = 1

    def character_weight(self, character_enabled: bool = True) -> float:
        if not character_enabled:
            return 1.0
        weights = {
            CharacterType.SUSCEPTIBLE: 1.5,
            CharacterType.ORDINARY: 1.0,
            CharacterType.CALM: 0.5,
        }
        return weights[self.character]

    def predict_party(self) -> str:
        """Predict which party this agent supports based on attitude."""
        margin = self.attitudes.positive - self.attitudes.negative
        if margin > 0.05:
            return "rep"
        elif margin < -0.05:
            return "dem"
        else:
            return "swing"
