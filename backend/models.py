"""
models.py — Pydantic request/response models for the Signal to Roadmap API.

Keeping models in a single file for this demo; split by domain in production.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ── Enums ────────────────────────────────────────────────────────────────────

class SourceType(str, Enum):
    support = "support"
    sales = "sales"
    review = "review"


class SessionStatus(str, Enum):
    ingesting = "ingesting"
    analyzing = "analyzing"
    complete = "complete"
    error = "error"


class EffortTag(str, Enum):
    S = "S"
    M = "M"
    L = "L"
    XL = "XL"


class PriorityTier(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


# ── Session models ────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    name: Optional[str] = Field(None, description="Optional human-readable session name")


class SessionResponse(BaseModel):
    id: str
    name: Optional[str]
    status: str
    created_at: str


# ── Signal models ─────────────────────────────────────────────────────────────

class SignalItem(BaseModel):
    content: str = Field(..., min_length=10, description="Raw text of the signal")
    signal_date: Optional[str] = Field(None, description="ISO date string YYYY-MM-DD")
    customer_segment: Optional[str] = Field(
        None, description="'enterprise' | 'smb' | 'individual'"
    )


class IngestSignalsRequest(BaseModel):
    source_type: SourceType
    signals: List[SignalItem] = Field(..., min_length=1, max_length=500)


class IngestSignalsResponse(BaseModel):
    count: int
    source_type: str
    session_id: str


# ── Cluster models ────────────────────────────────────────────────────────────

class ClusterResponse(BaseModel):
    id: int
    cluster_index: int
    label: str
    signal_count: int
    final_score: float
    frequency_score: float
    avg_recency_score: float
    segment_score: float
    cross_source_bonus: float
    sources_present: List[str]


class AnalysisResponse(BaseModel):
    session_id: str
    total_signals: int
    num_clusters: int
    clusters: List[ClusterResponse]


# ── Roadmap models ────────────────────────────────────────────────────────────

class RoadmapItemResponse(BaseModel):
    id: str
    cluster_id: Optional[int]
    feature_name: str
    description: str
    rationale: str
    evidence_quotes: List[str]
    effort_tag: str
    priority_tier: str
    priority_score: float


class GenerateRoadmapRequest(BaseModel):
    max_items: int = Field(default=8, ge=3, le=15)


class RoadmapResponse(BaseModel):
    session_id: str
    items: List[RoadmapItemResponse]
    total_items: int


# ── Challenge models ──────────────────────────────────────────────────────────

class ChallengeRequest(BaseModel):
    message: str = Field(..., min_length=5, max_length=1000)


class ChallengeResponse(BaseModel):
    roadmap_item_id: str
    response: str
