from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app import models
from app.deps import get_current_user
from app.services.risk_engine import compute_risk_state, seed_risk_levels

router = APIRouter(prefix="/risk", tags=["risk"])


# ---------------------------------------------------------------------------
# Pydantic response schemas
# ---------------------------------------------------------------------------

class RiskStateOut(BaseModel):
    capital: float
    niveau: int
    lot: float
    risque: float
    objectif: int
    reste: float
    progression: float
    pertes_restantes: int
    etat: str


class RiskLevelOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    niveau: int
    objectif: int
    lot: float
    risque: float


class RiskLevelUpdate(BaseModel):
    objectif: Optional[int] = None
    lot: Optional[float] = None
    risque: Optional[float] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/state", response_model=RiskStateOut)
def get_risk_state(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Règle 8 — Retourne l'état complet du moteur de risque.
    Utilise le solde MT5 live si disponible, sinon le capital du TierConfig.
    """
    # Prefer live MT5 balance 
    if current_user.mt5_balance is not None:
        capital = current_user.mt5_balance
    else:
        tier = db.query(models.TierConfig).filter(
            models.TierConfig.user_id == current_user.id
        ).first()
        capital = tier.current_capital if tier else 200.0

    state = compute_risk_state(capital, db)
    return RiskStateOut(**state.__dict__)


@router.get("/levels", response_model=list[RiskLevelOut])
def get_risk_levels(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne tous les paliers de risque configurés."""
    seed_risk_levels(db)
    levels = (
        db.query(models.RiskLevel)
        .order_by(models.RiskLevel.niveau.asc())
        .all()
    )
    return levels


@router.put("/levels/{niveau}", response_model=RiskLevelOut)
def update_risk_level(
    niveau: int,
    payload: RiskLevelUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Met à jour un palier de risque (objectif, lot ou risque)."""
    level = db.query(models.RiskLevel).filter(models.RiskLevel.niveau == niveau).first()
    if not level:
        raise HTTPException(status_code=404, detail=f"Palier {niveau} introuvable")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(level, field, value)

    db.commit()
    db.refresh(level)
    return level
