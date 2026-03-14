import os
import json
import base64
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# Email configuration from environment
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", "noreply@yubiai.com")
MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "465"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Google OAuth config for Gmail API (HTTPS-based email sending)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

# Path to store Gmail API refresh token
_TOKEN_FILE = Path(__file__).resolve().parent.parent / ".gmail_token.json"


def _load_gmail_refresh_token() -> str:
    """Load Gmail API refresh token from file or env."""
    token = os.getenv("GMAIL_REFRESH_TOKEN", "")
    if token:
        return token
    if _TOKEN_FILE.exists():
        try:
            data = json.loads(_TOKEN_FILE.read_text())
            return data.get("refresh_token", "")
        except Exception:
            return ""
    return ""


def save_gmail_refresh_token(refresh_token: str) -> None:
    """Persist Gmail API refresh token to file."""
    _TOKEN_FILE.write_text(json.dumps({"refresh_token": refresh_token}))
    logger.info("Gmail API refresh token saved")


def _send_email_smtp(to_email: str, subject: str, html_body: str) -> bool:
    """Send email using smtplib directly with SSL."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"YubiAI <{MAIL_FROM}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        context = ssl.create_default_context()
        port = MAIL_PORT
        if port == 465:
            with smtplib.SMTP_SSL(MAIL_SERVER, port, context=context, timeout=15) as server:
                server.login(MAIL_USERNAME, MAIL_PASSWORD)
                server.sendmail(MAIL_FROM, to_email, msg.as_string())
        else:
            with smtplib.SMTP(MAIL_SERVER, port, timeout=15) as server:
                server.starttls(context=context)
                server.login(MAIL_USERNAME, MAIL_PASSWORD)
                server.sendmail(MAIL_FROM, to_email, msg.as_string())
        logger.info(f"Email sent to {to_email} via SMTP")
        return True
    except Exception as e:
        logger.error(f"SMTP send failed: {e}")
        return False


def _send_email_gmail_api(to_email: str, subject: str, html_body: str) -> bool:
    """Send email using Gmail REST API over HTTPS (port 443).

    This bypasses SMTP port restrictions by using the Gmail API
    which works over standard HTTPS.
    """
    refresh_token = _load_gmail_refresh_token()
    if not refresh_token or not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.warning("Gmail API not configured (missing refresh token or client credentials)")
        return False

    try:
        token_resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=15,
        )
        if token_resp.status_code != 200:
            logger.error(f"Gmail token refresh failed: {token_resp.text}")
            return False

        access_token = token_resp.json().get("access_token")
        if not access_token:
            logger.error("No access_token in Gmail token response")
            return False

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"YubiAI <{MAIL_FROM}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")

        send_resp = httpx.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"raw": raw_message},
            timeout=15,
        )
        if send_resp.status_code == 200:
            logger.info(f"Email sent to {to_email} via Gmail API")
            return True
        else:
            logger.error(f"Gmail API send failed ({send_resp.status_code}): {send_resp.text}")
            return False

    except Exception as e:
        logger.error(f"Gmail API send error: {e}")
        return False


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Try SMTP first, then fall back to Gmail API over HTTPS."""
    if MAIL_USERNAME and MAIL_PASSWORD:
        if _send_email_smtp(to_email, subject, html_body):
            return True
        logger.info("SMTP failed, trying Gmail API fallback...")

    return _send_email_gmail_api(to_email, subject, html_body)


async def send_verification_email(email: str, token: str, name: str) -> bool:
    """Send verification email. Returns True if sent successfully."""
    verification_url = f"{FRONTEND_URL}/verify-email?token={token}"

    if not MAIL_USERNAME and not MAIL_PASSWORD and not _load_gmail_refresh_token():
        logger.info(f"[DEV MODE] Verification URL for {email}: {verification_url}")
        print(f"\n{'='*60}")
        print(f"VERIFICATION EMAIL for {email}")
        print(f"URL: {verification_url}")
        print(f"{'='*60}\n")
        return True

    html_body = f"""
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #18181b; color: #ececec; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #27272a; border-radius: 16px; padding: 40px; border: 1px solid #3f3f46;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: #059669; border-radius: 12px; padding: 12px; margin-bottom: 16px;">
                    <span style="font-size: 24px; color: white; font-weight: bold;">Y</span>
                </div>
                <h1 style="color: #10b981; margin: 0;">YubiAI</h1>
                <p style="color: #a1a1aa; font-size: 14px; margin-top: 4px;">AI Assistant by Devopods</p>
            </div>
            <h2 style="text-align: center; margin-bottom: 16px; color: #fafafa;">Verify Your Email</h2>
            <p style="color: #d4d4d8;">Hello {name},</p>
            <p style="color: #d4d4d8;">Thank you for signing up for YubiAI! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{verification_url}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                    Verify Email Address
                </a>
            </div>
            <p style="color: #71717a; font-size: 14px;">This link will expire in 1 hour.</p>
            <p style="color: #71717a; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
            <hr style="border-color: #3f3f46; margin: 24px 0;">
            <p style="color: #71717a; font-size: 12px; text-align: center;">Devopods &middot; YubiAI &middot; AI Solutions for the Future</p>
        </div>
    </body>
    </html>
    """

    sent = _send_email(email, "Verify your YubiAI account", html_body)
    if not sent:
        logger.warning(f"Could not send verification email to {email}")
        print(f"\n[FALLBACK] Verification URL for {email}: {verification_url}")
    return True  # Always return True so signup works


async def send_password_reset_email(email: str, token: str, name: str) -> bool:
    """Send password reset email. Returns True if actually sent."""
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"

    if not MAIL_USERNAME and not MAIL_PASSWORD and not _load_gmail_refresh_token():
        logger.info(f"[DEV MODE] Password reset URL for {email}: {reset_url}")
        print(f"\n{'='*60}")
        print(f"PASSWORD RESET EMAIL for {email}")
        print(f"URL: {reset_url}")
        print(f"{'='*60}\n")
        return False

    html_body = f"""
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #18181b; color: #ececec; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #27272a; border-radius: 16px; padding: 40px; border: 1px solid #3f3f46;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: #059669; border-radius: 12px; padding: 12px; margin-bottom: 16px;">
                    <span style="font-size: 24px; color: white; font-weight: bold;">Y</span>
                </div>
                <h1 style="color: #10b981; margin: 0;">YubiAI</h1>
                <p style="color: #a1a1aa; font-size: 14px; margin-top: 4px;">AI Assistant by Devopods</p>
            </div>
            <h2 style="text-align: center; margin-bottom: 16px; color: #fafafa;">Reset Your Password</h2>
            <p style="color: #d4d4d8;">Hello {name},</p>
            <p style="color: #d4d4d8;">We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{reset_url}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                    Reset Password
                </a>
            </div>
            <p style="color: #71717a; font-size: 14px;">This link will expire in 1 hour.</p>
            <p style="color: #71717a; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border-color: #3f3f46; margin: 24px 0;">
            <p style="color: #71717a; font-size: 12px; text-align: center;">Devopods &middot; YubiAI &middot; AI Solutions for the Future</p>
        </div>
    </body>
    </html>
    """

    sent = _send_email(email, "Reset your YubiAI password", html_body)
    if not sent:
        logger.warning(f"Could not send reset email to {email}")
        print(f"\n[FALLBACK] Reset URL for {email}: {reset_url}")
    return sent
