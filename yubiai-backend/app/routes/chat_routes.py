import os
import re
import logging
import httpx
import base64
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Chat, Message
from app.schemas import ChatCreate, ChatResponse, MessageCreate, MessageResponse, ChatWithMessages
from app.auth import get_current_user
from app.utils.web_tools import gather_context
from typing import List, Optional

# OCR is handled via OCR.space free API (no system deps needed)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chats", tags=["Chat"])

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEYS = [
    key for key in [
        os.getenv("GROQ_API_KEY", ""),
        os.getenv("GROQ_API_KEY_2", ""),
    ] if key
]
_current_key_index = 0
GROQ_MODEL = "openai/gpt-oss-120b"
# Fallback models when primary model is rate limited (tried in order)
GROQ_FALLBACK_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
]

VOICE_MODE_INSTRUCTION = (
    "\n\nIMPORTANT: You are currently in VOICE MODE. The user is talking to you through voice. "
    "You MUST keep your responses extremely short and concise - maximum 1 to 3 sentences. "
    "Respond naturally like a human conversation, not like a written essay. "
    "Be direct, smart, and to the point. No bullet points, no long explanations, no lists. "
    "Just answer briefly and naturally as if you are having a quick spoken conversation."
)

SYSTEM_PROMPT = (
    "You are Yubi, the AI assistant by Devopods. You are smart, helpful, and comprehensive — similar to ChatGPT or Claude. "
    "Devopods was founded by Ayoob Mohamed Elias. The AI engineering team is led by Dewan Sakibul Islam. "
    "Your creators are Dewan Sakibul Islam (AI Engineer) and Ayoob Mohamed Elias (Founder).\n\n"

    "### Core Behavior\n"
    "- You are a general-purpose AI assistant. You can help with coding, writing, analysis, math, research, explanations, and any topic.\n"
    "- Be direct and answer the user's question immediately. Do NOT start every response with a greeting or self-introduction.\n"
    "- ONLY introduce yourself if the user explicitly asks 'who are you?' or greets you for the FIRST time in a conversation.\n"
    "- For follow-up messages and regular questions, NEVER repeat your greeting or introduction. Just answer the question directly.\n"
    "- Match the language of the user: if they write in Bengali/Banglish, respond in Banglish. If English, respond in English.\n\n"

    "### Response Length & Intelligence\n"
    "- DEFAULT: Keep responses SHORT, CONCISE, and INTELLIGENT.\n"
    "- For simple factual questions ('Who is PM?', 'What is the capital?', 'When did X happen?'), give a DIRECT 1-3 sentence answer. Do NOT add bullet points, emojis, offers to explain more, or 'simple explanations'.\n"
    "- Example of GOOD response to 'Who is Prime Minister?': 'The current Prime Minister of Bangladesh is Tarique Rahman, who was sworn in on 17 February 2026 after BNP won the general election.'\n"
    "- Example of BAD response: Adding emojis, bullet points about PM responsibilities, offers to explain President vs PM, etc.\n"
    "- If user says something simple like 'Yes', 'You are correct', 'Ok', 'Thanks', 'Got it' — respond briefly and naturally (1-2 sentences max). Do NOT over-explain.\n"
    "- NEVER generate unnecessary information. NEVER add 'If you want, I can also explain...' or 'Would you like to know more about...' unless the user explicitly asks.\n"
    "- Use EXTENDED mode (detailed, with headers/lists/formatting) ONLY when:\n"
    "  * User asks to write/generate code\n"
    "  * User asks to explain a complex topic in detail\n"
    "  * User asks for a tutorial, guide, or step-by-step instructions\n"
    "  * User asks for analysis, comparison, or research\n"
    "  * User explicitly asks for more detail ('explain more', 'give me details')\n"
    "- Think like ChatGPT: match response length to question complexity. Simple question = short answer. Complex question = detailed answer.\n"
    "- NEVER use emojis in responses unless the user uses emojis first.\n\n"

    "### Greeting Rules\n"
    "- ONLY greet when the user's message is purely a greeting (hi, hello, hey, good morning, etc.) with no actual question.\n"
    "- For a greeting-only first message: respond warmly and briefly, e.g., 'Hello! How can I help you today?'\n"
    "- If the user greets AND asks a question in the same message, skip the greeting and answer the question directly.\n"
    "- NEVER repeat your introduction in subsequent messages. The user already knows who you are.\n\n"

    "### URL and Link Behavior\n"
    "- When [WEB SEARCH RESULTS (LIVE)] or [REFERENCE DATA (LIVE)] are provided, you SHOULD include relevant source URLs so users can verify and explore further.\n"
    "- Format source URLs nicely at the end of your response under a '**Sources:**' section when web search data is used.\n"
    "- If NO live search data is provided, do NOT include URLs unless the user explicitly asks for links.\n"
    "- NEVER make up, fabricate, or hallucinate URLs. Only share URLs from [WEB SEARCH RESULTS] or [REFERENCE DATA] provided to you.\n"
    "- When [YOUTUBE SEARCH RESULTS (LIVE)] are provided and user explicitly asked for videos, share the YouTube links with titles.\n\n"

    "### Using Live Data\n"
    "When [REFERENCE DATA (LIVE)], [WEB SEARCH RESULTS (LIVE)], [SCRAPED WEB CONTENT], or [YOUTUBE VIDEO TRANSCRIPT] are provided:\n"
    "- Use this data to generate accurate, up-to-date responses.\n"
    "- Present information naturally — NEVER mention internal tags like [WEB SEARCH RESULTS (LIVE)] in your response.\n"
    "- Synthesize information from multiple sources into a coherent, well-organized answer.\n\n"

    "### Conversation Context & Follow-ups\n"
    "- CRITICAL: Always use conversation history to understand context for follow-up questions.\n"
    "- When users use pronouns ('tini', 'tar', 'he', 'she', 'it', 'eta', 'this', 'that'), refer to conversation history.\n"
    "- When user asks about 'this repo', 'this project', 'this code' — look at previous messages in the conversation to find what they are referring to.\n"
    "- When user asks 'What was our conversation?', 'Summarize it', 'What did we discuss?' — summarize ONLY from the actual messages in the conversation history above. Do NOT use web search results for this.\n"
    "- NEVER use [WEB SEARCH RESULTS] or [REFERENCE DATA] to answer questions about the current conversation. Use ONLY the actual message history.\n"
    "- For date/time calculations, use the current date from the system prompt and calculate accurately.\n"
    "- Never say 'I don't have enough information' if the answer is in conversation history.\n"
    "- If user asks follow-up questions about something discussed earlier (e.g., 'What is the main goal of this repo?'), answer from the conversation context, not from web search.\n\n"

    "### Important World Facts (as of 2026)\n"
    "- The current Prime Minister of Bangladesh is Tarique Rahman (sworn in 17 Feb 2026, BNP won the 12 Feb 2026 election). "
    "Sheikh Hasina resigned on 5 Aug 2024 and fled to India. "
    "Use these facts ONLY when the user asks about Bangladesh politics/PM/government. Do NOT volunteer this information unprompted.\n\n"

    "### Weather & Rain Prediction\n"
    "- When [LIVE WEATHER DATA] is provided, use it to give accurate, real-time weather information.\n"
    "- Present weather data naturally in a friendly, conversational way — mention temperature, conditions, humidity, wind, etc.\n"
    "- For rain prediction questions ('Will it rain today?', 'Aaj ki brishti hobe?'), use the hourly rain probability data to give a detailed prediction.\n"
    "- If rain probability is >60%, confidently say it's likely to rain and suggest carrying an umbrella.\n"
    "- If rain probability is <20%, say it's unlikely to rain.\n"
    "- For 20-60%, say there's a moderate chance and advise being prepared.\n"
    "- Include the 3-day forecast when relevant.\n"
    "- NEVER mention internal tags like [LIVE WEATHER DATA] in your response.\n"
    "- If no weather data is provided but user asks about weather in a specific city/country, use your general knowledge.\n\n"

    "### Interview or Media Requests\n"
    "For interview/TV/media requests, respond professionally in 2-4 sentences. "
    "Direct to requirement@devopod.co.in or ayoob@devopod.co.in for founder-level requests.\n\n"

    "### Multilingual Support\n"
    "- Detect and respond in the user's language automatically.\n"
    "- If user writes in Banglish (e.g., 'Tumi ki bangla bolte paro?'), respond in Banglish.\n"
    "- If user writes in Bengali script, respond in Bengali script.\n"
    "- Support English, Bengali, Hindi, Urdu, Arabic, and other languages.\n\n"

    "### Math & LaTeX Formatting\n"
    "- When generating mathematical equations, formulas, or expressions, ALWAYS wrap them in LaTeX delimiters so they render correctly:\n"
    "  * Display math (standalone equations on their own line): Use $$...$$ delimiters\n"
    "  * Inline math (within a sentence or list item): Use $...$ delimiters\n"
    "- Example inline: The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$\n"
    "- Example display math:\n$$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$\n"
    "- CRITICAL: For multi-line equations using \\begin{aligned}, \\begin{cases}, \\begin{pmatrix}, etc.:\n"
    "  * Put $$ ONLY at the very start and very end of the entire block\n"
    "  * NEVER put $$ on individual lines inside the environment\n"
    "  * CORRECT:\n$$\n\\begin{aligned}\n\\frac{\\partial^2 u}{\\partial t^2} &= c^2 \\nabla^2 u \\\\\\\\\n&\\quad + f(x,t)\n\\end{aligned}\n$$\n"
    "  * WRONG: $$\\frac{\\partial^2 u}{\\partial t^2}$$ $$= c^2 \\nabla^2 u$$ (scattered $$ inside aligned)\n"
    "- CRITICAL: NEVER output raw LaTeX commands without wrapping them in $ or $$ delimiters.\n"
    "- CRITICAL: Even in 'where' lists or bullet points explaining variables, ALWAYS use $...$ for EVERY variable, symbol, operator, or expression.\n"
    "  * CORRECT: - $u(x,t)$ is the unknown field, $\\nabla^2$ is the Laplacian, $J_1$ is the Bessel function\n"
    "  * WRONG: - u(x,t) is the unknown field, ∇² is the Laplacian, J₁ is the Bessel function\n"
    "- NEVER use Unicode math symbols (∇, ², ₁, α, β, π, ∞, etc.) — always use LaTeX inside $...$ instead: $\\nabla$, $^2$, $_1$, $\\alpha$, $\\beta$, $\\pi$, $\\infty$\n"
    "- Even for simple Greek letters or symbols, use inline math: $\\alpha$, $\\beta$, $\\pi$\n\n"

    "### Extended Code Generation\n"
    "When asked to write code, generate complete, runnable code. "
    "If your response reaches the token limit and code is genuinely incomplete (cut off mid-function), "
    "end with exactly '[CONTINUE_AVAILABLE]' on a new line. "
    "Do NOT add [CONTINUE_AVAILABLE] if the response is naturally complete. "
    "When the user says 'Continue', resume exactly where you left off without repeating code."
)


