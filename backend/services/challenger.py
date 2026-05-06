"""
challenger.py — GPT-4o Q&A chain for roadmap item challenges.

Allows PMs to ask adversarial questions about any roadmap item:
- "Why was this prioritized above X?"
- "What would cause this to be de-prioritized?"
- "What's the strongest counter-argument to building this?"
- "What assumptions does this depend on?"

Responses are grounded in the signal evidence and scoring data.
"""

import os
from typing import List, Dict
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


CHALLENGER_SYSTEM_PROMPT = """You are a rigorous product thinking partner helping a PM stress-test a roadmap decision.

You have access to the context of a specific roadmap item and the signal evidence that generated it.
Your job is to answer PM questions about this item honestly, including:
- Explaining the prioritization reasoning
- Identifying weaknesses or assumptions in the decision
- Suggesting what would cause this to be de-prioritized
- Offering counter-arguments where valid

Rules:
- Stay grounded in the signal evidence provided. Don't invent data.
- Be honest: if the evidence is thin, say so.
- Keep responses focused and under 200 words.
- Be direct, not diplomatic. A PM needs honest pushback, not validation."""


async def challenge_item(
    roadmap_item: Dict,
    message: str,
    conversation_history: List[Dict],
) -> str:
    """
    Respond to a PM's challenge question about a specific roadmap item.

    Args:
        roadmap_item: The full roadmap item dict with feature_name, rationale, etc.
        message: The PM's current question or challenge
        conversation_history: Previous messages in this challenge session

    Returns:
        GPT-4o response string
    """
    # Build context about the roadmap item
    item_context = f"""Roadmap Item: {roadmap_item['feature_name']}
Priority Tier: {roadmap_item['priority_tier']}
Effort: {roadmap_item['effort_tag']}
Priority Score: {roadmap_item.get('priority_score', 'N/A')}/100

Description: {roadmap_item['description']}

Rationale: {roadmap_item['rationale']}

Evidence signals:
{chr(10).join(f'- "{q}"' for q in roadmap_item.get('evidence_quotes', []))}"""

    messages = [
        {"role": "system", "content": CHALLENGER_SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"Context for this discussion:\n\n{item_context}",
        },
    ]

    # Add conversation history (limit to last 6 exchanges to manage context window)
    for msg in conversation_history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Add the current user message
    messages.append({"role": "user", "content": message})

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=400,
        temperature=0.5,
    )

    return response.choices[0].message.content.strip()
