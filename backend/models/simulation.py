from pydantic import BaseModel
from typing import Optional
from models.agent import GroupAgent, EmotionState, AttitudeState


class FineGrainedFactors(BaseModel):
    population_weight: float = 1.0
    emotion_fading: float = 0.1
    forgetting_probability: float = 0.05
    character_enabled: bool = True


class ActionStats(BaseModel):
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0


class DailySnapshot(BaseModel):
    day: int
    event_id: Optional[str] = None
    agents_state: list[dict] = []
    action_stats: ActionStats = ActionStats()
    rep_electoral_votes: int = 0
    dem_electoral_votes: int = 0


class SimulationState(BaseModel):
    is_running: bool = False
    current_day: int = 0
    total_days: int = 7
    current_event_index: int = 0
    events: list[dict] = []
    agents: list[dict] = []
    factors: FineGrainedFactors = FineGrainedFactors()
    history: list[DailySnapshot] = []
    prediction: Optional[dict] = None


class PredictionResult(BaseModel):
    rep_candidate: str = "Trump"
    dem_candidate: str = "Harris"
    rep_electoral_votes: int = 0
    dem_electoral_votes: int = 0
    rep_support_rate: float = 0.0
    dem_support_rate: float = 0.0
    winner: str = ""
    state_results: list[dict] = []
    swing_state_accuracy: float = 0.0
