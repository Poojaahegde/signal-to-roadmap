# Product Requirements Document
# Signal to Roadmap — v1.0

**Author:** Pooja Hegde  
**Status:** MVP Complete  
**Last Updated:** May 2026

---

## Problem Statement

Product managers at SaaS companies receive customer signals from multiple channels simultaneously — support tickets, sales call recordings, app store reviews, NPS verbatims, Slack messages. Each source is valuable. None of them are connected. The synthesis step — reading everything, finding patterns, estimating importance, making prioritization decisions — is entirely manual and takes 8-15 hours per planning cycle.

The result is roadmaps that are either HiPPO-driven (the highest-paid person's opinion wins), recency-biased (whoever shouted last gets prioritized), or analysis-paralyzed (so much data, nothing gets decided). All three outcomes are expensive.

Signal to Roadmap automates the synthesis layer. It does not replace PM judgment — it gives PMs a structured, evidence-backed starting point they can refine, challenge, and present with confidence.

---

## Target Users

### Primary: Sprint-Cycle PM
**Who:** Senior PM at a B2B SaaS company (Series A to Series C), 3-6 years experience  
**Context:** Manages roadmap across 2-4 squads. Receives signals from Intercom, Gong, G2, and Slack  
**Pain:** Spends 8-12 hours per sprint manually synthesizing signals into a defensible roadmap  
**Job to be done:** When I have a flood of customer signals before planning, I want to quickly find the real patterns so that I can walk into the planning meeting with evidence-backed priorities  

### Secondary: Founding PM
**Who:** First PM at a 15-30 person startup, no dedicated research team  
**Context:** Handles discovery, delivery, and customer support in parallel  
**Pain:** No time for rigorous synthesis; roadmap decisions often made on gut feel or loudest voice  
**Job to be done:** When I only have 30 minutes before our planning meeting, I want a fast way to turn raw customer feedback into something structured enough to present to the founders  

---

## Goals

### User Goals
- Reduce time from signal collection to roadmap draft from 8-15 hours to under 15 minutes
- Give PMs a defensible, evidence-backed starting point for planning discussions
- Make the AI reasoning transparent and challengeable — not a black box

### Business Goals (if this were a real product)
- Reach 100 weekly active PMs within 3 months of launch
- Achieve NPS >= 40 from PM users
- Demonstrate Week-4 retention >= 40%

### Non-Goals for v1.0
- Replacing PM judgment or decision-making authority
- Real-time signal ingestion from live APIs (v1.1)
- Multi-user collaboration (v1.4)
- Authentication and persistent user accounts (v1.4)

---

## Functional Requirements

### FR-1: Signal Ingestion
- User can paste raw text or upload a CSV for each of 3 source types: Support Tickets, Sales Call Notes, Product Reviews
- Each source type has a separate tab in the ingestion UI
- CSV upload: one required column (content), two optional columns (date: YYYY-MM-DD, segment: enterprise/smb/individual)
- System accepts up to 500 signal entries per source in demo mode
- Signals are stored persistently in a session — user can add more signals before running analysis

### FR-2: Theme Clustering
- On "Analyze" click, system embeds all signals using OpenAI text-embedding-3-small
- System runs KMeans clustering with silhouette-score auto-k (range: 3-10)
- Each cluster receives a GPT-4o-generated label (3-6 words, specific and actionable)
- System displays cluster visualization (bubble chart: x-axis = recency, y-axis = frequency, bubble size = cross-source coverage)

### FR-3: Signal Scoring
Each cluster is scored on a weighted formula:
- Frequency weight 0.40: Signal volume for this theme
- Recency weight 0.25: Exponential decay on signal dates (half-life 180 days)
- Segment weight 0.20: Enterprise signals weighted 3x, SMB 1.5x, Individual 1.0x
- Cross-source bonus weight 0.15: Cluster appearing in 2+ sources gets proportional bonus
- Final score normalized to 0-100

### FR-4: Roadmap Generation
- User clicks "Generate Roadmap"
- System sends top-N clusters (default 8) to GPT-4o with structured output prompt
- GPT-4o returns for each cluster: Feature Name, One-line Description, Prioritization Rationale, 3 Evidence Quotes, Effort Tag, Priority Tier
- System displays roadmap as card grid sorted by Priority Tier then score

### FR-5: Challenge Mode
- User can click "Challenge This" on any roadmap card
- Opens a Q&A panel pre-loaded with item context
- GPT-4o responds grounded in signal evidence, not invented data
- Conversation history preserved within the session

### FR-6: Export
- User can export the full roadmap as a Markdown file
- Export includes: session stats, cluster scores, roadmap cards with full reasoning and evidence

### FR-7: Demo Mode
- On landing, "Try Demo" loads a pre-built session with realistic data
- All features work; AI calls use real API if key is set, cached responses if not

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| Analysis pipeline latency | Under 45 seconds for 500 signals |
| Roadmap generation latency | Under 20 seconds |
| Page load time | Under 2 seconds |
| Browser support | Chrome, Firefox, Safari (latest) |
| Mobile | Responsive for viewing; input optimized for desktop |

---

## MVP Scope Decision

We explicitly defer the following to keep v1.0 scope tight:

| Deferred | Rationale |
|---|---|
| Intercom/Gong/G2 API integrations | High implementation complexity; paste/CSV covers 80% of use cases for early adopters |
| Authentication | Increases setup friction for evaluators; v1.4 |
| Real-time re-scoring | Adds infrastructure complexity; planning cycles are weekly not real-time |
| HDBSCAN clustering | More complex; KMeans is interpretable and sufficient at this signal volume |
| pgvector/ChromaDB | Overkill at <500 signals; explicit prod upgrade path documented |

---

## Success Metrics

### Primary
- **Time to roadmap draft:** Median < 15 minutes from first signal input (vs 8-15 hours baseline)
- **PM confidence rating:** >= 4/5 on "This gave me a useful starting point for planning"

### Secondary
- **Challenge mode usage rate:** >= 30% of sessions include at least one challenge question
- **Export rate:** >= 60% of completed sessions result in an export
- **Week-4 WAU retention:** >= 40%

### Leading indicators (if public)
- GitHub stars growth rate
- Demo session completion rate (reach roadmap output)
- Organic mentions / shares

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GPT-4o output quality inconsistent | Medium | High | Structured output format + validation layer; explicit fallbacks |
| Clustering produces irrelevant clusters | Medium | High | Silhouette-based auto-k; user can re-run; label quality acts as quality signal |
| OpenAI API cost too high for free demo | Low | Medium | Demo mode with cached responses; rate limiting |
| Small signal sets (< 20 signals) produce poor clusters | High | Medium | Minimum threshold enforced (5 signals); documentation advises 30+ per source |
| PMs don't trust AI-generated roadmap | Medium | High | Challenge mode + evidence quotes address trust; transparency is a core design principle |

---

## Roadmap (Post-MVP)

| Version | Theme | Key Features |
|---|---|---|
| v1.1 | Integrations | Intercom API, Gong transcript sync, G2 review API |
| v1.2 | Better clustering | HDBSCAN for noise-robust clusters; manual cluster merging |
| v1.3 | Production infra | pgvector embedding storage; Redis caching; rate limiting |
| v1.4 | Collaboration | Multi-user sessions; team comments on roadmap items; Slack export |
| v1.5 | Delivery integration | Jira ticket creation from roadmap items; Linear sync |
| v2.0 | Continuous mode | Weekly re-scoring as new signals arrive; trend detection |
