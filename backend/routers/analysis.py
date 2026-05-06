"""
routers/analysis.py — Embed, cluster, and score pipeline endpoint.

POST /sessions/{session_id}/analyze triggers the full analysis pipeline:
1. Load all signals for the session from SQLite
2. Embed all signal texts using OpenAI text-embedding-3-small
3. Store embeddings back to SQLite
4. Run KMeans clustering with silhouette auto-k
5. Score each cluster using the composite scoring formula
6. Store cluster results to SQLite
7. Return cluster summaries to the frontend
"""

import json
import uuid
from fastapi import APIRouter, HTTPException, Depends
from aiosqlite import Connection

from database import get_db
from services.embedder import embed_texts, serialize_embedding, deserialize_embedding
from services.clusterer import cluster_and_label
from services.scorer import score_clusters
from models import AnalysisResponse, ClusterResponse

router = APIRouter()


@router.post("/sessions/{session_id}/analyze", response_model=AnalysisResponse)
async def analyze_session(session_id: str, db: Connection = Depends(get_db)):
    """
    Run the full embed -> cluster -> score pipeline for a session.

    This is the computationally expensive step. Expected runtime:
    - 100 signals: ~15-20 seconds (dominated by embedding API call)
    - 500 signals: ~45-60 seconds (5 batch requests + clustering)
    """
    # Validate session exists
    async with db.execute("SELECT id, status FROM sessions WHERE id = ?", (session_id,)) as cur:
        session = await cur.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load all signals
    async with db.execute(
        "SELECT id, content, source_type, signal_date, customer_segment FROM signals WHERE session_id = ?",
        (session_id,),
    ) as cur:
        signals = await cur.fetchall()

    if len(signals) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 signals to analyze")

    # Update session status
    await db.execute("UPDATE sessions SET status = 'analyzing' WHERE id = ?", (session_id,))
    await db.commit()

    signal_ids = [s["id"] for s in signals]
    signal_texts = [s["content"] for s in signals]
    signal_sources = [s["source_type"] for s in signals]
    signal_dates = [s["signal_date"] for s in signals]
    signal_segments = [s["customer_segment"] for s in signals]

    # Embed all signals
    embeddings = await embed_texts(signal_texts)

    # Store embeddings back to SQLite
    for sig_id, embedding in zip(signal_ids, embeddings):
        await db.execute(
            "UPDATE signals SET embedding = ? WHERE id = ?",
            (serialize_embedding(embedding), sig_id),
        )
    await db.commit()

    # Cluster and label
    cluster_results, labels = await cluster_and_label(embeddings, signal_texts)

    # Build cluster metadata for scoring
    cluster_metadata = []
    for cluster in cluster_results:
        indices = cluster["signal_indices"]
        cluster_sources = [signal_sources[i] for i in indices]
        cluster_dates = [signal_dates[i] for i in indices]
        cluster_segments = [signal_segments[i] for i in indices]
        sample_signals = [signal_texts[i] for i in indices[:10]]

        cluster_metadata.append({
            **cluster,
            "signal_count": len(indices),
            "sources_present": list(set(cluster_sources)),
            "signal_dates": cluster_dates,
            "customer_segments": cluster_segments,
            "sample_signals": sample_signals,
        })

    # Score clusters
    scored_clusters = score_clusters(cluster_metadata, total_signals=len(signals))

    # Store clusters to SQLite
    await db.execute("DELETE FROM clusters WHERE session_id = ?", (session_id,))
    await db.commit()

    cluster_id_map = {}
    for cluster in scored_clusters:
        cluster_db_id = await db.execute_insert(
            """INSERT INTO clusters
               (session_id, cluster_index, label, signal_count,
                avg_recency_score, frequency_score, segment_score,
                cross_source_bonus, final_score, sources_present)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                cluster["cluster_index"],
                cluster["label"],
                cluster["signal_count"],
                cluster["avg_recency_score"],
                cluster["frequency_score"],
                cluster["segment_score"],
                cluster["cross_source_bonus"],
                cluster["final_score"],
                json.dumps(cluster["sources_present"]),
            ),
        )
        cluster_id_map[cluster["cluster_index"]] = cluster_db_id

    # Update signal cluster assignments
    for i, label in enumerate(labels):
        cluster_db_id = cluster_id_map.get(label)
        await db.execute(
            "UPDATE signals SET cluster_id = ? WHERE id = ?",
            (cluster_db_id, signal_ids[i]),
        )

    await db.execute("UPDATE sessions SET status = 'complete' WHERE id = ?", (session_id,))
    await db.commit()

    # Build response
    cluster_responses = [
        ClusterResponse(
            id=cluster_id_map[c["cluster_index"]],
            cluster_index=c["cluster_index"],
            label=c["label"],
            signal_count=c["signal_count"],
            final_score=c["final_score"],
            frequency_score=c["frequency_score"],
            avg_recency_score=c["avg_recency_score"],
            segment_score=c["segment_score"],
            cross_source_bonus=c["cross_source_bonus"],
            sources_present=c["sources_present"],
        )
        for c in scored_clusters
    ]

    return AnalysisResponse(
        session_id=session_id,
        total_signals=len(signals),
        num_clusters=len(scored_clusters),
        clusters=cluster_responses,
    )


@router.get("/sessions/{session_id}/clusters", response_model=AnalysisResponse)
async def get_clusters(session_id: str, db: Connection = Depends(get_db)):
    """Retrieve previously computed cluster results for a session."""
    async with db.execute(
        """SELECT id, cluster_index, label, signal_count, final_score,
                  frequency_score, avg_recency_score, segment_score,
                  cross_source_bonus, sources_present
           FROM clusters WHERE session_id = ? ORDER BY final_score DESC""",
        (session_id,),
    ) as cur:
        clusters = await cur.fetchall()

    if not clusters:
        raise HTTPException(status_code=404, detail="No clusters found. Run /analyze first.")

    async with db.execute("SELECT COUNT(*) FROM signals WHERE session_id = ?", (session_id,)) as cur:
        total_signals = (await cur.fetchone())[0]

    return AnalysisResponse(
        session_id=session_id,
        total_signals=total_signals,
        num_clusters=len(clusters),
        clusters=[
            ClusterResponse(
                id=c["id"],
                cluster_index=c["cluster_index"],
                label=c["label"],
                signal_count=c["signal_count"],
                final_score=c["final_score"],
                frequency_score=c["frequency_score"],
                avg_recency_score=c["avg_recency_score"],
                segment_score=c["segment_score"],
                cross_source_bonus=c["cross_source_bonus"],
                sources_present=json.loads(c["sources_present"] or "[]"),
            )
            for c in clusters
        ],
    )
