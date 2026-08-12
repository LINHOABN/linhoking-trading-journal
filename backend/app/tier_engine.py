"""
Moteur de paliers (tier engine).

Chaque fois qu'un trade est enregistré (manuellement ou via MT5), on met à jour
l'état du compte : capital, lot actif, risque, objectif suivant, et on vérifie
si le compte doit monter ou descendre de palier.

La logique ci-dessous est un point de départ raisonnable et volontairement
simple — à ajuster selon la vraie stratégie de money management de l'utilisateur
(par ex. paliers non-linéaires, seuils différents, etc.)
"""

from sqlalchemy.orm import Session
from app import models

# Table de progression des lots — à personnaliser selon la stratégie réelle.
# (seuil de capital minimum, lot correspondant, risque $ approximatif)
LOT_LADDER = [
    (0, 0.01, 5.0),
    (150, 0.02, 8.0),
    (260, 0.03, 15.0),
    (500, 0.04, 20.0),
    (800, 0.05, 28.0),
    (1200, 0.06, 35.0),
]


def _tier_for_capital(capital: float) -> tuple[float, float, float]:
    """Returns (step_down_threshold, lot, risk) for the current capital level."""
    current = LOT_LADDER[0]
    for i, (threshold, lot, risk) in enumerate(LOT_LADDER):
        if capital >= threshold:
            current = (threshold, lot, risk)
        else:
            break
    return current


def _next_objective(capital: float) -> float:
    for threshold, _, _ in LOT_LADDER:
        if threshold > capital:
            return threshold
    # Beyond the table: next objective is +50% of current capital, rounded to 50
    return round((capital * 1.5) / 50) * 50


def apply_trade_to_tier(db: Session, tier: models.TierConfig, pnl: float) -> models.TierConfig:
    tier.current_capital = round(tier.current_capital + pnl, 2)

    if pnl < 0:
        tier.consecutive_losses += 1
    else:
        tier.consecutive_losses = 0

    threshold, lot, risk = _tier_for_capital(tier.current_capital)
    tier.step_down_threshold = threshold
    tier.active_lot = lot
    tier.current_risk = risk
    tier.next_objective = _next_objective(tier.current_capital)

    db.add(tier)
    return tier
