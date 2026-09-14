"""Runtime configuration, read once from the environment.

Config lives in this project's own `.env` (see `.env.example`), not the
webapp's. Values already exported in the shell take precedence.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# Confidence at or above which an LLM-completed draft may auto-publish.
LLM_CONFIDENCE_THRESHOLD = 0.90

# Fields that must be present for a garment to auto-publish. `procedure` and
# `process` are excluded deliberately: on the 313 human-verified Library
# garments, procedure is null on 56% and process on 31%.
REQUIRED_FIELDS = ("category", "type", "gender", "model", "material", "color")

# Jewelry has no color code — silver rings and chains simply don't carry one.
COLOR_EXEMPT_CATEGORY_PREFIX = "accessories.jewelry"

# Every field the pipeline may set on a garment.
GARMENT_FIELDS = (
    "title",
    "category",
    "type",
    "gender",
    "model",
    "procedure",
    "material",
    "process",
    "color",
)


def load_dotenv(path: Path = ENV_FILE) -> None:
    """Populate os.environ from `path` without overriding existing values."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class Config:
    api_url: str
    api_token: str
    anthropic_api_key: str | None
    request_delay: float
    llm_threshold: float

    @classmethod
    def load(cls) -> Config:
        load_dotenv()
        api_url = os.environ.get("WIKIPOELL_API_URL", "http://localhost:3000")
        token = os.environ.get("INGEST_API_TOKEN", "")
        return cls(
            api_url=api_url.rstrip("/"),
            api_token=token,
            anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY"),
            request_delay=float(os.environ.get("INGEST_REQUEST_DELAY", "1.5")),
            llm_threshold=float(
                os.environ.get("INGEST_LLM_THRESHOLD", LLM_CONFIDENCE_THRESHOLD)
            ),
        )

    def require_token(self) -> str:
        if not self.api_token:
            raise RuntimeError(
                "INGEST_API_TOKEN is not set — add it to the repo-root .env"
            )
        return self.api_token
