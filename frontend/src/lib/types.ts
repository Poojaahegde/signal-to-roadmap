// types.ts — Shared TypeScript types for Signal to Roadmap frontend
// These mirror the Pydantic models from the FastAPI backend

export type SourceType = 'support' | 'sales' | 'review';
export type EffortTag = 'S' | 'M' | 'L' | 'XL';
export type PriorityTier = 'P1' | 'P2' | 'P3';
export type SessionStatus = 'ingesting' | 'analyzing' | 'complete' | 'error';

// ── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  name?: string;
  status: SessionStatus;
  created_at: string;
}

// ── Signal ingestion ──────────────────────────────────────────────────────────

export interface SignalItem {
  content: string;
  signal_date?: string;    // YYYY-MM-DD
  customer_segment?: 'enterprise' | 'smb' | 'individual';
}

export interface IngestSignalsRequest {
  source_type: SourceType;
  signals: SignalItem[];
}

export interface IngestSignalsResponse {
  count: number;
  source_type: SourceType;
  session_id: string;
}

// ── Clusters ──────────────────────────────────────────────────────────────────

export interface Cluster {
  id: number;
  cluster_index: number;
  label: string;
  signal_count: number;
  final_score: number;
  frequency_score: number;
  avg_recency_score: number;
  segment_score: number;
  cross_source_bonus: number;
  sources_present: SourceType[];
}

export interface AnalysisResponse {
  session_id: string;
  total_signals: number;
  num_clusters: number;
  clusters: Cluster[];
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

export interface RoadmapItem {
  id: string;
  cluster_id?: number;
  feature_name: string;
  description: string;
  rationale: string;
  evidence_quotes: string[];
  effort_tag: EffortTag;
  priority_tier: PriorityTier;
  priority_score: number;
}

export interface RoadmapResponse {
  session_id: string;
  items: RoadmapItem[];
  total_items: number;
}

// ── Challenge mode ────────────────────────────────────────────────────────────

export interface ChallengeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChallengeResponse {
  roadmap_item_id: string;
  response: string;
}

// ── UI state ──────────────────────────────────────────────────────────────────

export interface IngestionState {
  support: SignalItem[];
  sales: SignalItem[];
  review: SignalItem[];
}

export type AnalysisStep = 
  | 'idle'
  | 'embedding'
  | 'clustering'
  | 'scoring'
  | 'labeling'
  | 'complete'
  | 'error';
