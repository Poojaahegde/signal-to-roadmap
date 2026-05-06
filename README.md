# Signal to Roadmap

> **Turn raw customer signals into a prioritized product roadmap — in under 15 minutes.**

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://typescriptlang.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-purple?logo=openai)](https://openai.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

Every PM I know has this problem: signals are everywhere, synthesis is nowhere.

You have 200 Intercom tickets from last sprint. A Gong export of 30 sales calls. A G2 review digest. Your CEO just forwarded three customer tweets. And planning is tomorrow.

So you spend 8-12 hours reading, tagging, grouping, and arguing with yourself about what matters then present a roadmap that someone with more seniority immediately challenges because they heard something different from one customer last week.

I built Signal to Roadmap because I wanted a tool that does the synthesis layer the way a rigorous PM would: multi-source ingestion, evidence-based clustering, weighted prioritization, and written reasoning for every decision.

---

## What It Does

Signal to Roadmap takes unstructured text from three sources PMs actually use:

- **Support tickets** — the raw voice of frustrated customers
- **Sales call notes** — what buyers say when they are deciding whether to pay
- **Product reviews** (G2, Trustpilot, App Store) — public, unfiltered sentiment

It embeds every signal, clusters them into themes using KMeans on OpenAI embeddings, scores each theme by frequency + recency + customer segment weight, and uses GPT-4o to generate a prioritized roadmap with PM-quality reasoning for each item.

The output looks like something you would walk into a planning meeting with.

---

## Demo

> **No API key required to explore the demo.** Load the pre-built sample dataset and browse all features with cached AI responses.

```bash
git clone https://github.com/Poojaahegde/signal-to-roadmap.git
cd signal-to-roadmap

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 &

# Frontend (new terminal)
cd ../frontend
npm install && npm run dev
```

Open http://localhost:3000 and click **Try Demo** to explore with pre-loaded data.

---

## Architecture

```
Browser (Next.js 14 + TypeScript + Tailwind CSS)
        |
        |  REST API
        v
FastAPI Backend (Python 3.11)
  |- embedder.py          OpenAI text-embedding-3-small
  |- clusterer.py         KMeans + silhouette auto-k + GPT-4o cluster labels
  |- scorer.py            Frequency x recency x segment weighting
  |- roadmap_generator.py GPT-4o chain-of-thought roadmap generation
  |- challenger.py        GPT-4o Q&A grounded in cluster evidence
        |
        |- SQLite (demo) / PostgreSQL (prod — one env var swap)
        |- OpenAI API (text-embedding-3-small + GPT-4o)
```

**Key architecture decisions:**

- **SQLite for demo, PostgreSQL-ready for prod.** One environment variable controls the database. No migration friction for reviewers cloning locally.
- **KMeans over HDBSCAN.** More interpretable at this signal volume, stable k via silhouette score, easier to explain in a planning meeting. HDBSCAN is on the v1.2 roadmap.
- **No vector DB in v1.0.** Embeddings stored as JSON blobs in SQLite. Works fine under 500 signals. Production path is pgvector or ChromaDB.
- **GPT-4o as both generator and challenger.** Judge model pattern. Expensive per call, but output quality appropriate for a portfolio demo. Production would cache aggressively.

---

## How the Scoring Works

Each signal cluster gets a composite score normalized to 0-100:

```
Final Score = (
    frequency_score    x 0.40   # How many signals mention this theme?
  + recency_score      x 0.25   # Are recent signals driving this? (exponential decay on date)
  + segment_score      x 0.20   # Are enterprise customers raising it?
  + cross_source_bonus x 0.15   # Does it appear in support AND sales AND reviews?
)
```

The cross_source_bonus is the most interesting signal. If customers complain about X in support tickets, sales calls mention X as a deal blocker, and reviews dock stars for X — that convergence is a genuine product signal, not noise from one frustrated user.

---

## Features

- **Multi-source ingestion** — paste text or upload CSV for support tickets, sales notes, and reviews
- **Auto-clustering** — silhouette score auto-detects optimal cluster count (3-10)
- **GPT-4o cluster labeling** — each cluster gets a concise, accurate theme label from representative signals
- **Weighted signal scoring** — frequency, recency decay, segment weighting, cross-source bonus
- **PM-quality roadmap generation** — feature name, description, 2-3 sentence rationale, 3 evidence verbatims, effort tag (S/M/L/XL), priority tier (P1/P2/P3)
- **Challenge Mode** — ask the AI why a specific item was prioritized, what would de-prioritize it, what the counter-argument is
- **Markdown export** — one-click export of the full roadmap with evidence and reasoning
- **Demo mode** — pre-loaded realistic dataset with cached AI responses, no API key needed

---

## Project Structure

