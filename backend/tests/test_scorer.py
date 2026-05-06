"""
test_scorer.py — Unit tests for the cluster scoring formula.

Tests cover:
- Recency score computation with exponential decay
- Segment weighting for enterprise vs individual signals
- Cross-source bonus calculation
- Full composite score computation and ordering
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from datetime import date, timedelta
from services.scorer import (
    compute_recency_score,
    compute_segment_score,
    compute_cross_source_bonus,
    score_clusters,
)


class TestRecencyScore:
    def test_today_signals_get_max_score(self):
        """Signals from today should get close to 1.0."""
        today = date.today().isoformat()
        score = compute_recency_score([today, today, today])
        assert score > 0.99

    def test_old_signals_get_low_score(self):
        """Signals from 2 years ago should have very low recency."""
        old_date = (date.today() - timedelta(days=730)).isoformat()
        score = compute_recency_score([old_date])
        assert score < 0.1

    def test_half_life_is_roughly_180_days(self):
        """Signal from 180 days ago should score ~0.5."""
        half_life_date = (date.today() - timedelta(days=180)).isoformat()
        score = compute_recency_score([half_life_date])
        assert 0.45 <= score <= 0.55

    def test_missing_dates_get_neutral_score(self):
        """None dates should return 0.5 (neutral)."""
        score = compute_recency_score([None, None])
        assert score == pytest.approx(0.5)

    def test_mixed_dates(self):
        """Mix of recent and old dates should produce intermediate score."""
        today = date.today().isoformat()
        old = (date.today() - timedelta(days=365)).isoformat()
        score = compute_recency_score([today, old])
        assert 0.2 < score < 0.8


class TestSegmentScore:
    def test_all_enterprise_gets_max_score(self):
        """All enterprise signals should get maximum segment score."""
        score = compute_segment_score(["enterprise", "enterprise", "enterprise"])
        assert score == pytest.approx(1.0)

    def test_all_individual_gets_min_score(self):
        """All individual signals should get minimum segment score."""
        score = compute_segment_score(["individual", "individual"])
        assert score == pytest.approx(0.0)

    def test_mixed_segments_are_intermediate(self):
        """Mix of enterprise and individual should be between 0 and 1."""
        score = compute_segment_score(["enterprise", "individual", "smb"])
        assert 0 < score < 1

    def test_none_segments_treated_as_individual(self):
        """Missing segment info gets baseline weight (same as individual)."""
        score = compute_segment_score([None, None])
        assert score == pytest.approx(0.0)


class TestCrossSourceBonus:
    def test_single_source_gets_zero_bonus(self):
        assert compute_cross_source_bonus(["support", "support", "support"]) == 0.0

    def test_two_sources_get_half_bonus(self):
        assert compute_cross_source_bonus(["support", "sales"]) == pytest.approx(0.5)

    def test_three_sources_get_full_bonus(self):
        assert compute_cross_source_bonus(["support", "sales", "review"]) == pytest.approx(1.0)

    def test_duplicate_sources_counted_once(self):
        # Many support tickets and one sales note = 2 unique sources
        assert compute_cross_source_bonus(["support"] * 10 + ["sales"]) == pytest.approx(0.5)


class TestScoreClusters:
    def test_clusters_sorted_by_final_score(self):
        """Higher-scoring clusters should appear first."""
        clusters = [
            {
                "cluster_index": 0,
                "signal_count": 5,
                "signal_dates": [],
                "customer_segments": ["individual"],
                "sources_present": ["support"],
            },
            {
                "cluster_index": 1,
                "signal_count": 50,
                "signal_dates": [date.today().isoformat()] * 50,
                "customer_segments": ["enterprise"] * 50,
                "sources_present": ["support", "sales", "review"],
            },
        ]
        scored = score_clusters(clusters, total_signals=55)
        assert scored[0]["cluster_index"] == 1  # High-volume, enterprise, multi-source cluster first

    def test_scores_are_in_0_100_range(self):
        """All final scores should be between 0 and 100."""
        clusters = [
            {
                "cluster_index": i,
                "signal_count": 10,
                "signal_dates": [None] * 10,
                "customer_segments": [None] * 10,
                "sources_present": ["support"],
            }
            for i in range(3)
        ]
        scored = score_clusters(clusters, total_signals=30)
        for c in scored:
            assert 0 <= c["final_score"] <= 100

    def test_frequency_weight_is_dominant(self):
        """Cluster with more signals should outscore one with fewer, all else equal."""
        clusters = [
            {
                "cluster_index": 0,
                "signal_count": 100,
                "signal_dates": [None] * 100,
                "customer_segments": [None] * 100,
                "sources_present": ["support"],
            },
            {
                "cluster_index": 1,
                "signal_count": 10,
                "signal_dates": [None] * 10,
                "customer_segments": [None] * 10,
                "sources_present": ["support"],
            },
        ]
        scored = score_clusters(clusters, total_signals=110)
        assert scored[0]["cluster_index"] == 0
