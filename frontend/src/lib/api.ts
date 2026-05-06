// api.ts — Typed API client for the Signal to Roadmap backend
// All requests go through this module for consistent error handling.

import type {
  Session,
  IngestSignalsRequest,
  IngestSignalsResponse,
  AnalysisResponse,
  RoadmapResponse,
  ChallengeResponse,
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(name?: string): Promise<Session> {
  return request<Session>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ── Signal ingestion ──────────────────────────────────────────────────────────

export async function ingestSignals(
  sessionId: string,
  data: IngestSignalsRequest,
): Promise<IngestSignalsResponse> {
  return request<IngestSignalsResponse>(`/api/sessions/${sessionId}/signals`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Analysis pipeline ─────────────────────────────────────────────────────────

export async function runAnalysis(sessionId: string): Promise<AnalysisResponse> {
  return request<AnalysisResponse>(`/api/sessions/${sessionId}/analyze`, {
    method: 'POST',
  });
}

export async function getClusters(sessionId: string): Promise<AnalysisResponse> {
  return request<AnalysisResponse>(`/api/sessions/${sessionId}/clusters`);
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

export async function generateRoadmap(
  sessionId: string,
  maxItems = 8,
): Promise<RoadmapResponse> {
  return request<RoadmapResponse>(`/api/sessions/${sessionId}/roadmap`, {
    method: 'POST',
    body: JSON.stringify({ max_items: maxItems }),
  });
}

export async function getRoadmap(sessionId: string): Promise<RoadmapResponse> {
  return request<RoadmapResponse>(`/api/sessions/${sessionId}/roadmap`);
}

// ── Challenge mode ────────────────────────────────────────────────────────────

export async function challengeItem(
  itemId: string,
  message: string,
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(`/api/roadmap-items/${itemId}/challenge`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportRoadmap(sessionId: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/sessions/${sessionId}/export`);
  if (!response.ok) throw new ApiError(response.status, 'Export failed');
  return response.text();
}

// ── Demo mode ─────────────────────────────────────────────────────────────────

export async function loadDemo(): Promise<{ session_id: string }> {
  return request<{ session_id: string }>('/api/demo/load', { method: 'GET' });
}

export { ApiError };
