import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from itsdangerous import URLSafeTimedSerializer
from app.database import get_db
from app.models import User

SECRET_KEY = os.getenv("SECRET_KEY", "yubiai-secret-key-change-in-production-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
serializer = URLSafeTimedSerializer(SECRET_KEY)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_verification_token(email: str) -> str:
    return serializer.dumps(email, salt="email-verify")


def verify_email_token(token: str, max_age: int = 3600) -> Optional[str]:
    try:
        email = serializer.loads(token, salt="email-verify", max_age=max_age)
        return email
    except Exception:
        return None


def create_reset_token(email: str) -> str:
    return serializer.dumps(email, salt="password-reset")


def verify_reset_token(token: str, max_age: int = 3600) -> Optional[str]:
    try:
        email = serializer.loads(token, salt="password-reset", max_age=max_age)
        return email
    except Exception:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def verify_api_key(api_key: str, db: Session) -> Optional[User]:
    from app.models import APIKey
    key_record = db.query(APIKey).filter(APIKey.key == api_key, APIKey.is_active == True).first()
    if key_record:
        key_record.last_used_at = datetime.utcnow()
        key_record.usage_count += 1
        db.commit()
        return key_record.user
    return None
