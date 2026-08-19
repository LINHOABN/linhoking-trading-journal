from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import asc

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary", response_model=schemas.StatsSummary)
def summary(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    trades = db.query(models.Trade).filter(models.Trade.user_id == current_user.id).all()

    if not trades:
        return schemas.StatsSummary(win_rate=0, total_trades=0, avg_win=0, avg_loss=0)

    wins = [t for t in trades if t.pnl >= 0]
    losses = [t for t in trades if t.pnl < 0]

    by_day: dict[str, float] = defaultdict(float)
    by_hour: dict[str, float] = defaultdict(float)
    for t in trades:
        by_day[t.trade_date.isoformat()] += t.pnl
        by_hour[f"{t.open_time.hour:02d}h"] += t.pnl

    best_day = max(by_day.items(), key=lambda kv: kv[1]) if by_day else None
    worst_day = min(by_day.items(), key=lambda kv: kv[1]) if by_day else None
    best_hour = max(by_hour.items(), key=lambda kv: kv[1]) if by_hour else None

    return schemas.StatsSummary(
        win_rate=round(len(wins) / len(trades) * 100, 1),
        total_trades=len(trades),
        avg_win=round(sum(t.pnl for t in wins) / len(wins), 2) if wins else 0,
        avg_loss=round(sum(t.pnl for t in losses) / len(losses), 2) if losses else 0,
        best_day=best_day[0] if best_day else None,
        best_day_pnl=round(best_day[1], 2) if best_day else None,
        worst_day=worst_day[0] if worst_day else None,
        worst_day_pnl=round(worst_day[1], 2) if worst_day else None,
        best_hour=best_hour[0] if best_hour else None,
    )


@router.get("/capital-curve", response_model=list[schemas.CapitalPoint])
def capital_curve(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Compute the real capital curve from cumulative trade P&L,
    starting from the user's configured starting_capital."""
    tier = db.query(models.TierConfig).filter(
        models.TierConfig.user_id == current_user.id
    ).first()
    starting_capital = tier.starting_capital if tier else 200.0

    trades = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == current_user.id)
        .order_by(asc(models.Trade.trade_date), asc(models.Trade.close_time))
        .all()
    )

    if not trades:
        return []

    # Accumulate daily P&L
    daily_pnl: dict[str, float] = defaultdict(float)
    for t in trades:
        daily_pnl[t.trade_date.isoformat()] += t.pnl

    # Build cumulative capital curve
    points = []
    capital = starting_capital
    for day in sorted(daily_pnl.keys()):
        capital = round(capital + daily_pnl[day], 2)
        points.append(schemas.CapitalPoint(date=day, capital=capital))

    return points


@router.get("/lot-history", response_model=list[schemas.LotPoint])
def lot_history(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Returns the actual lot volume used for every trade across history."""
    trades = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == current_user.id)
        .order_by(asc(models.Trade.trade_date), asc(models.Trade.open_time))
        .all()
    )

    if not trades:
        return []

    points = []
    for t in trades:
        points.append(schemas.LotPoint(
            date=t.trade_date.isoformat(),
            lot=float(t.volume) if t.volume is not None else 0.01
        ))

    return points