def _estimate_tokens(text: str) -> int:
    """Rough token estimation: ~4 chars per token."""
    return len(text) // 4


def _trim_messages_to_fit(messages: list, max_input_tokens: int = 5500) -> list:
    """Trim conversation history to fit within max_input_tokens.
    
    Keeps: system prompt (first message) + most recent messages.
    Trims oldest messages first if total exceeds the limit.
    """
    total_tokens = sum(_estimate_tokens(m.get("content", "")) for m in messages)
    if total_tokens <= max_input_tokens:
        return messages
    
    # Always keep system prompt (index 0) and the latest user message (last)
    system_msg = messages[0]
    latest_msg = messages[-1]
    middle_msgs = messages[1:-1]
    
    system_tokens = _estimate_tokens(system_msg.get("content", ""))
    latest_tokens = _estimate_tokens(latest_msg.get("content", ""))
    remaining_budget = max_input_tokens - system_tokens - latest_tokens
    
    # Keep as many recent messages as possible within budget
    kept = []
    for msg in reversed(middle_msgs):
        msg_tokens = _estimate_tokens(msg.get("content", ""))
        if remaining_budget >= msg_tokens:
            kept.insert(0, msg)
            remaining_budget -= msg_tokens
        else:
            break  # Stop — older messages get trimmed
    
    trimmed = [system_msg] + kept + [latest_msg]
    logger.info(f"Trimmed conversation from {len(messages)} to {len(trimmed)} messages ({total_tokens} -> ~{max_input_tokens} tokens)")
    return trimmed


