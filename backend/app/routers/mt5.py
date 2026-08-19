from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_user_from_mt5_key, get_current_user
from app.tier_engine import apply_trade_to_tier
from app.ws_manager import manager

router = APIRouter(prefix="/mt5", tags=["mt5"])


@router.post("/webhook", response_model=schemas.TradeOut, status_code=201)
async def receive_closed_trade(
    payload: schemas.MT5TradePayload,
    current_user: models.User = Depends(get_user_from_mt5_key),
    db: Session = Depends(get_db),
):
    """Called by the MQL5 Expert Advisor (LinhokingBridge.mq5) whenever a
    position closes on the trader's MT5 terminal. Authenticated via the
    X-API-Key header (the user's mt5_api_key), not a JWT."""

    existing = db.query(models.Trade).filter(models.Trade.mt5_ticket == payload.ticket).first()
    if existing:
        # Idempotent: return existing trade if already synced (useful during history import)
        return existing

    trade = models.Trade(
        user_id=current_user.id,
        trade_date=payload.close_time.date(),
        open_time=payload.open_time.time(),
        close_time=payload.close_time.time(),
        symbol=payload.symbol,
        direction=payload.direction,
        volume=payload.volume,
        entry_price=payload.entry_price,
        exit_price=payload.exit_price,
        stop_loss=payload.stop_loss,
        take_profit=payload.take_profit,
        pnl=payload.pnl,
        mt5_ticket=payload.ticket,
        source="mt5",
    )
    db.add(trade)

    tier = db.query(models.TierConfig).filter(models.TierConfig.user_id == current_user.id).first()
    if tier:
        apply_trade_to_tier(db, tier, trade.pnl)
        db.add(
            models.CapitalSnapshot(
                user_id=current_user.id,
                snapshot_date=trade.trade_date,
                capital=tier.current_capital,
                lot=tier.active_lot,
            )
        )

    db.commit()
    db.refresh(trade)

    await manager.send_to_user(
        current_user.id,
        {"type": "mt5_trade_synced", "trade_id": trade.id, "ticket": payload.ticket, "pnl": trade.pnl},
    )
    return trade


@router.post("/rotate-key")
def rotate_mt5_key(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Generates a new MT5 API key, invalidating the previous one —
    use if the key may have leaked (e.g. shared config file)."""
    import uuid

    current_user.mt5_api_key = str(uuid.uuid4())
    db.commit()
    return {"mt5_api_key": current_user.mt5_api_key}


@router.post("/balance")
async def receive_balance(
    payload: schemas.MT5BalancePayload,
    current_user: models.User = Depends(get_user_from_mt5_key),
    db: Session = Depends(get_db),
):
    """Called periodically by the MQL5 EA (via OnTimer) to sync the live
    account balance and equity. Authenticated via X-API-Key header."""
    current_user.mt5_balance = payload.balance
    if payload.account_number:
        current_user.mt5_account_number = str(payload.account_number)
    if payload.broker:
        current_user.mt5_broker = payload.broker
    if payload.leverage:
        current_user.mt5_leverage = payload.leverage
    if payload.currency:
        current_user.mt5_currency = payload.currency

    # Sync Tier Engine current capital with live MT5 balance
    tier = db.query(models.TierConfig).filter(models.TierConfig.user_id == current_user.id).first()
    if tier:
        from app.tier_engine import _tier_for_capital, _next_objective
        tier.current_capital = payload.balance
        threshold, lot, risk = _tier_for_capital(tier.current_capital)
        tier.step_down_threshold = threshold
        tier.active_lot = lot
        tier.current_risk = risk
        tier.next_objective = _next_objective(tier.current_capital)
        db.add(tier)

        # Ensure an initial CapitalSnapshot exists so charts render immediately
        from datetime import date
        has_snapshot = db.query(models.CapitalSnapshot).filter(models.CapitalSnapshot.user_id == current_user.id).first()
        if not has_snapshot:
            db.add(
                models.CapitalSnapshot(
                    user_id=current_user.id,
                    snapshot_date=date.today(),
                    capital=payload.balance,
                    lot=tier.active_lot,
                )
            )

    db.commit()

    await manager.send_to_user(
        current_user.id,
        {
            "type": "balance_updated",
            "balance": payload.balance,
            "equity": payload.equity,
            "account_number": current_user.mt5_account_number,
            "broker": current_user.mt5_broker,
        },
    )
    return {"ok": True, "balance": payload.balance, "equity": payload.equity}
