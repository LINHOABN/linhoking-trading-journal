import uuid
from datetime import date, datetime, time
from sqlalchemy import String, Float, Date, Time, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def gen_deterministic_api_key(email: str) -> str:
    if not email:
        return str(uuid.uuid4())
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"linhoking-mt5-{email.lower().strip()}"))


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    mt5_api_key: Mapped[str] = mapped_column(String, unique=True, index=True, default=gen_uuid)
    mt5_balance: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    mt5_account_number: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    mt5_broker: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    mt5_leverage: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    mt5_currency: Mapped[str | None] = mapped_column(String, nullable=True, default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


    trades: Mapped[list["Trade"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    tier: Mapped["TierConfig"] = relationship(back_populates="owner", uselist=False, cascade="all, delete-orphan")
    snapshots: Mapped[list["CapitalSnapshot"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    deposits: Mapped[list["Deposit"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)

    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open_time: Mapped[time] = mapped_column(Time, nullable=False)
    close_time: Mapped[time] = mapped_column(Time, nullable=False)
    symbol: Mapped[str] = mapped_column(String, default="XAUUSD")
    direction: Mapped[str] = mapped_column(String)  # BUY / SELL
    volume: Mapped[float] = mapped_column(Float)
    entry_price: Mapped[float] = mapped_column(Float)
    exit_price: Mapped[float] = mapped_column(Float)
    stop_loss: Mapped[float] = mapped_column(Float)
    take_profit: Mapped[float] = mapped_column(Float)
    pnl: Mapped[float] = mapped_column(Float)

    emotion: Mapped[str | None] = mapped_column(String, nullable=True)
    strategy: Mapped[str | None] = mapped_column(String, nullable=True)
    mistake: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    session: Mapped[str | None] = mapped_column(String, nullable=True)
    confluences: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON formatted string
    screenshot_url: Mapped[str | None] = mapped_column(String, nullable=True)
    voice_url: Mapped[str | None] = mapped_column(String, nullable=True)  # Audio recording URL / Data URL

    # Set when the trade was pushed automatically by the MQL5 bridge
    mt5_ticket: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    source: Mapped[str] = mapped_column(String, default="manual")  # manual | mt5

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped["User"] = relationship(back_populates="trades")


class TierConfig(Base):
    """The automatic palier (tier) engine state for a user's account."""

    __tablename__ = "tier_configs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)

    starting_capital: Mapped[float] = mapped_column(Float, default=200.0)
    current_capital: Mapped[float] = mapped_column(Float, default=200.0)
    active_lot: Mapped[float] = mapped_column(Float, default=0.01)
    current_risk: Mapped[float] = mapped_column(Float, default=10.0)
    next_objective: Mapped[float] = mapped_column(Float, default=300.0)
    step_down_threshold: Mapped[float] = mapped_column(Float, default=150.0)
    losses_before_step_down: Mapped[int] = mapped_column(Integer, default=3)
    consecutive_losses: Mapped[int] = mapped_column(Integer, default=0)

    owner: Mapped["User"] = relationship(back_populates="tier")


class CapitalSnapshot(Base):
    """A point on the equity curve, appended whenever a trade is recorded."""

    __tablename__ = "capital_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    capital: Mapped[float] = mapped_column(Float)
    lot: Mapped[float] = mapped_column(Float)

    owner: Mapped["User"] = relationship(back_populates="snapshots")


class RiskLevel(Base):
    """Data-driven risk ladder table.
    Each row defines one 'palier' (level) of the LINHOKING risk engine.
    Columns:
        niveau    – minimum capital to activate this level (e.g. 100, 200, …)
        objectif  – capital target to reach next level
        lot       – XAUUSD lot size at this level
        risque    – max risk per trade in USD (= niveau × 5%)
    """

    __tablename__ = "risk_levels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    niveau: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    objectif: Mapped[int] = mapped_column(Integer, nullable=False)
    lot: Mapped[float] = mapped_column(Float, nullable=False)
    risque: Mapped[float] = mapped_column(Float, nullable=False)


class Deposit(Base):
    """A capital deposit (versement) made by the trader."""

    __tablename__ = "deposits"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "Dépôt initial", "Rechargement"
    deposit_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped["User"] = relationship(back_populates="deposits")

