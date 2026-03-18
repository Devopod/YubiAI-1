from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Chat, Message, APIKey

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Owner emails get unlimited Enterprise access
ENTERPRISE_EMAILS = {"devopodinc@gmail.com", "islamdewansakibul@gmail.com"}


def get_user_plan(email: str, total_messages: int, total_api_usage: int):
    """Return plan info based on user email."""
    if email.lower() in ENTERPRISE_EMAILS:
        return {
            "name": "Enterprise",
            "messages_limit": -1,  # -1 means unlimited
            "messages_used": total_messages,
            "api_calls_limit": -1,
            "api_calls_used": total_api_usage,
            "storage_limit_mb": -1,
            "storage_used_mb": 0,
        }
    return {
        "name": "Free",
        "messages_limit": 1000,
        "messages_used": total_messages,
        "api_calls_limit": 500,
        "api_calls_used": total_api_usage,
        "storage_limit_mb": 100,
        "storage_used_mb": 0,
    }


@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get dashboard statistics for the current user."""
    # Total chats
    total_chats = db.query(func.count(Chat.id)).filter(Chat.user_id == current_user.id).scalar() or 0

    # Total messages (user + assistant)
    total_messages = db.query(func.count(Message.id)).filter(Message.user_id == current_user.id).scalar() or 0

    # Messages sent by user
    user_messages = (
        db.query(func.count(Message.id))
        .filter(Message.user_id == current_user.id, Message.role == "user")
        .scalar() or 0
    )

    # AI responses
    ai_responses = (
        db.query(func.count(Message.id))
        .filter(Message.user_id == current_user.id, Message.role == "assistant")
        .scalar() or 0
    )

    # API keys count
    api_keys_count = db.query(func.count(APIKey.id)).filter(APIKey.user_id == current_user.id).scalar() or 0
    active_api_keys = (
        db.query(func.count(APIKey.id))
        .filter(APIKey.user_id == current_user.id, APIKey.is_active == True)
        .scalar() or 0
    )

    # Total API usage across all keys
    total_api_usage = (
        db.query(func.sum(APIKey.usage_count))
        .filter(APIKey.user_id == current_user.id)
        .scalar() or 0
    )

    # Recent chats (last 5)
    recent_chats = (
        db.query(Chat)
        .filter(Chat.user_id == current_user.id)
        .order_by(Chat.updated_at.desc())
        .limit(5)
        .all()
    )

    # Messages per day (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily_messages = (
        db.query(
            func.date(Message.created_at).label("date"),
            func.count(Message.id).label("count"),
        )
        .filter(Message.user_id == current_user.id, Message.created_at >= seven_days_ago)
        .group_by(func.date(Message.created_at))
        .order_by(func.date(Message.created_at))
        .all()
    )

    # Build daily activity for last 7 days (fill in zeros for missing days)
    activity = []
    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).date()
        day_str = day.isoformat()
        count = 0
        for row in daily_messages:
            if str(row.date) == day_str:
                count = row.count
                break
        activity.append({"date": day_str, "messages": count})

    # Account age
    account_created = current_user.created_at
    days_since_creation = (datetime.utcnow() - account_created).days if account_created else 0

    return {
        "total_chats": total_chats,
        "total_messages": total_messages,
        "user_messages": user_messages,
        "ai_responses": ai_responses,
        "api_keys_count": api_keys_count,
        "active_api_keys": active_api_keys,
        "total_api_usage": total_api_usage,
        "recent_chats": [
            {
                "id": c.id,
                "title": c.title,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in recent_chats
        ],
        "daily_activity": activity,
        "account": {
            "name": current_user.name,
            "email": current_user.email,
            "is_verified": current_user.is_verified,
            "is_google_user": current_user.is_google_user,
            "avatar_url": current_user.avatar_url,
            "created_at": account_created.isoformat() if account_created else None,
            "days_active": days_since_creation,
        },
        "plan": get_user_plan(current_user.email, total_messages, total_api_usage),
    }
