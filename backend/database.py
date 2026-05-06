"""
database.py — SQLite connection and schema initialization.

Uses aiosqlite for async compatibility with FastAPI.
Swap DATABASE_PATH for a PostgreSQL connection string in production.
"""

import aiosqlite
import os

DATABASE_PATH = os.getenv("DATABASE_PATH", "./signal_to_roadmap.db")


async def get_db() -> aiosqlite.Connection:
    """Yield an aiosqlite connection. Used as a FastAPI dependency."""
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    """Create all tables on first run. Called from app startup event."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT PRIMARY KEY,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                name        TEXT,
                status      TEXT DEFAULT 'ingesting'
            );

            CREATE TABLE IF NOT EXISTS signals (
                id               TEXT PRIMARY KEY,
                session_id       TEXT NOT NULL,
                source_type      TEXT NOT NULL CHECK(source_type IN ('support','sales','review')),
                content          TEXT NOT NULL,
                signal_date      TEXT,
                customer_segment TEXT,
                embedding        TEXT,
                cluster_id       INTEGER,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS clusters (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id          TEXT NOT NULL,
                cluster_index       INTEGER NOT NULL,
                label               TEXT NOT NULL,
                signal_count        INTEGER DEFAULT 0,
                avg_recency_score   REAL DEFAULT 0.0,
                frequency_score     REAL DEFAULT 0.0,
                segment_score       REAL DEFAULT 0.0,
                cross_source_bonus  REAL DEFAULT 0.0,
                final_score         REAL DEFAULT 0.0,
                sources_present     TEXT,
                created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS roadmap_items (
                id              TEXT PRIMARY KEY,
                session_id      TEXT NOT NULL,
                cluster_id      INTEGER,
                feature_name    TEXT NOT NULL,
                description     TEXT NOT NULL,
                rationale       TEXT NOT NULL,
                evidence_quotes TEXT NOT NULL,
                effort_tag      TEXT NOT NULL CHECK(effort_tag IN ('S','M','L','XL')),
                priority_tier   TEXT NOT NULL CHECK(priority_tier IN ('P1','P2','P3')),
                priority_score  REAL NOT NULL,
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (cluster_id) REFERENCES clusters(id)
            );

            CREATE TABLE IF NOT EXISTS challenge_messages (
                id              TEXT PRIMARY KEY,
                roadmap_item_id TEXT NOT NULL,
                role            TEXT NOT NULL CHECK(role IN ('user','assistant')),
                content         TEXT NOT NULL,
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (roadmap_item_id) REFERENCES roadmap_items(id) ON DELETE CASCADE
            );
        """)
        await db.commit()
