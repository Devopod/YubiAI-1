import os
import re
import logging
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import APIChatRequest, APIChatResponse
from app.auth import verify_api_key
from app.routes.chat_routes import GROQ_API_URL, GROQ_API_KEYS, GROQ_MODEL, GROQ_FALLBACK_MODELS
from app.utils.web_tools import gather_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["External API"])

# Available models users can choose from
AVAILABLE_MODELS = {
    "gpt-oss-120b": "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant": "llama-3.1-8b-instant",
    "llama3-8b-8192": "llama3-8b-8192",
}
DEFAULT_MODEL = "gpt-oss-120b"

SYSTEM_PROMPT = (
    "You are Yubi, the AI assistant by Devopod Private Limited. You are smart, helpful, and comprehensive — similar to ChatGPT or Claude. "
    "Be direct and answer questions immediately. Do NOT start every response with a greeting or self-introduction. "
    "Only introduce yourself if the user explicitly asks 'who are you?' or greets you for the first time. "
    "Be thorough, well-structured, and comprehensive. Use headers, bullet points, and formatting when helpful. "
    "Match the user's language automatically (English, Bengali, Banglish, Hindi, etc.). "
    "Do NOT automatically include URLs in every response — only include them when the user asks for links/resources or when they directly support the answer. "
    "NEVER fabricate URLs. Only share URLs from [WEB SEARCH RESULTS] or [REFERENCE DATA] provided to you. "
    "When [YOUTUBE SEARCH RESULTS (LIVE)] are provided and user asked for videos, share the YouTube links. "
    "NEVER mention internal tags like [WEB SEARCH RESULTS (LIVE)] in your response. "
    "Important: The current PM of Bangladesh is Tarique Rahman (sworn in 17 Feb 2026 after BNP won the 12 Feb 2026 election). "
    "Sheikh Hasina resigned on 5 Aug 2024 and fled to India. Do NOT say Sheikh Hasina is PM."
)


@router.get("/models")
async def list_models():
    """List all available AI models."""
    return {
        "models": [
            {"id": "gpt-oss-120b", "name": "GPT-OSS 120B", "description": "Most capable reasoning model (default)", "max_tokens": 32768},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "description": "Fast and versatile general-purpose model", "max_tokens": 32768},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "description": "Ultra-fast lightweight model", "max_tokens": 8192},
            {"id": "llama3-8b-8192", "name": "Llama 3 8B", "description": "Efficient model with 8K context", "max_tokens": 8192},
        ],
        "default": DEFAULT_MODEL,
    }


@router.post("/chat", response_model=APIChatResponse)
async def api_chat(
    data: APIChatRequest,
    authorization: str = Header(..., description="API Key in format: Bearer yubi-xxxx"),
    db: Session = Depends(get_db),
):
    # Extract API key
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format. Use: Bearer <api_key>")

    api_key = authorization.replace("Bearer ", "").strip()
    user = verify_api_key(api_key, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    # Resolve model
    model_id = data.model or DEFAULT_MODEL
    groq_model = AVAILABLE_MODELS.get(model_id)
    if not groq_model:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model '{model_id}'. Available: {list(AVAILABLE_MODELS.keys())}",
        )

    # Build messages
    now = datetime.now(timezone.utc)
    datetime_info = f"\n\nCurrent date and time: {now.strftime('%A, %B %d, %Y at %I:%M %p')} UTC."
    system_content = (data.system_prompt or SYSTEM_PROMPT) + datetime_info
    messages = [{"role": "system", "content": system_content}]

    if data.conversation_history:
        for msg in data.conversation_history:
            if "role" in msg and "content" in msg:
                messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": data.message})

    # Gather external context (URLs, YouTube, web search)
    is_continue = data.message.strip().lower() in ["continue", "continue.", "go on", "keep going"]
    if not is_continue:
        try:
            external_context = await gather_context(data.message, conversation_history=messages)
            if external_context:
                messages[-1]["content"] = data.message + "\n\n" + external_context
        except Exception as e:
            logger.error(f"Error gathering context for API: {e}")

    # Build Groq API payload with user-specified parameters
    is_reasoning = groq_model.startswith("openai/")
    payload: dict = {
        "model": groq_model,
        "messages": messages,
        "temperature": data.temperature,
        "top_p": data.top_p,
    }

    # Token limits
    if is_reasoning:
        payload["max_completion_tokens"] = data.max_tokens
    else:
        payload["max_tokens"] = data.max_tokens

    # Optional parameters (only include if non-default to keep payload clean)
    if data.frequency_penalty and data.frequency_penalty != 0.0:
        payload["frequency_penalty"] = data.frequency_penalty
    if data.presence_penalty and data.presence_penalty != 0.0:
        payload["presence_penalty"] = data.presence_penalty
    if data.stop:
        payload["stop"] = data.stop
    if data.seed is not None:
        payload["seed"] = data.seed

    # Call Groq API with key rotation and model fallback
    if not GROQ_API_KEYS:
        raise HTTPException(status_code=500, detail="No API keys configured")

    # Try requested model first, then fallback models
    models_to_try = [groq_model]
    if groq_model == GROQ_MODEL:
        models_to_try.extend(GROQ_FALLBACK_MODELS)

    used_model = model_id

    for try_model in models_to_try:
        payload["model"] = try_model
        if try_model.startswith("openai/"):
            payload.pop("max_tokens", None)
            payload["max_completion_tokens"] = data.max_tokens
        else:
            payload.pop("max_completion_tokens", None)
            payload["max_tokens"] = data.max_tokens

        for key in GROQ_API_KEYS:
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(
                        GROQ_API_URL,
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {key}",
                        },
                    )

                    if resp.status_code == 429:
                        logger.warning(f"Rate limited on {try_model}, trying next...")
                        continue
                    if resp.status_code != 200:
                        logger.error(f"Groq API error {resp.status_code} on {try_model}: {resp.text}")
                        continue

                    result = resp.json()
                    choices = result.get("choices", [])
                    if choices:
                        response_text = choices[0].get("message", {}).get("content", "").strip()
                        raw_usage = result.get("usage", {})
                        usage_data = {
                            "prompt_tokens": raw_usage.get("prompt_tokens", 0),
                            "completion_tokens": raw_usage.get("completion_tokens", 0),
                            "total_tokens": raw_usage.get("total_tokens", 0),
                        }
                        for uid, gid in AVAILABLE_MODELS.items():
                            if gid == try_model:
                                used_model = uid
                                break
                        if response_text:
                            return APIChatResponse(
                                response=response_text,
                                model=used_model,
                                usage=usage_data,
                            )
            except Exception as e:
                logger.error(f"Groq API error on {try_model}: {e}")
                continue

    raise HTTPException(status_code=503, detail="All AI models are currently unavailable. Please try again later.")
