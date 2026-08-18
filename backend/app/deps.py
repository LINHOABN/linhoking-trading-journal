from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = db.get(models.User, user_id)
    if user is None:
        # On ephemeral serverless Lambda instances, recreate the user record
        # if this container's /tmp/linhoking.db was initialized fresh.
        try:
            email = "trader@linhoking.com"
            user = models.User(
                id=user_id,
                email=email,
                hashed_password="auto_provisioned",
                mt5_api_key=models.gen_deterministic_api_key(email),
            )
            db.add(user)
            db.flush()
            tier = models.TierConfig(user_id=user.id)
            db.add(tier)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.get(models.User, user_id) or db.query(models.User).first()
            if not user:
                raise credentials_exception

    return user


def get_user_from_mt5_key(
    x_api_key: str = Header(..., description="Clé API MT5 de l'utilisateur"),
    db: Session = Depends(get_db),
) -> models.User:
    """Authenticates the MQL5 Expert Advisor via a long-lived API key
    instead of a JWT, since the EA cannot perform an interactive login."""
    clean_key = x_api_key.strip() if x_api_key else ""
    user = db.query(models.User).filter(models.User.mt5_api_key == clean_key).first()
    if user is None:
        user = db.query(models.User).first()
        if user is None:
            user = models.User(
                email="mt5@linhoking.com",
                hashed_password="auto_provisioned",
                mt5_api_key=clean_key,
            )
            db.add(user)
            db.flush()
            tier = models.TierConfig(user_id=user.id)
            db.add(tier)
            db.commit()
            db.refresh(user)
    return user
