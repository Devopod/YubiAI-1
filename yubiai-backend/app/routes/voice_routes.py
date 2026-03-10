import io
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.auth import get_current_user
from app.models import User
from gtts import gTTS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice", tags=["Voice"])

SUPPORTED_LANGUAGES = {
    "en": "English",
    "bn": "Bengali",
    "hi": "Hindi",
    "ur": "Urdu",
    "ar": "Arabic",
}


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("/tts")
async def text_to_speech(
    data: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    """Convert text to speech using gTTS and return audio."""
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    lang = data.language if data.language in SUPPORTED_LANGUAGES else "en"

    try:
        tts = gTTS(text=data.text, lang=lang, slow=False)
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)

        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")


@router.get("/languages")
async def get_supported_languages():
    """Get list of supported languages for voice mode."""
    return {
        "languages": [
            {"code": code, "name": name, "speech_code": get_speech_code(code)}
            for code, name in SUPPORTED_LANGUAGES.items()
        ]
    }


def get_speech_code(lang_code: str) -> str:
    """Map language code to Web Speech API recognition code."""
    mapping = {
        "en": "en-US",
        "bn": "bn-BD",
        "hi": "hi-IN",
        "ur": "ur-PK",
        "ar": "ar-SA",
    }
    return mapping.get(lang_code, "en-US")
