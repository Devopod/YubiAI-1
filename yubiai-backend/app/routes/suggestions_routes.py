"""Auto-rotating suggestion prompts.

Every 12 hours the LLM generates 4 fresh conversation-starter prompts.
Results are cached in a JSON file so they survive restarts.
"""

import os
import json
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/suggestions", tags=["Suggestions"])

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEYS = [
    key for key in [
        os.getenv("GROQ_API_KEY", ""),
        os.getenv("GROQ_API_KEY_2", ""),
    ] if key
]

_SUGGESTIONS_FILE = Path(__file__).resolve().parent.parent.parent / ".suggestions.json"
_ROTATION_MINUTES = 30

# Default prompts used until the first LLM generation completes
_DEFAULT_PROMPTS: List[str] = [
    "Write a Python function to sort a list",
    "Explain quantum computing simply",
    "Help me write a professional email",
    "Create a React component for a todo app",
]

# In-memory cache
_cached_prompts: List[str] = list(_DEFAULT_PROMPTS)
_last_generated: datetime | None = None
_generation_lock = asyncio.Lock()


def _load_from_disk() -> tuple[List[str], datetime | None]:
    """Load cached suggestions from disk."""
    try:
        if _SUGGESTIONS_FILE.exists():
            data = json.loads(_SUGGESTIONS_FILE.read_text())
            prompts = data.get("prompts", [])
            ts = data.get("generated_at")
            generated_at = datetime.fromisoformat(ts) if ts else None
            if prompts and len(prompts) == 4:
                return prompts, generated_at
    except Exception as e:
        logger.warning(f"Failed to load suggestions from disk: {e}")
    return list(_DEFAULT_PROMPTS), None


def _save_to_disk(prompts: List[str], generated_at: datetime) -> None:
    """Persist suggestions to disk."""
    try:
        _SUGGESTIONS_FILE.write_text(json.dumps({
            "prompts": prompts,
            "generated_at": generated_at.isoformat(),
        }, indent=2))
    except Exception as e:
        logger.warning(f"Failed to save suggestions to disk: {e}")


async def _generate_prompts_via_llm() -> List[str] | None:
    """Call Groq API to generate 4 fresh suggestion prompts."""
    if not GROQ_API_KEYS:
        logger.warning("No GROQ_API_KEYS configured, cannot generate suggestions")
        return None

    system_msg = (
        "You are a helpful assistant. Generate exactly 4 short, diverse conversation-starter prompts "
        "for an AI chatbot. Each prompt should be a single sentence, max 60 characters. "
        "Cover different categories: coding, writing, learning, and creative tasks. "
        "Return ONLY a JSON array of 4 strings, no other text. Example:\n"
        '[\"Write a Python web scraper\", \"Explain blockchain simply\", '
        '\"Draft a cover letter\", \"Design a database schema\"]'
    )

    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": "Generate 4 new diverse AI chat suggestion prompts."},
    ]

    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-8b-8192"]

    for model in models:
        for key in GROQ_API_KEYS:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        GROQ_API_URL,
                        json={
                            "model": model,
                            "messages": messages,
                            "max_tokens": 200,
                            "temperature": 0.9,
                        },
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {key}",
                        },
                    )
                    if resp.status_code != 200:
                        continue

                    content = resp.json()["choices"][0]["message"]["content"].strip()
                    # Parse JSON array from response
                    # Handle cases where LLM wraps in markdown code block
                    if content.startswith("```"):
                        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                    prompts = json.loads(content)
                    if isinstance(prompts, list) and len(prompts) == 4:
                        return [str(p).strip() for p in prompts]
            except Exception as e:
                logger.warning(f"Suggestion generation failed with {model}: {e}")
                continue

    return None


async def _maybe_refresh() -> List[str]:
    """Refresh prompts if 12 hours have passed since last generation."""
    global _cached_prompts, _last_generated

    now = datetime.now(timezone.utc)

    # Check if refresh is needed
    if _last_generated and (now - _last_generated) < timedelta(minutes=_ROTATION_MINUTES):
        return _cached_prompts

    # Try to acquire lock (non-blocking for concurrent requests)
    if _generation_lock.locked():
        return _cached_prompts

    async with _generation_lock:
        # Double-check after acquiring lock
        if _last_generated and (now - _last_generated) < timedelta(minutes=_ROTATION_MINUTES):
            return _cached_prompts

        logger.info("Generating new suggestion prompts via LLM...")
        new_prompts = await _generate_prompts_via_llm()
        if new_prompts:
            _cached_prompts = new_prompts
            _last_generated = now
            _save_to_disk(new_prompts, now)
            logger.info(f"New suggestions generated: {new_prompts}")
        else:
            logger.warning("Failed to generate new suggestions, keeping current ones")
            _last_generated = now  # Avoid retrying immediately

    return _cached_prompts


def init_suggestions() -> None:
    """Load suggestions from disk on startup."""
    global _cached_prompts, _last_generated
    _cached_prompts, _last_generated = _load_from_disk()
    logger.info(f"Loaded suggestions: {_cached_prompts} (generated: {_last_generated})")


@router.get("/")
async def get_suggestions():
    """Return current suggestion prompts. Triggers refresh if stale."""
    prompts = await _maybe_refresh()
    return {"prompts": prompts}