async def _single_ai_call(messages: list, max_tokens: int, voice_mode: bool = False) -> tuple[str, bool]:
    """Make a single Groq API call. Returns (text, finished).
    
    finished=True means the response completed naturally (not truncated).
    finished=False means it was cut off by max_tokens and can be continued.
    """
    global _current_key_index

    if not GROQ_API_KEYS:
        logger.error("No GROQ_API_KEYS configured")
        return generate_fallback_response(messages), True

    models_to_try = [GROQ_MODEL] + GROQ_FALLBACK_MODELS

    for model in models_to_try:
        is_reasoning_model = model.startswith("openai/")

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.6,
            "top_p": 0.9,
        }

        if is_reasoning_model:
            payload["max_completion_tokens"] = max_tokens
            payload["reasoning_effort"] = "low" if voice_mode else "medium"
        else:
            payload["max_tokens"] = max_tokens

        num_keys = len(GROQ_API_KEYS)
        all_keys_failed = True

        for attempt in range(num_keys):
            key_index = (_current_key_index + attempt) % num_keys
            api_key = GROQ_API_KEYS[key_index]

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }

            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(GROQ_API_URL, json=payload, headers=headers)

                    if response.status_code == 429:
                        logger.warning(f"Groq key #{key_index + 1} rate limited on {model}, trying next...")
                        continue

                    if response.status_code != 200:
                        logger.error(f"Groq API error {response.status_code} on {model}: {response.text}")
                        continue

                    _current_key_index = key_index
                    all_keys_failed = False

                    result = response.json()
                    choices = result.get("choices", [])
                    if choices and len(choices) > 0:
                        generated = choices[0].get("message", {}).get("content", "").strip()
                        finish_reason = choices[0].get("finish_reason", "stop")
                        finished = finish_reason != "length"  # "length" means truncated
                        if generated:
                            if model != GROQ_MODEL:
                                logger.info(f"Used fallback model: {model}")
                            return generated, finished

            except Exception as e:
                logger.error(f"Groq API error with key #{key_index + 1} on {model}: {e}")
                continue

        if all_keys_failed:
            logger.warning(f"All keys failed for model {model}, trying next model...")
            continue

    logger.error("All Groq API models and keys rate limited or failed")
    return generate_fallback_response(messages), True


