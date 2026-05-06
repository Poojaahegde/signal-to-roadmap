"""
main.py — FastAPI application entrypoint.

Starts the server, configures CORS, registers all routers,
and initializes the SQLite database on startup.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import init_db
from routers import sessions, signals, analysis, roadmap, demo


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, clean up on shutdown."""
    await init_db()
    yield


app = FastAPI(
    title="Signal to Roadmap API",
    description="Turn raw customer signals into a prioritized product roadmap.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the Next.js dev server and any local origin during development.
# Tighten this to specific domains in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register feature routers
app.include_router(sessions.router, prefix="/api", tags=["sessions"])
app.include_router(signals.router, prefix="/api", tags=["signals"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(roadmap.router, prefix="/api", tags=["roadmap"])
app.include_router(demo.router, prefix="/api", tags=["demo"])


@app.get("/health")
async def health():
    """Lightweight health check for deployment readiness probes."""
    return {"status": "ok", "version": "1.0.0"}
