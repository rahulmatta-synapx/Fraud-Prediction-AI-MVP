from fastapi import APIRouter, HTTPException, Depends, status
from ..models import LoginRequest, TokenResponse, User
from ..services.auth import authenticate_user, create_access_token, get_current_user, TokenData

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    token = create_access_token({
        "username": user["username"],
        "full_name": user["full_name"]
    })
    
    return TokenResponse(
        access_token=token,
        user=User(username=user["username"], full_name=user["full_name"])
    )

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    return User(username=current_user.username, full_name=current_user.full_name)