async def generate_ai_response(messages: list, voice_mode: bool = False, extended: bool = False) -> str:
    """Generate AI response using Groq API with key rotation, model fallback, and multi-pass for long output.
    
    - Voice mode: 200 tokens, single pass
    - Regular mode: 2048 tokens, single pass
    - Extended mode (coding): up to 32K tokens via multi-pass (8192 per chunk)
    """
    # Trim input to fit within Groq free-tier TPM limits
    # openai/gpt-oss-120b: 8K TPM, llama-3.3-70b: 12K TPM, llama-3.1-8b: 6K TPM
    # We need input + output to stay under TPM, so cap input at ~5500 tokens
    messages = _trim_messages_to_fit(messages, max_input_tokens=5500)

    if voice_mode:
        text, _ = await _single_ai_call(messages, max_tokens=200, voice_mode=True)
        return text

    if not extended:
        text, _ = await _single_ai_call(messages, max_tokens=2048)
        return text

    # Extended mode — multi-pass generation up to 32K tokens
    # Groq free tier has low TPM, so use smaller chunks and more passes
    chunk_size = 2048  # Tokens per API call (fits within TPM limits)
    max_total_tokens = 32768  # 32K total output limit
    max_passes = 16  # 16 passes × 2048 = 32768 max

    full_response = ""
    current_messages = list(messages)  # Copy to avoid mutating original

    for pass_num in range(max_passes):
        text, finished = await _single_ai_call(current_messages, max_tokens=chunk_size)
        full_response += text

        # Check if we've reached the total limit or response is complete
        total_tokens_so_far = _estimate_tokens(full_response)
        if finished or total_tokens_so_far >= max_total_tokens:
            break

        # Response was truncated — auto-continue
        logger.info(f"Extended mode pass {pass_num + 1}: {total_tokens_so_far} tokens so far, continuing...")
        current_messages = list(messages)  # Start from original context
        current_messages.append({"role": "assistant", "content": full_response})
        current_messages.append({"role": "user", "content": "Continue from exactly where you left off. Do not repeat anything already generated."})

    logger.info(f"Extended mode complete: ~{_estimate_tokens(full_response)} tokens in {pass_num + 1} passes")
    return full_response


def generate_fallback_response(messages: list) -> str:
    """Fallback responses when AI API is unavailable."""
    user_msg = messages[-1]["content"] if messages else ""
    lower_msg = user_msg.lower().strip()

    if any(g in lower_msg for g in ["hello", "hello there", "hi", "hey", "good morning", "good evening"]):
        return "Hello! I'm Yubi, the AI assistant by Devopods. How can I help you today?"
    elif "who are you" in lower_msg or "what are you" in lower_msg:
        return "I'm Yubi, the AI assistant by Devopods — a tech company specializing in AI and machine learning. Founded by Ayoob Mohamed Elias, with AI engineering led by Dewan Sakibul Islam. How can I help you?"
    elif any(w in lower_msg for w in ["interview", "tv channel", "tv interview", "media", "podcast"]):
        return "Thank you for your interest! Please reach out to our communications team at requirement@devopod.co.in for interview or media engagement opportunities."
    else:
        return "I apologize, but I'm experiencing a temporary issue connecting to the AI model. Please try again in a moment — I'll be ready to help!"


