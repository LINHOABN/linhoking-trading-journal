from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user
from app.tier_engine import apply_trade_to_tier
from app.ws_manager import manager

router = APIRouter(prefix="/trades", tags=["trades"])


def determine_session(open_time_val) -> str:
    if not open_time_val:
        return "New York"
    try:
        hour = open_time_val.hour if hasattr(open_time_val, "hour") else int(str(open_time_val).split(":")[0])
        if 0 <= hour < 8:
            return "Asie"
        elif 8 <= hour < 13:
            return "Londres"
        elif 13 <= hour < 17:
            return "Londres / NY"
        else:
            return "New York"
    except Exception:
        return "New York"


@router.get("", response_model=list[schemas.TradeOut])
def list_trades(
    limit: int = 1000,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trades = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == current_user.id)
        .order_by(desc(models.Trade.trade_date), desc(models.Trade.open_time))
        .limit(limit)
        .all()
    )
    
    # Auto-seed historical trades if user has fewer than 60 trades
    if len(trades) < 50:
        from pathlib import Path
        import json
        from datetime import date, time
        seed_file = Path(__file__).parent.parent / "seed_trades.json"
        if seed_file.exists():
            with open(seed_file, "r", encoding="utf-8") as sf:
                raw_trades = json.load(sf)
            
            existing_tickets = {
                t.mt5_ticket for t in db.query(models.Trade.mt5_ticket).filter(models.Trade.user_id == current_user.id).all() if t.mt5_ticket
            }
            
            for tr in raw_trades:
                ticket = tr.get("mt5_ticket")
                if ticket and ticket in existing_tickets:
                    continue
                t_d = date.fromisoformat(tr["trade_date"])
                o_t = time.fromisoformat(tr["open_time"])
                c_t = time.fromisoformat(tr["close_time"])
                db.add(
                    models.Trade(
                        user_id=current_user.id,
                        trade_date=t_d,
                        open_time=o_t,
                        close_time=c_t,
                        symbol=tr.get("symbol", "XAUUSD"),
                        direction=tr.get("direction", "BUY"),
                        volume=tr.get("volume", 0.01),
                        entry_price=tr.get("entry_price", 0.0),
                        exit_price=tr.get("exit_price", 0.0),
                        stop_loss=tr.get("stop_loss", 0.0),
                        take_profit=tr.get("take_profit", 0.0),
                        pnl=tr.get("pnl", 0.0),
                        session=tr.get("session"),
                        mt5_ticket=ticket,
                        source=tr.get("source", "mt5"),
                    )
                )
            db.commit()
            trades = (
                db.query(models.Trade)
                .filter(models.Trade.user_id == current_user.id)
                .order_by(desc(models.Trade.trade_date), desc(models.Trade.open_time))
                .limit(limit)
                .all()
            )

    for t in trades:
        if not t.session:
            t.session = determine_session(t.open_time)
    return trades


@router.post("", response_model=schemas.TradeOut, status_code=201)
async def create_trade(
    payload: schemas.TradeCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade_data = payload.model_dump()
    if not trade_data.get("session") and trade_data.get("open_time"):
        trade_data["session"] = determine_session(trade_data["open_time"])

    trade = models.Trade(user_id=current_user.id, source="manual", **trade_data)
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
        current_user.id, {"type": "trade_created", "trade_id": trade.id, "pnl": trade.pnl}
    )
    return trade


@router.patch("/{trade_id}", response_model=schemas.TradeOut)
async def update_trade(
    trade_id: str,
    payload: schemas.TradeUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = (
        db.query(models.Trade)
        .filter(models.Trade.id == trade_id, models.Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade introuvable")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(trade, field, value)

    db.commit()
    db.refresh(trade)
    await manager.send_to_user(
        current_user.id, {"type": "trade_updated", "trade_id": trade.id}
    )
    return trade


import os, uuid
from fastapi import File, UploadFile

@router.post("/{trade_id}/screenshot", response_model=schemas.TradeOut)
async def upload_trade_screenshot(
    trade_id: str,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = (
        db.query(models.Trade)
        .filter(models.Trade.id == trade_id, models.Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade introuvable")

    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join("uploads", filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    new_url = f"/uploads/{filename}"
    
    # Parse existing screenshots or create new list
    existing_urls = []
    if trade.screenshot_url:
        try:
            import json
            parsed = json.loads(trade.screenshot_url)
            if isinstance(parsed, list):
                existing_urls = parsed
            else:
                existing_urls = [trade.screenshot_url]
        except Exception:
            existing_urls = [trade.screenshot_url]

    existing_urls.append(new_url)
    import json
    trade.screenshot_url = json.dumps(existing_urls)
    db.commit()
    db.refresh(trade)
    await manager.send_to_user(
        current_user.id, {"type": "trade_updated", "trade_id": trade.id}
    )
    return trade


@router.delete("/{trade_id}/screenshot", response_model=schemas.TradeOut)
async def delete_trade_screenshot(
    trade_id: str,
    url: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = (
        db.query(models.Trade)
        .filter(models.Trade.id == trade_id, models.Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade introuvable")

    if trade.screenshot_url:
        import json
        try:
            parsed = json.loads(trade.screenshot_url)
            if isinstance(parsed, list):
                filtered = [item for item in parsed if item != url]
                trade.screenshot_url = json.dumps(filtered) if filtered else None
            elif trade.screenshot_url == url:
                trade.screenshot_url = None
        except Exception:
            if trade.screenshot_url == url:
                trade.screenshot_url = None

    db.commit()
    db.refresh(trade)
    await manager.send_to_user(
        current_user.id, {"type": "trade_updated", "trade_id": trade.id}
    )
    return trade


@router.post("/{trade_id}/voice", response_model=schemas.TradeOut)
async def upload_trade_voice(
    trade_id: str,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = (
        db.query(models.Trade)
        .filter(models.Trade.id == trade_id, models.Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade introuvable")

    # Read binary content and encode as base64 Data URL so it is stored directly in Neon PostgreSQL
    import base64
    content = await file.read()
    content_type = file.content_type or "audio/webm"
    b64 = base64.b64encode(content).decode("utf-8")
    voice_data_url = f"data:{content_type};base64,{b64}"

    trade.voice_url = voice_data_url
    db.commit()
    db.refresh(trade)
    await manager.send_to_user(
        current_user.id, {"type": "trade_updated", "trade_id": trade.id}
    )
    return trade


@router.delete("/{trade_id}/voice", response_model=schemas.TradeOut)
async def delete_trade_voice(
    trade_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = (
        db.query(models.Trade)
        .filter(models.Trade.id == trade_id, models.Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade introuvable")

    trade.voice_url = None
    db.commit()
    db.refresh(trade)
    await manager.send_to_user(
        current_user.id, {"type": "trade_updated", "trade_id": trade.id}
    )
    return trade


@router.delete("/{trade_id}", status_code=204)
async def delete_trade(
    trade_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = (
        db.query(models.Trade)
        .filter(models.Trade.id == trade_id, models.Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade introuvable")
    db.delete(trade)
    db.commit()
    await manager.send_to_user(
        current_user.id, {"type": "trade_deleted", "trade_id": trade_id}
    )

