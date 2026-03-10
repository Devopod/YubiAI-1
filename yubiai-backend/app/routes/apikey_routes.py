from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, APIKey
from app.schemas import APIKeyCreate, APIKeyResponse, APIKeyListResponse
from app.auth import get_current_user

router = APIRouter(prefix="/api/keys", tags=["API Keys"])


@router.get("/", response_model=List[APIKeyListResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keys = db.query(APIKey).filter(APIKey.user_id == current_user.id).order_by(APIKey.created_at.desc()).all()
    result = []
    for k in keys:
        result.append(APIKeyListResponse(
            id=k.id,
            key_preview=k.key[:10] + "..." + k.key[-4:],
            name=k.name,
            is_active=k.is_active,
            created_at=k.created_at,
            last_used_at=k.last_used_at,
            usage_count=k.usage_count,
        ))
    return result


@router.post("/", response_model=APIKeyResponse)
async def create_api_key(
    data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = APIKey(name=data.name, user_id=current_user.id)
    db.add(key)
    db.commit()
    db.refresh(key)
    return APIKeyResponse.model_validate(key)


@router.delete("/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = db.query(APIKey).filter(APIKey.id == key_id, APIKey.user_id == current_user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key not found")
    db.delete(key)
    db.commit()
    return {"message": "API Key deleted"}


@router.put("/{key_id}/toggle")
async def toggle_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = db.query(APIKey).filter(APIKey.id == key_id, APIKey.user_id == current_user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key not found")
    key.is_active = not key.is_active
    db.commit()
    db.refresh(key)
    return {"message": f"API Key {'activated' if key.is_active else 'deactivated'}", "is_active": key.is_active}