async def _llm_decide_search(user_message: str) -> bool:
    """Use a fast LLM to decide if a web search is needed for the user's message.
    
    Makes a lightweight call to a small model with minimal tokens.
    Returns True if search is needed, False otherwise.
    """
    global _current_key_index

    if not GROQ_API_KEYS:
        return False

    # Skip obvious non-search messages
    msg_lower = user_message.strip().lower()
    if len(msg_lower) < 3:
        return False
    # Pure greetings never need search
    if re.match(r'^(hi|hello|hey|good morning|good evening|good afternoon|good night|assalamu alaikum|salam)\b', msg_lower) and len(msg_lower) < 50:
        return False

    decision_prompt = (
        "You are a search decision assistant. Given the user's message, decide if an internet/web search "
        "is needed to answer it accurately.\n\n"
        "Reply with ONLY one word: YES or NO\n\n"
        "Say YES for: current events, recent news, specific people/leaders in government, live data "
        "(weather, stocks, scores, prices), specific factual lookups that change over time, "
        "product info, recent technology updates, sports results, election results.\n\n"
        "Say NO for: coding/programming questions, math/logic problems, creative writing, "
        "general knowledge the AI knows from training, greetings, opinions/advice, "
        "explaining concepts, translation, follow-up questions, conversation about previous messages.\n\n"
        f"User message: {user_message[:200]}\n\nDecision:"
    )

    decision_model = "llama-3.1-8b-instant"
    payload = {
        "model": decision_model,
        "messages": [{"role": "user", "content": decision_prompt}],
        "temperature": 0.1,
        "max_tokens": 5,
    }

    num_keys = len(GROQ_API_KEYS)
    for attempt in range(num_keys):
        key_index = (_current_key_index + attempt) % num_keys
        api_key = GROQ_API_KEYS[key_index]
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(GROQ_API_URL, json=payload, headers=headers)
                if response.status_code == 429:
                    continue
                if response.status_code != 200:
                    continue
                result = response.json()
                choices = result.get("choices", [])
                if choices:
                    answer = choices[0].get("message", {}).get("content", "").strip().upper()
                    decision = "YES" in answer
                    logger.info(f"LLM search decision for '{user_message[:50]}': {answer} -> {'SEARCH' if decision else 'NO SEARCH'}")
                    return decision
        except Exception as e:
            logger.error(f"LLM search decision error: {e}")
            continue

    logger.warning("LLM search decision failed, defaulting to no search")
    return False


def generate_chat_title(user_message: str) -> str:
    """Generate a title from the first user message."""
    title = user_message[:50].strip()
    if len(user_message) > 50:
        title += "..."
    return title


@router.get("/", response_model=List[ChatResponse])
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chats = (
        db.query(Chat)
        .filter(Chat.user_id == current_user.id)
        .order_by(Chat.updated_at.desc())
        .all()
    )
    return [ChatResponse.model_validate(c) for c in chats]


@router.post("/", response_model=ChatResponse)
async def create_chat(
    data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat = Chat(title=data.title or "New Chat", user_id=current_user.id)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.get("/{chat_id}", response_model=ChatWithMessages)
async def get_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatWithMessages.model_validate(chat)


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted"}


async def _get_location_from_ip(ip: str) -> dict:
    """Get location details (country, city, region, lat, lon) from IP address using free geolocation API."""
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return {}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Use extended fields for exact location: city, region (state/division), district, zip
            resp = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,country,countryCode,regionName,city,district,zip,lat,lon,timezone,isp"}
            )
            if resp.status_code == 200:
                data_resp = resp.json()
                if data_resp.get("status") == "success":
                    city = data_resp.get("city", "")
                    district = data_resp.get("district", "")
                    region = data_resp.get("regionName", "")
                    # Build the most specific location string
                    location_parts = [p for p in [district, city, region] if p and p != city]
                    exact_location = city
                    if district and district != city:
                        exact_location = f"{district}, {city}"
                    return {
                        "country": data_resp.get("country", ""),
                        "city": city,
                        "district": district,
                        "region": region,
                        "exact_location": exact_location,
                        "lat": data_resp.get("lat"),
                        "lon": data_resp.get("lon"),
                        "timezone": data_resp.get("timezone", ""),
                        "zip": data_resp.get("zip", ""),
                    }
    except Exception as e:
        logger.warning(f"IP geolocation failed for {ip}: {e}")
    return {}


def _is_weather_query(message: str) -> bool:
    """Detect if the user is asking about weather, rain, temperature, etc."""
    msg = message.strip().lower()
    return bool(re.search(
        r'\b(weather|rain|rainy|raining|sunny|cloudy|cloud|storm|snow|snowing|temperature|temp|'
        r'forecast|humidity|wind|hot|cold|warm|freezing|heat|heatwave|monsoon|cyclone|tornado|'
        r'umbrella|brishti|bristi|roud|dhup|grom|tufan|thand|gorom|abohaowa|mosam|mausam)\b',
        msg, re.IGNORECASE
    ))


