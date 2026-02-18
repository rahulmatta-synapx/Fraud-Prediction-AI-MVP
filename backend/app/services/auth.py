import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

JWT_SECRET = os.environ.get("JWT_SECRET", "fraud-guard-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

USERS = {
    "jake": {"password": "password123", "full_name": "Jake Bowles"},
    "rahul": {"password": "password123", "full_name": "Rahul Matta"},
    "navsheen": {"password": "password123", "full_name": "Navsheen Koul"},
}

security = HTTPBearer()

class TokenData(BaseModel):
    username: str
    full_name: str
    org_id: Optional[str] = None

def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = USERS.get(username.lower())
    if user and user["password"] == password:
        return {"username": username.lower(), "full_name": user["full_name"]}
    return None

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> TokenData:
    """Try legacy HS256 token first, then Azure AD RS256 token."""
    # 1. Try legacy HS256 token
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("username")
        full_name: str = payload.get("full_name")
        if username is not None:
            return TokenData(username=username, full_name=full_name, org_id=None)
    except JWTError:
        pass

    # 2. Try Azure AD RS256 token
    try:
        from .azure_ad_auth import validate_azure_ad_token, TokenValidationError
        from ..db.cosmos import get_cosmos_db

        claims = validate_azure_ad_token(token)
        azure_ad_object_id = claims.get("oid")
        if not azure_ad_object_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing oid claim"
            )

        db = get_cosmos_db()
        user = db.get_user_by_azure_ad_id(azure_ad_object_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found. Please login again."
            )

        return TokenData(
            username=user.get("email", claims.get("preferred_username", "")),
            full_name=user.get("full_name", claims.get("name", "")),
            org_id=user.get("org_id"),
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    return verify_token(credentials.credentials)
