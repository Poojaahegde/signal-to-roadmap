"""
scorer.py — Composite signal scoring for cluster prioritization.

Scoring formula (weights sum to 1.0):
    Final Score = (
        frequency_score    * 0.40   # Signal volume for this theme
      + recency_score      * 0.25   # Recency-weighted (exponential decay)
      + segment_score      * 0.20   # Enterprise > SMB > Individual
      + cross_source_bonus * 0.15   # Appears in multiple source types?
    )

Each component is normalized to [0, 1] before combining.
Final score is scaled to [0, 100] for readability.

Rationale for weights:
- Frequency (0.40): Volume is the strongest signal of a real pattern vs noise.
- Recency (0.25): Recent pain matters more than old pain that may be resolved.
- Segment (0.20): Enterprise signals carry higher revenue risk / opportunity.
- Cross-source (0.15): Triangulated signals are more reliable than single-source.
"""

import math
from datetime import datetime, date
from typing import List, Dict, Optional


# Segment weights reflect typical B2B SaaS revenue distribution
SEGMENT_WEIGHTS = {
    "enterprise": 3.0,
    "smb": 1.5,
    "individual": 1.0,
    None: 1.0,  # No segment info — treat as baseline
}

# Exponential decay half-life: signals from 180 days ago get half the recency weight
RECENCY_HALF_LIFE_DAYS = 180


def compute_recency_score(signal_dates: List[Optional[str]]) -> float:
    """
    Compute average recency score for a cluster using exponential decay.

    Signals without dates get a neutral score (0.5) rather than 0 or 1,
    so missing date data doesn't penalize or artificially boost clusters.

    Args:
        signal_dates: List of ISO date strings or None values

    Returns:
        Average recency score in [0, 1]
    """
    today = date.today()
    scores = []

    for date_str in signal_dates:
        if date_str is None:
            scores.append(0.5)  # Neutral for missing dates
            continue

        try:
            signal_date = date.fromisoformat(date_str)
            days_ago = (today - signal_date).days
            # Exponential decay: score = e^(-lambda * days_ago)
            # where lambda = ln(2) / half_life
            decay_lambda = math.log(2) / RECENCY_HALF_LIFE_DAYS
            score = math.exp(-decay_lambda * max(0, days_ago))
            scores.append(score)
        except (ValueError, TypeError):
            scores.append(0.5)

    return sum(scores) / len(scores) if scores else 0.5


def compute_segment_score(customer_segments: List[Optional[str]]) -> float:
    """
    Compute segment-weighted score for a cluster.

    Enterprise signals get 3x weight vs individual signals.
    Returns a normalized score in [0, 1].

    Args:
        customer_segments: List of segment strings or None values

    Returns:
        Normalized segment score in [0, 1]
    """
    if not customer_segments:
        return 0.5

    weights = [SEGMENT_WEIGHTS.get(seg, 1.0) for seg in customer_segments]
    avg_weight = sum(weights) / len(weights)

    # Normalize: max possible weight is 3.0 (all enterprise), min is 1.0
    normalized = (avg_weight - 1.0) / (3.0 - 1.0)
    return min(1.0, max(0.0, normalized))


def compute_cross_source_bonus(sources_present: List[str]) -> float:
    """
    Compute cross-source bonus.

    A cluster appearing in 1 source: 0.0 bonus
    A cluster appearing in 2 sources: 0.5 bonus
    A cluster appearing in all 3 sources: 1.0 bonus

    This is the most valuable signal: customer problems confirmed independently
    across support, sales, and reviews are almost certainly real.

    Args:
        sources_present: List of source types that contributed to this cluster

    Returns:
        Cross-source bonus in [0, 1]
    """
    unique_sources = len(set(sources_present))
    return (unique_sources - 1) / 2.0  # 0/2=0, 1/2=0.5, 2/2=1.0


def score_clusters(
    clusters: List[Dict],
    total_signals: int,
) -> List[Dict]:
    """
    Score all clusters and return them sorted by final score (descending).

    Args:
        clusters: List of cluster dicts with signal metadata
        total_signals: Total signals across all clusters (for frequency normalization)

    Returns:
        Scored and sorted cluster list
    """
    # Frequency normalization baseline: divide by total to get proportion
    for cluster in clusters:
        signal_count = cluster["signal_count"]
        signal_dates = cluster.get("signal_dates", [])
        customer_segments = cluster.get("customer_segments", [])
        sources_present = cluster.get("sources_present", [])

        # Frequency score: proportion of all signals (normalized to [0,1])
        frequency_score = signal_count / total_signals if total_signals > 0 else 0.0

        # Recency score
        recency_score = compute_recency_score(signal_dates)

        # Segment score
        segment_score = compute_segment_score(customer_segments)

        # Cross-source bonus
        cross_source_bonus = compute_cross_source_bonus(sources_present)

        # Composite score (weighted sum)
        composite = (
            frequency_score   * 0.40
            + recency_score   * 0.25
            + segment_score   * 0.20
            + cross_source_bonus * 0.15
        )

        # Scale to 0-100
        final_score = round(composite * 100, 2)

        cluster.update({
            "frequency_score": round(frequency_score, 4),
            "avg_recency_score": round(recency_score, 4),
            "segment_score": round(segment_score, 4),
            "cross_source_bonus": round(cross_source_bonus, 4),
            "final_score": final_score,
        })

    return sorted(clusters, key=lambda c: c["final_score"], reverse=True)
