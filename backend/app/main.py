"""CCOS API entrypoint."""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routers import ai, ara, marketplace, passport, returns, sustainability, users

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Circular Commerce Operating System — AI-powered returns, resale, and sustainability.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    # Auto-seed on first boot if the DB is empty (handy for `uvicorn` without a seed step).
    if settings.database_url.startswith("sqlite") and not os.path.exists("ccos.db"):
        from .seed import seed

        seed()


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "ai_mode": "bedrock" if settings.use_bedrock else "deterministic-local",
    }


for r in (users, returns, ai, marketplace, sustainability, passport, ara):
    app.include_router(r.router)
