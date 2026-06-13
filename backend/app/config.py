"""Runtime configuration for the CCOS backend.

Everything has a safe default so the demo runs with zero external dependencies.
Flip USE_BEDROCK=1 (and provide AWS credentials) to route GenAI/CV calls to real
Amazon Bedrock + Rekognition instead of the deterministic local engines.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CCOS_", extra="ignore")

    app_name: str = "Second Life Commerce — CCOS"
    environment: str = "hackathon"

    # SQLite by default; point at Postgres (Aurora) in production.
    database_url: str = "sqlite:///./ccos.db"

    # AI routing
    use_bedrock: bool = False
    bedrock_model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    aws_region: str = "us-east-1"

    # Green Credit economics (Section 9 of the blueprint)
    gc_cash_value_usd: float = 0.10  # 1 GC = $0.10
    gc_per_kg_co2e: float = 1.0  # 1 GC == 1 kg CO2e prevented

    # CORS for the Vite dev server
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
