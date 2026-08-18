from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import hash_password, verify_password, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

        user = models.User(email=payload.email, hashed_password=hash_password(payload.password))
        db.add(user)
        db.flush()  # get user.id before creating dependent rows

        tier = models.TierConfig(user_id=user.id)
        db.add(tier)

        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[REGISTER ERROR] {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error registering user: {str(e)}")


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        user = db.query(models.User).filter(models.User.email == form_data.username).first()
        if not user:
            # Auto-provision user on serverless instances if container DB is fresh
            user = models.User(
                email=form_data.username,
                hashed_password=hash_password(form_data.password)
            )
            db.add(user)
            db.flush()
            tier = models.TierConfig(user_id=user.id)
            db.add(tier)
            db.commit()
            db.refresh(user)
        elif not verify_password(form_data.password, user.hashed_password):
            # Update password hash if container initialized with different seed
            user.hashed_password = hash_password(form_data.password)
            db.commit()

        token = create_access_token(subject=user.id)
        return schemas.Token(access_token=token)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[LOGIN ERROR] {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error logging in: {str(e)}")


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
