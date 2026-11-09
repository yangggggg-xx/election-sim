from pydantic import BaseModel
from typing import Optional


class EventImpact(BaseModel):
    rep_happy: float = 0.0
    rep_sad: float = 0.0
    rep_angry: float = 0.0
    dem_happy: float = 0.0
    dem_sad: float = 0.0
    dem_angry: float = 0.0
    ind_happy: float = 0.0
    ind_sad: float = 0.0
    ind_angry: float = 0.0
    rep_positive: float = 0.0
    dem_positive: float = 0.0
    ind_positive: float = 0.0


class Event(BaseModel):
    id: str
    title: str
    date: str
    content: str
    domain: str = "politics"
    country: str = "US"
    impact: Optional[EventImpact] = None
    status: str = "pending"  # pending / processing / completed


class EventCreate(BaseModel):
    title: str
    date: str
    content: str
    domain: str = "politics"
    country: str = "US"
