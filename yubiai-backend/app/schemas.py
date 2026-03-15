from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# Auth schemas
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    is_verified: bool
    is_google_user: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str


# Profile schemas
class UserProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    occupation: Optional[str] = None
    about_you: Optional[str] = None
    custom_instructions: Optional[str] = None
    tone: Optional[str] = "balanced"  # friendly, professional, casual, balanced
    response_style: Optional[str] = "default"  # concise, detailed, default


class UserProfileResponse(BaseModel):
    nickname: Optional[str] = None
    occupation: Optional[str] = None
    about_you: Optional[str] = None
    custom_instructions: Optional[str] = None
    tone: str = "balanced"
    response_style: str = "default"
    onboarding_completed: bool = False

    class Config:
        from_attributes = True


class OnboardingComplete(BaseModel):
    nickname: Optional[str] = None
    occupation: Optional[str] = None
    about_you: Optional[str] = None
    custom_instructions: Optional[str] = None
    tone: Optional[str] = "balanced"
    response_style: Optional[str] = "default"


# Chat schemas
class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"


class ChatResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str
    chat_id: Optional[str] = None
    voice_mode: Optional[bool] = False
    file_contents: Optional[List[dict]] = None  # [{"name": "file.py", "content": "..."}]


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatWithMessages(BaseModel):
    id: str
    title: str
    messages: List[MessageResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# API Key schemas
class APIKeyCreate(BaseModel):
    name: str


class APIKeyResponse(BaseModel):
    id: str
    key: str
    name: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    usage_count: int

    class Config:
        from_attributes = True


class APIKeyListResponse(BaseModel):
    id: str
    key_preview: str
    name: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    usage_count: int


# API Chat (external API usage)
class APIChatRequest(BaseModel):
    message: str
    system_prompt: Optional[str] = None
    conversation_history: Optional[List[dict]] = None
    model: Optional[str] = None  # e.g. "gpt-oss-120b", "llama-3.3-70b-versatile"
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    top_k: Optional[int] = 50
    frequency_penalty: Optional[float] = 0.0
    presence_penalty: Optional[float] = 0.0
    repetition_penalty: Optional[float] = 1.0
    max_tokens: Optional[int] = 2048
    min_tokens: Optional[int] = 1
    stop: Optional[List[str]] = None
    seed: Optional[int] = None
    stream: Optional[bool] = False


class APIChatResponse(BaseModel):
    response: str
    model: str
    usage: dict
