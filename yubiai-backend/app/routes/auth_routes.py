import os
import logging
import urllib.parse
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.database import get_db
from app.models import User
from app.schemas import (
    UserSignup, UserLogin, GoogleAuthRequest, TokenResponse,
    UserResponse, VerifyEmailRequest, ResendVerificationRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.auth import (
    get_password_hash, verify_password, create_access_token,
    create_verification_token, verify_email_token,
    create_reset_token, verify_reset_token, get_current_user,
)
from app.email_utils import (
    send_verification_email, send_password_reset_email,
    save_gmail_refresh_token, FRONTEND_URL,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

# Gmail API OAuth2 scopes and redirect
_GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.send"
_GMAIL_REDIRECT_PATH = "/api/auth/gmail-callback"


@router.post("/signup", response_model=TokenResponse)
async def signup(data: UserSignup, db: Session = Depends(get_db)):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification email
    token = create_verification_token(data.email)
    await send_verification_email(data.email, token, data.name)

    access_token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


logger = logging.getLogger(__name__)


@router.post("/google", response_model=TokenResponse)
async def google_auth(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Handle Google OAuth. Verify the Google ID token and create/login user."""
    try:
        # Verify Google ID token using google-auth library
        idinfo = id_token.verify_oauth2_token(
            data.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )

        # Verify issuer
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise HTTPException(status_code=401, detail="Invalid token issuer")

        google_id = idinfo.get("sub")
        email = idinfo.get("email")
        name = idinfo.get("name", "Google User")
        avatar_url = idinfo.get("picture")

        logger.info(f"Google auth: email={email}, name={name}")

        if not email:
            raise HTTPException(status_code=400, detail="Could not get email from Google")

        # Check if user exists by google_id or email
        user = db.query(User).filter(
            (User.google_id == google_id) | (User.email == email)
        ).first()

        if user:
            # Update Google info
            if not user.google_id:
                user.google_id = google_id
                user.is_google_user = True
            if avatar_url:
                user.avatar_url = avatar_url
            user.is_verified = True  # Google users are auto-verified
            db.commit()
            db.refresh(user)
        else:
            # Create new user
            user = User(
                name=name,
                email=email,
                google_id=google_id,
                is_google_user=True,
                is_verified=True,
                avatar_url=avatar_url,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Send welcome verification email for Google users too
            token = create_verification_token(email)
            await send_verification_email(email, token, name)

        access_token = create_access_token(data={"sub": user.id})
        return TokenResponse(
            access_token=access_token,
            user=UserResponse.model_validate(user),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google auth failed: {str(e)}")


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    email = verify_email_token(data.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        return {"message": "Email already verified"}

    token = create_verification_token(data.email)
    await send_verification_email(data.email, token, user.name)
    return {"message": "Verification email sent"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        # Don't reveal if user exists or not
        return {"message": "If the email exists, a reset link has been sent", "email_sent": True}

    token = create_reset_token(data.email)
    sent = await send_password_reset_email(data.email, token, user.name)
    if sent:
        return {"message": "If the email exists, a reset link has been sent", "email_sent": True}
    else:
        # Email delivery failed (SMTP blocked etc.) — return reset URL directly
        reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
        return {
            "message": "Email delivery is unavailable. Use the link below to reset your password.",
            "email_sent": False,
            "reset_url": reset_url,
        }


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    email = verify_reset_token(data.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(data.password)
    db.commit()
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.get("/gmail-setup")
async def gmail_setup():
    """Generate Google OAuth2 authorization URL for Gmail API access.

    Navigate to the returned URL in a browser to authorize the app
    to send emails via Gmail API (bypasses SMTP port restrictions).
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")

    redirect_uri = FRONTEND_URL.rstrip("/") + _GMAIL_REDIRECT_PATH
    params = urllib.parse.urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": _GMAIL_SCOPES,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
    })
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    return {"auth_url": auth_url, "redirect_uri": redirect_uri}


@router.get("/gmail-callback")
async def gmail_callback(code: str = Query(...)):
    """Handle Google OAuth2 callback for Gmail API.

    Exchanges the authorization code for tokens and stores the refresh token.
    """
    redirect_uri = FRONTEND_URL.rstrip("/") + _GMAIL_REDIRECT_PATH

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )

    if resp.status_code != 200:
        logger.error(f"Gmail token exchange failed: {resp.text}")
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {resp.text}")

    tokens = resp.json()
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=400,
            detail="No refresh token received. Try revoking app access at https://myaccount.google.com/permissions and retry.",
        )

    save_gmail_refresh_token(refresh_token)
    logger.info("Gmail API refresh token saved successfully")

    # Redirect to the app home page with a success message
    return RedirectResponse(url=f"{FRONTEND_URL}/?gmail_setup=success")


@router.delete("/delete-account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the current user's account and all associated data."""
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}
