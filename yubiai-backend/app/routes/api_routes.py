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
from app.routes.chat_routes import GROQ_API_URL, GROQ_API_KEYS, GROQ_MODEL, generate_ai_response
from app.utils.web_tools import gather_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["External API"])

SYSTEM_PROMPT = (
    "You are Yubi, the AI assistant by Devopods. You are smart, helpful, and comprehensive — similar to ChatGPT or Claude. "
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

    # Build messages with current datetime
    now = datetime.now(timezone.utc)
    datetime_info = (
        f"\n\nCurrent date and time: {now.strftime('%A, %B %d, %Y at %I:%M %p')} UTC."
    )
    messages = [{"role": "system", "content": SYSTEM_PROMPT + datetime_info}]
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

    # Detect extended mode (code generation)
    extended_mode = bool(
        re.search(r'\b(write|create|build|generate|make|code|implement|develop|program)\b', data.message, re.IGNORECASE)
        and re.search(r'\b(code|function|class|app|application|script|program|page|component|api|website|project)\b', data.message, re.IGNORECASE)
    ) or is_continue

    # Generate response with extended mode support
    try:
        ai_response = await generate_ai_response(messages, voice_mode=False, extended=extended_mode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation error: {str(e)}")

    usage = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
    }
    return APIChatResponse(response=ai_response, usage=usage)