```
signal-to-roadmap/
|- backend/
|   |- main.py                    FastAPI entrypoint, CORS, startup
|   |- database.py                SQLite connection and schema
|   |- models.py                  Pydantic request and response models
|   |- routers/
|   |   |- sessions.py            Session CRUD
|   |   |- signals.py             Signal ingestion
|   |   |- analysis.py            Embed + cluster + score pipeline
|   |   |- roadmap.py             Roadmap generation and challenge Q&A
|   |   |- demo.py                Demo data loader
|   |- services/
|   |   |- embedder.py            OpenAI embedding wrapper with batching
|   |   |- clusterer.py           KMeans, silhouette auto-k, GPT-4o labeling
|   |   |- scorer.py              Composite scoring with configurable weights
|   |   |- roadmap_generator.py   GPT-4o structured roadmap generation
|   |   |- challenger.py          GPT-4o Q&A with evidence grounding
|   |   |- exporter.py            Markdown export builder
|   |- data/demo/
|   |   |- support_tickets.csv    150 realistic support tickets (B2B SaaS)
|   |   |- sales_notes.csv        50 sales call note summaries
|   |   |- reviews.csv            80 product reviews
|   |- tests/
|   |   |- test_clusterer.py
|   |   |- test_scorer.py
|   |   |- test_api.py
|   |- requirements.txt
|- frontend/
|   |- src/
|   |   |- app/                   Next.js 14 App Router
|   |   |   |- page.tsx           Landing page
|   |   |   |- session/[id]/
|   |   |       |- ingest/        Signal ingestion UI
|   |   |       |- analyze/       Cluster visualization
|   |   |       |- roadmap/       Roadmap output + Challenge panel
|   |   |- components/
|   |   |   |- ui/                Button, Card, Badge, Tabs, Spinner
|   |   |   |- ingestion/         SignalTab, CSVUploader
|   |   |   |- analysis/          ClusterBubbleChart, ClusterList
|   |   |   |- roadmap/           RoadmapCard, ChallengePanel, ExportButton
|   |   |- lib/
|   |   |   |- api.ts             Typed API client
|   |   |   |- types.ts           Shared TypeScript types
|   |   |- hooks/
|   |       |- useSession.ts
|   |       |- useRoadmap.ts
|   |- package.json
|   |- tailwind.config.ts
|- docs/
|   |- PRODUCT_BRIEF.md
|   |- PRD.md
|   |- ARCHITECTURE.md
|   |- DEMO_SCRIPT.md
|- .env.example
|- docker-compose.yml
|- README.md
```

---

## Setup Guide

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key (for live mode; demo mode works without one)

### 1. Clone and configure

```bash
git clone https://github.com/Poojaahegde/signal-to-roadmap.git
cd signal-to-roadmap
cp .env.example .env
# Set OPENAI_API_KEY in .env
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Interactive API docs at http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### 4. Docker

```bash
docker-compose up
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/sessions | Create a new analysis session |
| POST | /api/sessions/{id}/signals | Ingest signals |
| POST | /api/sessions/{id}/analyze | Run embed -> cluster -> score |
| GET | /api/sessions/{id}/clusters | Get cluster results |
| POST | /api/sessions/{id}/roadmap | Generate AI roadmap |
| GET | /api/sessions/{id}/roadmap | Retrieve saved roadmap |
| POST | /api/roadmap-items/{id}/challenge | Challenge a roadmap item |
| GET | /api/sessions/{id}/export | Export roadmap as Markdown |
| GET | /api/demo/load | Load pre-built demo session |

Full Swagger UI at http://localhost:8000/docs

---

## Product Thinking

### Why this exists

Roadmap decisions are only as good as the signal synthesis that informs them. The synthesis step is currently manual, bias-prone, and time-intensive. This tool does not replace PM judgment — it gives PMs a structured, evidence-backed starting point to refine, challenge, and present with confidence.

### Target users

- Senior PMs at B2B SaaS companies with signal overload across multiple channels
- Founding PMs at startups who need fast synthesis without a research team
- Product researchers surfacing themes across large transcript sets

### Conscious tradeoffs

| Decision | Chosen | Alternative | Reasoning |
|---|---|---|---|
| Clustering | KMeans | HDBSCAN | More interpretable; stable k via silhouette |
| Embedding storage | SQLite JSON | ChromaDB / pgvector | Simpler demo setup; swappable for prod |
| LLM | GPT-4o | GPT-3.5-turbo | Output quality matters here |
| Auth | None in v1.0 | Clerk / Auth.js | Reduces setup friction for evaluators |

### Success metrics for a real product

- Time to roadmap draft under 15 minutes vs 8-12 hours manually
- PM confidence rating 4/5 or higher after use
- Roadmap item acceptance rate in planning meetings 70%+
- Week-4 weekly active user retention 40%+

### Roadmap

- v1.1: Intercom, Gong, G2 API integrations
- v1.2: HDBSCAN clustering for noise-robust detection
- v1.3: pgvector / ChromaDB for production embedding storage
- v1.4: Multi-user sessions and team collaboration
- v1.5: Jira and Linear ticket export
- v2.0: Continuous mode — re-score roadmap weekly

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

---

## Interview Talking Points

**Product intuition:** The scoring formula models how a rigorous PM thinks about signal weighting. Each coefficient has a product rationale. The cross-source bonus directly captures the triangulated signal heuristic experienced PMs use informally.

**Technical execution:** The embed -> cluster -> score -> generate pipeline is a real architecture used in production customer intelligence systems.

**Tradeoff documentation:** Architecture section documents what was chosen, what was not, and why — what senior engineers and product leaders expect in design reviews.

**Demo mode:** Built so any reviewer can explore the full product without an API key. Respecting the reviewer's time is itself a product decision.

---

## Contributing

Pull requests welcome. Please open an issue first for significant changes.

---

## License

MIT. See LICENSE for details.

---

*Built by [Pooja Hegde](https://github.com/Poojaahegde) — AI Product Builder | LLMs · NLP · Data-driven PM*
