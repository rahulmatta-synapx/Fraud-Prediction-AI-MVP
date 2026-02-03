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
    "jake": {"password": "password123", "full_name": "Jake Thompson"},
    "rahul": {"password": "password123", "full_name": "Rahul Patel"},
    "navsheen": {"password": "password123", "full_name": "Navsheen Singh"},
}

security = HTTPBearer()

class TokenData(BaseModel):
    username: str
    full_name: str

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
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("username")
        full_name: str = payload.get("full_name")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return TokenData(username=username, full_name=full_name)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    return verify_token(credentials.credentials)
