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
    conversation_history: Optional[List[dict]] = None


class APIChatResponse(BaseModel):
    response: str
    usage: dict
