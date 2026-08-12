"""
LINHOKING Risk Engine Service
==============================
Toute la logique métier du moteur de gestion du risque est centralisée ici.
Le frontend React ne fait qu'afficher les résultats de ce moteur.

Règles implémentées :
  1. Déterminer le niveau actif (palier)
  2. Calculer le risque = niveau × 5%
  3. Calculer le lot = niveau / 10000
  4. Déterminer le prochain objectif
  5. Calculer la progression (%)
  6. Calculer l'argent restant avant le prochain niveau
  7. Calculer le nombre de pertes restantes avant retour au palier inférieur
  8. Mise à jour automatique après chaque trade
"""

from __future__ import annotations
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app import models


# ---------------------------------------------------------------------------
# Default risk ladder — seeded into DB on first startup
# ---------------------------------------------------------------------------

DEFAULT_LEVELS = [
    {"niveau": 100,  "objectif": 200,  "lot": 0.01, "risque": 5.0},
    {"niveau": 200,  "objectif": 300,  "lot": 0.02, "risque": 10.0},
    {"niveau": 300,  "objectif": 350,  "lot": 0.03, "risque": 15.0},
    {"niveau": 400,  "objectif": 500,  "lot": 0.04, "risque": 20.0},
    {"niveau": 500,  "objectif": 650,  "lot": 0.05, "risque": 25.0},
    {"niveau": 600,  "objectif": 800,  "lot": 0.06, "risque": 30.0},
    {"niveau": 700,  "objectif": 950,  "lot": 0.07, "risque": 35.0},
    {"niveau": 800,  "objectif": 1100, "lot": 0.08, "risque": 40.0},
]


def seed_risk_levels(db: Session) -> None:
    """Insert the default levels if the table is empty."""
    if db.query(models.RiskLevel).count() == 0:
        for row in DEFAULT_LEVELS:
            db.add(models.RiskLevel(**row))
        db.commit()


# ---------------------------------------------------------------------------
# State dataclass — the full JSON object returned to the frontend
# ---------------------------------------------------------------------------

@dataclass
class RiskState:
    capital: float          # solde actuel
    niveau: int             # palier actif (ex: 500)
    lot: float              # taille de lot (ex: 0.05)
    risque: float           # risque max en $ (ex: 25)
    objectif: int           # prochain palier cible (ex: 650)
    reste: float            # $ restants avant l'objectif
    progression: float      # % de progression vers l'objectif (0–100)
    pertes_restantes: int   # pertes max avant retour au palier inférieur
    etat: str               # "Croissance" | "Zone rouge" | "Objectif atteint"


# ---------------------------------------------------------------------------
# Rule helpers
# ---------------------------------------------------------------------------

def _get_levels(db: Session) -> list[models.RiskLevel]:
    """Return all risk levels ordered by niveau ascending."""
    return (
        db.query(models.RiskLevel)
        .order_by(models.RiskLevel.niveau.asc())
        .all()
    )


def _active_level(capital: float, levels: list[models.RiskLevel]) -> models.RiskLevel:
    """Règle 1 — Trouve le palier actif pour un capital donné.

    Le palier actif est le plus grand palier dont le seuil (niveau)
    est ≤ capital. Si capital < niveau_minimum, on renvoie quand même
    le premier palier (palier de départ).
    """
    active = levels[0]
    for lv in levels:
        if capital >= lv.niveau:
            active = lv
        else:
            break
    return active


def _previous_level(active: models.RiskLevel, levels: list[models.RiskLevel]) -> models.RiskLevel | None:
    """Retourne le palier immédiatement inférieur, ou None si déjà au premier."""
    idx = next((i for i, lv in enumerate(levels) if lv.niveau == active.niveau), 0)
    return levels[idx - 1] if idx > 0 else None


# ---------------------------------------------------------------------------
# Main function — compute full risk state
# ---------------------------------------------------------------------------

def compute_risk_state(capital: float, db: Session) -> RiskState:
    """Calcule l'état complet du moteur de risque à partir du capital actuel.

    Applique les 8 règles documentées par l'utilisateur.
    """
    levels = _get_levels(db)
    if not levels:
        seed_risk_levels(db)
        levels = _get_levels(db)

    # Règle 1 — Palier actif
    active = _active_level(capital, levels)

    # Règle 2 — Risque = niveau × 5%
    risque = active.risque  # déjà stocké en DB (= niveau × 5%)

    # Règle 3 — Lot = niveau / 10 000
    lot = active.lot  # déjà stocké en DB (= niveau / 10000)

    # Règle 4 — Prochain objectif
    objectif = active.objectif

    # Règle 5 — Progression (%) = capital ÷ objectif × 100
    progression = min(round((capital / objectif) * 100, 1), 100.0) if objectif > 0 else 0.0

    # Règle 6 — Argent restant = objectif - capital
    reste = round(objectif - capital, 2)

    # Règle 7 — Pertes restantes avant retour palier inférieur
    prev = _previous_level(active, levels)
    if prev is not None and risque > 0:
        buffer = capital - prev.objectif  # marge au-dessus du palier précédent
        pertes_restantes = max(0, int(buffer / risque))
    else:
        pertes_restantes = 99  # palier de base, pas de retour possible

    # État général
    if capital <= 0:
        etat = "Zone critique"
    elif reste <= 0:
        etat = "Objectif atteint"
    elif pertes_restantes <= 2:
        etat = "Zone rouge"
    elif pertes_restantes <= 5:
        etat = "Zone orange"
    else:
        etat = "Croissance"

    return RiskState(
        capital=round(capital, 2),
        niveau=active.niveau,
        lot=lot,
        risque=risque,
        objectif=objectif,
        reste=max(reste, 0),
        progression=progression,
        pertes_restantes=pertes_restantes,
        etat=etat,
    )
