from fastapi import APIRouter, HTTPException, Depends, status, Header
from ..models import LoginRequest, TokenResponse, User, UserWithOrg, Organization
from ..services.auth import authenticate_user, create_access_token, get_current_user, TokenData
from ..services.azure_ad_auth import (
    validate_azure_ad_token,
    provision_organization_and_user,
    TokenValidationError,
)
from ..services.subscription import get_subscription_info, is_subscription_active
from ..db.cosmos import get_cosmos_db

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ============================================================================
# LEGACY ENDPOINTS (backward compatibility)
# ============================================================================

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Legacy login - kept for backward compatibility."""
    user = authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token({
        "username": user["username"],
        "full_name": user["full_name"],
    })

    return TokenResponse(
        access_token=token,
        user=User(username=user["username"], full_name=user["full_name"]),
    )

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    """Legacy user info endpoint."""
    return User(username=current_user.username, full_name=current_user.full_name)


# ============================================================================
# AZURE AD ENDPOINTS
# ============================================================================

@router.post("/azure-ad/validate")
async def validate_token(authorization: str = Header(None)):
    """
    Validate Azure AD token and auto-provision organization/user.
    Frontend calls this after successful MSAL login.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
        )

    token = parts[1]

    try:
        # Validate token with Microsoft
        token_claims = validate_azure_ad_token(token)

        # Auto-provision organization and user (sync calls)
        db = get_cosmos_db()
        result = provision_organization_and_user(db, token_claims)

        org = result["organization"]
        user = result["user"]

        return {
            "user": {
                "user_id": user.get("user_id"),
                "email": user.get("email"),
                "full_name": user.get("full_name"),
                "role": user.get("role"),
                "azure_ad_object_id": user.get("azure_ad_object_id"),
                "org_id": user.get("org_id"),
                "organization": {
                    "org_id": org.get("org_id"),
                    "org_name": org.get("org_name"),
                    "subscription_status": org.get("subscription_status"),
                    "subscription_tier": org.get("subscription_tier"),
                },
            },
            "subscription": get_subscription_info(org, db),
            "token_valid": True,
        }

    except TokenValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.get("/azure-ad/me")
async def get_azure_ad_user(authorization: str = Header(None)):
    """Get current user info from Azure AD token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )

    token = parts[1]

    try:
        token_claims = validate_azure_ad_token(token)
        db = get_cosmos_db()

        azure_ad_object_id = token_claims["oid"]
        user = db.get_user_by_azure_ad_id(azure_ad_object_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found. Please login again.",
            )

        org = db.get_organization(user["org_id"])
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found",
            )

        return {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "role": user.get("role"),
            "org_id": user.get("org_id"),
            "organization": {
                "org_id": org.get("org_id"),
                "org_name": org.get("org_name"),
                "subscription_status": org.get("subscription_status"),
                "subscription_tier": org.get("subscription_tier"),
                "claims_count": org.get("claims_count", 0),
                "users_count": org.get("users_count", 0),
            },
        }

    except TokenValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )
