"""
embedder.py — OpenAI embedding wrapper with batching.

Uses text-embedding-3-small for cost efficiency.
Batches requests to stay within token limits and reduce API calls.
"""

import os
import json
from typing import List
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EMBEDDING_MODEL = "text-embedding-3-small"
BATCH_SIZE = 100  # OpenAI allows up to 2048 inputs per request; 100 is safe with long texts


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Embed a list of texts in batches. Returns a list of embedding vectors.

    Args:
        texts: List of raw text strings to embed.

    Returns:
        List of float vectors, one per input text, in the same order.
    """
    all_embeddings: List[List[float]] = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]

        # Clean inputs: strip, replace newlines (improves embedding quality per OpenAI docs)
        cleaned = [t.strip().replace("\n", " ")[:8000] for t in batch]

        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=cleaned,
        )

        # Sort by index to preserve order (OpenAI returns them in order, but be explicit)
        batch_embeddings = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings


def serialize_embedding(embedding: List[float]) -> str:
    """Serialize embedding to JSON string for SQLite storage."""
    return json.dumps(embedding)


def deserialize_embedding(embedding_json: str) -> List[float]:
    """Deserialize embedding from JSON string stored in SQLite."""
    return json.loads(embedding_json)
