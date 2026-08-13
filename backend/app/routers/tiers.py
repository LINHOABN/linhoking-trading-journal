from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user
from app.ws_manager import manager

router = APIRouter(prefix="/tiers", tags=["tiers"])


@router.get("/me", response_model=schemas.TierOut)
def get_my_tier(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    tier = db.query(models.TierConfig).filter(models.TierConfig.user_id == current_user.id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Configuration de palier introuvable")
    return tier


@router.put("/me", response_model=schemas.TierOut)
async def update_my_tier(
    payload: schemas.TierUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allows the trader to manually override the automatic tier engine —
    e.g. if they want to reset progression or set a custom lot table."""
    tier = db.query(models.TierConfig).filter(models.TierConfig.user_id == current_user.id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Configuration de palier introuvable")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tier, field, value)

    db.commit()
    db.refresh(tier)
    await manager.send_to_user(
        current_user.id, {"type": "tier_updated"}
    )
    return tier