async def _get_weather_data(lat: float, lon: float, city: str, country: str) -> str:
    """Fetch current weather and forecast from Open-Meteo (free, no API key)."""
    try:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m",
            "hourly": "temperature_2m,precipitation_probability,precipitation,rain,weather_code,cloud_cover",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,sunrise,sunset",
            "timezone": "auto",
            "forecast_days": 3,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
            if resp.status_code != 200:
                logger.error(f"Open-Meteo API error: {resp.status_code}")
                return ""
            data = resp.json()

        # Parse current weather
        current = data.get("current", {})
        wmo_codes = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Foggy", 48: "Depositing rime fog",
            51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            66: "Light freezing rain", 67: "Heavy freezing rain",
            71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
            77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers",
            82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
            95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
        }
        weather_desc = wmo_codes.get(current.get("weather_code", -1), "Unknown")

        weather_text = (
            f"[LIVE WEATHER DATA for {city}, {country}]\n"
            f"Current conditions:\n"
            f"- Weather: {weather_desc}\n"
            f"- Temperature: {current.get('temperature_2m', 'N/A')}°C (feels like {current.get('apparent_temperature', 'N/A')}°C)\n"
            f"- Humidity: {current.get('relative_humidity_2m', 'N/A')}%\n"
            f"- Wind: {current.get('wind_speed_10m', 'N/A')} km/h\n"
            f"- Cloud cover: {current.get('cloud_cover', 'N/A')}%\n"
            f"- Current precipitation: {current.get('precipitation', 0)} mm\n"
            f"- Current rain: {current.get('rain', 0)} mm\n"
        )

        # Parse daily forecast
        daily = data.get("daily", {})
        daily_times = daily.get("time", [])
        if daily_times:
            weather_text += "\nForecast:\n"
            for i, day in enumerate(daily_times[:3]):
                day_code = daily.get("weather_code", [0])[i] if i < len(daily.get("weather_code", [])) else 0
                day_desc = wmo_codes.get(day_code, "Unknown")
                t_max = daily.get("temperature_2m_max", ["N/A"])[i] if i < len(daily.get("temperature_2m_max", [])) else "N/A"
                t_min = daily.get("temperature_2m_min", ["N/A"])[i] if i < len(daily.get("temperature_2m_min", [])) else "N/A"
                precip = daily.get("precipitation_sum", [0])[i] if i < len(daily.get("precipitation_sum", [])) else 0
                rain_sum = daily.get("rain_sum", [0])[i] if i < len(daily.get("rain_sum", [])) else 0
                precip_prob = daily.get("precipitation_probability_max", [0])[i] if i < len(daily.get("precipitation_probability_max", [])) else 0
                sunrise = daily.get("sunrise", [""])[i] if i < len(daily.get("sunrise", [])) else ""
                sunset = daily.get("sunset", [""])[i] if i < len(daily.get("sunset", [])) else ""
                label = "Today" if i == 0 else ("Tomorrow" if i == 1 else day)
                weather_text += (
                    f"- {label} ({day}): {day_desc}, {t_min}°C – {t_max}°C, "
                    f"rain probability: {precip_prob}%, precipitation: {precip}mm, rain: {rain_sum}mm, "
                    f"sunrise: {sunrise}, sunset: {sunset}\n"
                )

        # Parse hourly precipitation probability for next 12 hours
        hourly = data.get("hourly", {})
        hourly_times = hourly.get("time", [])
        hourly_precip_prob = hourly.get("precipitation_probability", [])
        hourly_rain = hourly.get("rain", [])
        if hourly_times and hourly_precip_prob:
            weather_text += "\nHourly rain probability (next 12 hours):\n"
            for i in range(min(12, len(hourly_times))):
                t = hourly_times[i].split("T")[1] if "T" in hourly_times[i] else hourly_times[i]
                prob = hourly_precip_prob[i] if i < len(hourly_precip_prob) else 0
                rain_mm = hourly_rain[i] if i < len(hourly_rain) else 0
                weather_text += f"  {t}: {prob}% chance, {rain_mm}mm\n"

        weather_text += "[END WEATHER DATA]\n"
        logger.info(f"Weather data fetched for {city}, {country}: {weather_desc}, {current.get('temperature_2m')}°C")
        return weather_text
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        return ""


# File attachment limits
MAX_FILE_SIZE = 512 * 1024  # 512KB per file
MAX_FILES = 10

# Image extensions that trigger OCR
IMAGE_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.webp',
    '.heic', '.heif', '.svg', '.ico',
}


