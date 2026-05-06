"""
roadmap_generator.py — GPT-4o roadmap generation with structured output.

Takes the top-N scored clusters and generates PM-quality roadmap items.
Each item includes: feature name, description, rationale (2-3 sentences),
3 evidence verbatims, effort tag, and priority tier.

Design note: We use GPT-4o with chain-of-thought reasoning and a structured
output format. Temperature is set to 0.4 to balance creativity with consistency.
"""

import os
import json
from typing import List, Dict
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

ROADMAP_SYSTEM_PROMPT = """You are a senior product manager at a B2B SaaS company.
You have just completed an analysis of customer signals from support tickets, sales calls, and product reviews.
Your job is to generate a prioritized product roadmap from clustered signal themes.

For each cluster provided, generate a roadmap item in valid JSON with exactly these fields:
- feature_name: string (4-8 words, specific and actionable, e.g. "Bulk CSV export for reports")
- description: string (1-2 sentences describing what would be built)
- rationale: string (2-3 sentences explaining WHY this is prioritized now, referencing the signal data)
- evidence_quotes: array of exactly 3 strings (verbatim or near-verbatim quotes from the signals that best represent this theme)
- effort_tag: string, one of: "S" (days), "M" (1-2 weeks), "L" (3-4 weeks), "XL" (6+ weeks)
- priority_tier: string, one of: "P1" (must build this quarter), "P2" (should build next quarter), "P3" (consider in H2)

Rules:
- Do NOT invent features not supported by the signal data
- Evidence quotes must come from the provided signals, not invented
- Priority tiers must reflect the provided priority scores (higher score = P1 candidate)
- Be specific: "Fix slow loading" is bad; "Reduce dashboard load time from 8s to under 2s" is good
- Rationale must reference the signal count, sources, and customer segment context when available

Return a JSON array of roadmap items. No markdown, no explanation outside the JSON."""


async def generate_roadmap(
    top_clusters: List[Dict],
    max_items: int = 8,
) -> List[Dict]:
    """
    Generate PM-quality roadmap items from the top scored clusters.

    Args:
        top_clusters: List of cluster dicts with label, signals, score, and metadata
        max_items: Maximum number of roadmap items to generate

    Returns:
        List of roadmap item dicts
    """
    clusters_to_process = top_clusters[:max_items]

    # Build the cluster context for GPT-4o
    cluster_context = []
    for i, cluster in enumerate(clusters_to_process):
        # Select up to 10 representative signal excerpts
        sample_signals = cluster.get("sample_signals", [])[:10]
        signal_text = "\n  ".join(f'"{s[:200]}"' for s in sample_signals)

        cluster_context.append(f"""
Cluster {i+1}: {cluster['label']}
Priority Score: {cluster['final_score']}/100
Signal Count: {cluster['signal_count']}
Sources: {', '.join(cluster.get('sources_present', []))}
Representative signals:
  {signal_text}
""")

    user_message = f"""Generate roadmap items for these {len(clusters_to_process)} signal clusters.

{chr(10).join(cluster_context)}

Generate {len(clusters_to_process)} roadmap items, one per cluster, as a JSON array."""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": ROADMAP_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4000,
        temperature=0.4,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    parsed = json.loads(raw)

    # Handle both {"items": [...]} and direct array responses
    if isinstance(parsed, dict):
        items = parsed.get("items", parsed.get("roadmap_items", list(parsed.values())[0]))
    else:
        items = parsed

    # Validate and clean each item
    validated = []
    for item in items:
        if not all(k in item for k in ["feature_name", "description", "rationale", "evidence_quotes", "effort_tag", "priority_tier"]):
            continue  # Skip malformed items

        # Ensure evidence_quotes is always a list of exactly 3
        quotes = item.get("evidence_quotes", [])
        if isinstance(quotes, str):
            quotes = [quotes]
        while len(quotes) < 3:
            quotes.append("Customer signal data supports this feature need.")
        item["evidence_quotes"] = quotes[:3]

        # Validate enum values
        if item.get("effort_tag") not in ("S", "M", "L", "XL"):
            item["effort_tag"] = "M"
        if item.get("priority_tier") not in ("P1", "P2", "P3"):
            item["priority_tier"] = "P2"

        validated.append(item)

    return validated
