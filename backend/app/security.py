import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from app.config import settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return "pbkdf2$" + base64.b64encode(salt).decode("utf-8") + "$" + base64.b64encode(key).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False

    # Check PBKDF2 format
    if hashed_password.startswith("pbkdf2$"):
        try:
            parts = hashed_password.split("$")
            if len(parts) != 3:
                return False
            salt = base64.b64decode(parts[1])
            expected_key = base64.b64decode(parts[2])
            key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
            return hmac.compare_digest(key, expected_key)
        except Exception:
            return False

    # Fallback for bcrypt hashes if any exist
    try:
        import bcrypt
        pwd_bytes = plain_password.encode("utf-8")
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")


def _b64d(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_access_token(subject: str) -> str:
    try:
        from jose import jwt
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return jwt.encode({"sub": str(subject), "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    except Exception:
        pass

    header = _b64e(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    exp = int((datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp())
    payload = _b64e(json.dumps({"sub": str(subject), "exp": exp}).encode("utf-8"))
    sig_input = f"{header}.{payload}".encode("utf-8")
    sig = _b64e(hmac.new(settings.SECRET_KEY.encode("utf-8"), sig_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def decode_access_token(token: str) -> str | None:
    if not token:
        return None

    try:
        from jose import jwt
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        return str(sub) if sub is not None else None
    except Exception:
        pass

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, sig = parts
        sig_input = f"{header}.{payload}".encode("utf-8")
        expected_sig = _b64e(hmac.new(settings.SECRET_KEY.encode("utf-8"), sig_input, hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload_data = json.loads(_b64d(payload).decode("utf-8"))
        exp = payload_data.get("exp")
        if exp and datetime.now(timezone.utc).timestamp() > exp:
            return None
        sub = payload_data.get("sub")
        return str(sub) if sub is not None else None
    except Exception:
        return None
