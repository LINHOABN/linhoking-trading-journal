from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user
from app.ws_manager import manager

router = APIRouter(prefix="/deposits", tags=["deposits"])


@router.get("/", response_model=schemas.DepositsTotal)
def list_deposits(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all deposits and calculate total invested capital."""
    deposits = (
        db.query(models.Deposit)
        .filter(models.Deposit.user_id == current_user.id)
        .order_by(models.Deposit.deposit_date.asc())
        .all()
    )
    total = sum(d.amount for d in deposits)
    return schemas.DepositsTotal(
        total_invested=total,
        deposit_count=len(deposits),
        deposits=deposits,
    )


@router.post("/", response_model=schemas.DepositOut, status_code=201)
async def add_deposit(
    payload: schemas.DepositCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new capital deposit."""
    deposit = models.Deposit(
        user_id=current_user.id,
        amount=payload.amount,
        label=payload.label,
        deposit_date=payload.deposit_date or date.today(),
    )
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    await manager.send_to_user(
        current_user.id, {"type": "deposit_updated", "deposit_id": deposit.id}
    )
    return deposit


@router.delete("/{deposit_id}", status_code=204)
async def delete_deposit(
    deposit_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a deposit record."""
    deposit = (
        db.query(models.Deposit)
        .filter(models.Deposit.id == deposit_id, models.Deposit.user_id == current_user.id)
        .first()
    )
    if deposit:
        db.delete(deposit)
        db.commit()
        await manager.send_to_user(
            current_user.id, {"type": "deposit_updated", "deposit_id": deposit_id}
        )