def _is_image_file(filename: str) -> bool:
    """Check if a file is an image based on extension."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in IMAGE_EXTENSIONS


async def _ocr_from_base64(filename: str, base64_data: str) -> str:
    """Run OCR on a base64-encoded image via OCR.space free API."""
    try:
        # Remove data URL prefix if present (e.g., "data:image/png;base64,")
        if ',' in base64_data:
            base64_data = base64_data.split(',', 1)[1]

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.ocr.space/parse/image",
                data={
                    "base64Image": f"data:image/png;base64,{base64_data}",
                    "language": "eng",
                    "isOverlayRequired": "false",
                    "detectOrientation": "true",
                    "scale": "true",
                    "OCREngine": "2",
                },
                headers={"apikey": "helloworld"},
            )
            result = response.json()
            if result.get("IsErroredOnProcessing"):
                error_msg = result.get("ErrorMessage", ["Unknown error"])
                logger.error(f"OCR API error for {filename}: {error_msg}")
                return f"[OCR failed: {error_msg}]"
            parsed = result.get("ParsedResults", [])
            if parsed:
                text = parsed[0].get("ParsedText", "").strip()
                if text:
                    return text
            return "[No text detected in image]"
    except Exception as e:
        logger.error(f"OCR failed for {filename}: {e}")
        return f"[OCR failed for {filename}: {str(e)}]"


def _read_file_content(filename: str, content_bytes: bytes) -> str:
    """Read file content as text. Returns content string or error message."""
    try:
        text = content_bytes.decode('utf-8')
        return text
    except UnicodeDecodeError:
        try:
            text = content_bytes.decode('latin-1')
            return text
        except Exception:
            return f"[Could not read file: {filename} - binary or unsupported encoding]"


@router.post("/message", response_model=MessageResponse)
async def send_message(
    request: Request,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Create or use existing chat
    if data.chat_id:
        chat = db.query(Chat).filter(Chat.id == data.chat_id, Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
    else:
        chat = Chat(
            title=generate_chat_title(data.content),
            user_id=current_user.id,
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)

    # Save user message (display content without file dumps)
    user_message = Message(
        chat_id=chat.id,
        user_id=current_user.id,
        role="user",
        content=data.content,
    )
    db.add(user_message)
    db.commit()

    # Build conversation history
    chat_messages = (
        db.query(Message)
        .filter(Message.chat_id == chat.id)
        .order_by(Message.created_at)
        .all()
    )

    # Build system prompt (add user name, datetime, voice mode, cross-chat memory)
    now = datetime.now(timezone.utc)
    datetime_info = (
        f"\n\n### Current Date & Time\n"
        f"The current date and time is: {now.strftime('%A, %B %d, %Y at %I:%M %p')} UTC. "
        f"Always be aware of the current date and time when answering questions about recent events, "
        f"current leaders, dates, or anything time-sensitive."
    )

    # Detect user's location from IP for location-aware responses and weather
    # Priority: CF-Connecting-IP (Cloudflare) > X-Real-IP (nginx) > X-Forwarded-For > direct IP
    client_ip = (
        request.headers.get("cf-connecting-ip", "").strip()
        or request.headers.get("x-real-ip", "").strip()
        or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.client.host
    )
    user_location = await _get_location_from_ip(client_ip)
    user_country = user_location.get("country", "")
    user_city = user_location.get("city", "")
    user_region = user_location.get("region", "")
    user_exact = user_location.get("exact_location", user_city)
    user_lat = user_location.get("lat")
    user_lon = user_location.get("lon")
    location_context = ""
    if user_country:
        full_location = ", ".join(p for p in [user_exact, user_region, user_country] if p)
        location_context = (
            f"\n\n### User Location\n"
            f"The user is located in **{full_location}**. "
            f"Their exact city is **{user_city}**, region/state: **{user_region}**, country: **{user_country}**. "
            f"Coordinates: {user_lat}, {user_lon}. "
            f"When they ask location-sensitive questions like 'Who is the Prime Minister?', 'Who is the President?', "
            f"'What is the capital?', 'What is the weather?' without specifying a country, "
            f"assume they are asking about {user_country} and answer accordingly. "
            f"For example, if user is in Bangladesh and asks 'Who is PM?', answer about Bangladesh's PM. "
            f"If user is in India and asks 'Who is PM?', answer about India's PM. "
            f"When mentioning the user's location in weather or other responses, always say the exact city name: {user_city}."
        )

    # Fetch live weather data if user asks about weather/rain/temperature
    weather_context = ""
    if _is_weather_query(data.content) and user_lat is not None and user_lon is not None:
        weather_data = await _get_weather_data(user_lat, user_lon, user_exact or user_city or "Unknown", user_country or "Unknown")
        if weather_data:
            weather_context = f"\n\n{weather_data}"

    # Inject user's name so AI always knows who it's talking to
    user_name = current_user.name or "User"
    user_context = (
        f"\n\n### User Information\n"
        f"You are currently talking to **{user_name}** (email: {current_user.email}). "
        f"Always remember their name and use it naturally when appropriate (e.g., greeting them, answering personal questions). "
        f"If they ask 'What is my name?' or 'Do you know me?', respond with their name confidently. "
        f"Be personalized and friendly — address them by name occasionally, but don't overuse it."
    )

    # Gather cross-conversation memory (recent topics from other chats)
    cross_chat_memory = ""
    try:
        recent_chats = (
            db.query(Chat)
            .filter(Chat.user_id == current_user.id, Chat.id != chat.id)
            .order_by(Chat.updated_at.desc())
            .limit(5)
            .all()
        )
        if recent_chats:
            memory_items = []
            for rc in recent_chats:
                # Get last 2 messages from each recent chat for context
                recent_msgs = (
                    db.query(Message)
                    .filter(Message.chat_id == rc.id)
                    .order_by(Message.created_at.desc())
                    .limit(2)
                    .all()
                )
                if recent_msgs:
                    summary = recent_msgs[-1].content[:150]  # First msg snippet
                    memory_items.append(f"- Chat '{rc.title}': {summary}")
            if memory_items:
                cross_chat_memory = (
                    f"\n\n### Previous Conversation Memory\n"
                    f"The user has had these recent conversations with you (use this to understand their interests, "
                    f"preferences, and ongoing topics — like a real AI assistant that remembers past interactions):\n"
                    + "\n".join(memory_items[:5])
                    + "\nUse this context naturally. Don't explicitly mention 'previous chats' unless the user asks. "
                    + "Just seamlessly remember their interests and ongoing topics."
                )
    except Exception as e:
        logger.error(f"Error building cross-chat memory: {e}")

    system_content = SYSTEM_PROMPT + datetime_info + location_context + weather_context + user_context + cross_chat_memory
    if data.voice_mode:
        system_content += VOICE_MODE_INSTRUCTION

    messages_for_ai = [{"role": "system", "content": system_content}]
    for msg in chat_messages:
        messages_for_ai.append({"role": msg.role, "content": msg.content})

    # Inject attached file contents into the last user message (smart-fit within token budget)
    if data.file_contents:
        # Calculate available token budget for files
        # Groq free tier TPM limits: openai/gpt-oss-120b=8K, llama-3.3-70b=12K, llama-3.1-8b=6K
        # Reserve ~2500 tokens for system prompt + conversation history + output headroom
        current_context_tokens = sum(_estimate_tokens(m.get("content", "")) for m in messages_for_ai)
        max_file_tokens = max(3000 - current_context_tokens, 1500)  # At least 1500 tokens for files
        
        # Distribute token budget evenly across files, then truncate each
        per_file_budget = max_file_tokens // len(data.file_contents)
        per_file_chars = per_file_budget * 4  # ~4 chars per token
        
        file_context_parts = []
        for fc in data.file_contents:
            filename = fc['name']
            
            # Check if this is an image file — run OCR
            if _is_image_file(filename) and fc.get('is_image'):
                ocr_text = await _ocr_from_base64(filename, fc['content'])
                content = f"[OCR EXTRACTED TEXT FROM IMAGE]\n{ocr_text}"
                logger.info(f"OCR completed for {filename}: {len(ocr_text)} chars extracted")
            else:
                content = fc['content']
            
            if len(content) > per_file_chars:
                # Truncate: keep beginning (most important — imports, class defs) + note
                content = content[:per_file_chars] + f"\n... [truncated — showing first {per_file_chars} chars of {len(content)} total]"
            file_context_parts.append(
                f"\n\n[ATTACHED FILE: {filename}]\n```\n{content}\n```"
            )
        file_context = "".join(file_context_parts)
        messages_for_ai[-1]["content"] = data.content + file_context
        total_file_tokens = _estimate_tokens(file_context)
        logger.info(f"Injected {len(data.file_contents)} file(s) into AI context (~{total_file_tokens} tokens, budget was {max_file_tokens})")

    # Gather external context (URLs, YouTube, web search)
    # Use LLM to decide if web search is needed before searching
    is_continue = data.content.strip().lower() in ["continue", "continue.", "go on", "keep going"]
    if not data.voice_mode and not is_continue:
        try:
            # Step 1: Ask LLM if this query needs internet search
            search_needed = await _llm_decide_search(data.content)
            logger.info(f"Search decision for message: search_needed={search_needed}")

            # Step 2: Gather context (with LLM decision passed through)
            external_context = await gather_context(
                data.content,
                conversation_history=messages_for_ai,
                force_search=search_needed,
            )
            if external_context:
                # Inject context into the last user message
                messages_for_ai[-1]["content"] = (
                    messages_for_ai[-1]["content"] + "\n\n" + external_context
                )
        except Exception as e:
            logger.error(f"Error gathering context: {e}")

    # Detect if extended mode is needed (code generation, long content, or files attached)
    extended_mode = bool(
        re.search(r'\b(write|create|build|generate|make|code|implement|develop|program)\b', data.content, re.IGNORECASE)
        and re.search(r'\b(code|function|class|app|application|script|program|page|component|api|website|project)\b', data.content, re.IGNORECASE)
    ) or is_continue or bool(data.file_contents)

    # Generate AI response
    ai_response = await generate_ai_response(
        messages_for_ai,
        voice_mode=bool(data.voice_mode),
        extended=extended_mode,
    )

    # Save AI response
    ai_message = Message(
        chat_id=chat.id,
        user_id=current_user.id,
        role="assistant",
        content=ai_response,
    )
    db.add(ai_message)

    # Update chat title if it's the first message
    if len(chat_messages) <= 1:
        chat.title = generate_chat_title(data.content)

    db.commit()
    db.refresh(ai_message)

    return MessageResponse.model_validate(ai_message)
