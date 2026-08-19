from datetime import date, time, datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


# ---------- Auth ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    mt5_api_key: str
    mt5_balance: Optional[float] = None
    mt5_account_number: Optional[str] = None
    mt5_broker: Optional[str] = None
    mt5_leverage: Optional[int] = None
    mt5_currency: Optional[str] = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Trades ----------

class TradeBase(BaseModel):
    trade_date: date
    open_time: time
    close_time: time
    symbol: str = "XAUUSD"
    direction: Literal["BUY", "SELL"]
    volume: float
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    pnl: float
    emotion: Optional[str] = None
    strategy: Optional[str] = None
    mistake: Optional[str] = None
    note: Optional[str] = None
    session: Optional[str] = None
    confluences: Optional[str] = None
    screenshot_url: Optional[str] = None
    voice_url: Optional[str] = None


class TradeCreate(TradeBase):
    pass


class TradeUpdate(BaseModel):
    emotion: Optional[str] = None
    strategy: Optional[str] = None
    mistake: Optional[str] = None
    note: Optional[str] = None
    session: Optional[str] = None
    confluences: Optional[str] = None
    screenshot_url: Optional[str] = None
    voice_url: Optional[str] = None


class VoicePayload(BaseModel):
    audio_base64: str


class TradeOut(TradeBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    mt5_ticket: Optional[str] = None
    source: str
    created_at: datetime

    @field_validator("voice_url", mode="after")
    @classmethod
    def transform_voice_url(cls, v: Optional[str], info) -> Optional[str]:
        if not v:
            return None
        if v.startswith("/trades/") or v.startswith("http") or v.startswith("data:"):
            return v
        trade_id = info.data.get("id") if hasattr(info, "data") and isinstance(info.data, dict) else None
        if trade_id:
            return f"/trades/{trade_id}/audio"
        return "/trades/audio"


# ---------- MT5 bridge ----------

class MT5BalancePayload(BaseModel):
    """Syncs the live MT5 account balance and account metadata."""
    balance: float
    equity: float
    account_number: Optional[str] = None
    broker: Optional[str] = None
    leverage: Optional[int] = None
    currency: Optional[str] = None

class MT5TradePayload(BaseModel):
    """Payload sent by the MQL5 Expert Advisor when a position closes."""

    ticket: str
    symbol: str
    direction: Literal["BUY", "SELL"]
    volume: float
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    pnl: float
    open_time: datetime
    close_time: datetime

    @field_validator("open_time", "close_time", mode="before")
    @classmethod
    def parse_datetime(cls, v):
        if isinstance(v, str):
            v = v.replace(".", "-").replace(" ", "T")
        return v


# ---------- Tier engine ----------

class TierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    starting_capital: float
    current_capital: float
    active_lot: float
    current_risk: float
    next_objective: float
    step_down_threshold: float
    losses_before_step_down: int
    consecutive_losses: int


class TierUpdate(BaseModel):
    starting_capital: Optional[float] = None
    active_lot: Optional[float] = None
    current_risk: Optional[float] = None
    next_objective: Optional[float] = None
    step_down_threshold: Optional[float] = None
    losses_before_step_down: Optional[int] = None


# ---------- Stats ----------

class StatsSummary(BaseModel):
    win_rate: float
    total_trades: int
    avg_win: float
    avg_loss: float
    best_day: Optional[str] = None
    best_day_pnl: Optional[float] = None
    worst_day: Optional[str] = None
    worst_day_pnl: Optional[float] = None
    best_hour: Optional[str] = None


class CapitalPoint(BaseModel):
    date: date
    capital: float


class LotPoint(BaseModel):
    date: date
    lot: float


# ---------- Deposits ----------

class DepositCreate(BaseModel):
    amount: float
    label: Optional[str] = None
    deposit_date: Optional[date] = None


class DepositOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    amount: float
    label: Optional[str] = None
    deposit_date: date
    created_at: datetime


class DepositsTotal(BaseModel):
    total_invested: float
    deposit_count: int
    deposits: list[DepositOut]

