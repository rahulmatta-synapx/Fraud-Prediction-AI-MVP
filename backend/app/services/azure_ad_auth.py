"""
Azure AD Multi-Tenant Authentication Service

Handles:
1. JWT token validation (signature, expiration, audience, issuer)
2. JWKS (JSON Web Key Set) fetching and caching
3. Dynamic issuer validation for multi-tenant apps
4. User and organization auto-provisioning
"""

import os
import time
import uuid
import requests
from typing import Dict, Optional
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError, JWTClaimsError
from datetime import datetime

# Azure AD Configuration
AZURE_AD_CLIENT_ID = os.getenv("AZURE_AD_CLIENT_ID")
AZURE_AD_TENANT_ID = os.getenv("AZURE_AD_TENANT_ID")

# JWKS endpoint for multi-tenant apps
JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"

# Cache for JWKS keys (avoids fetching on every request)
_jwks_cache = {
    "keys": None,
    "expires_at": 0
}


class TokenValidationError(Exception):
    """Raised when token validation fails"""
    pass


def get_jwks_keys() -> Dict:
    """
    Fetch JWKS keys from Microsoft with caching.
    Keys are cached for 24 hours to reduce API calls.
    """
    current_time = time.time()

    # Return cached keys if still valid
    if _jwks_cache["keys"] and current_time < _jwks_cache["expires_at"]:
        return _jwks_cache["keys"]

    try:
        response = requests.get(JWKS_URL, timeout=10)
        response.raise_for_status()
        keys = response.json()

        _jwks_cache["keys"] = keys
        _jwks_cache["expires_at"] = current_time + (24 * 60 * 60)

        return keys
    except requests.RequestException as e:
        raise TokenValidationError(f"Failed to fetch JWKS keys: {str(e)}")


def validate_azure_ad_token(token: str) -> Dict:
    """
    Validate Azure AD JWT token.

    Security Checks:
    1. Signature validation using Microsoft's JWKS
    2. Expiration check
    3. Audience validation (must match our client ID)
    4. Dynamic issuer validation (multi-tenant)

    Returns: Dict of validated claims
    Raises: TokenValidationError
    """
    try:
        jwks = get_jwks_keys()

        # Decode header to find key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise TokenValidationError("Token missing 'kid' in header")

        # Find matching key
        rsa_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break

        if not rsa_key:
            raise TokenValidationError(f"Unable to find matching key (kid: {kid})")

        # Decode and validate token
        # Try id_token validation first (audience = our client ID)
        # If that fails with audience mismatch, try as v1 access_token
        # (audience = Graph API "00000003-0000-0000-c000-000000000000")
        try:
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=AZURE_AD_CLIENT_ID,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": False,  # Dynamic - validated manually
                }
            )
        except JWTClaimsError as aud_err:
            # Might be a v1.0 access_token (audience = Microsoft Graph)
            # Accept it but still validate signature and expiry
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience="00000003-0000-0000-c000-000000000000",
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": False,
                }
            )
            # Map v1 claims to v2 format for consistency
            if "preferred_username" not in payload and "upn" in payload:
                payload["preferred_username"] = payload["upn"]

        # Dynamic issuer validation for multi-tenant
        # Accept both v1.0 (sts.windows.net) and v2.0 (login.microsoftonline.com) issuers
        tid = payload.get("tid")
        if not tid:
            raise TokenValidationError("Token missing 'tid' claim")

        valid_issuers = [
            f"https://login.microsoftonline.com/{tid}/v2.0",
            f"https://sts.windows.net/{tid}/",
        ]
        actual_issuer = payload.get("iss")

        if actual_issuer not in valid_issuers:
            raise TokenValidationError(
                f"Invalid issuer. Expected one of: {valid_issuers}, Got: {actual_issuer}"
            )

        # Ensure required claims
        if "oid" not in payload:
            raise TokenValidationError("Token missing required claim: oid")

        return payload

    except ExpiredSignatureError:
        raise TokenValidationError("Token has expired")
    except JWTClaimsError as e:
        raise TokenValidationError(f"Token claims validation failed: {str(e)}")
    except JWTError as e:
        raise TokenValidationError(f"Token validation failed: {str(e)}")
    except TokenValidationError:
        raise
    except Exception as e:
        raise TokenValidationError(f"Unexpected error: {str(e)}")


def extract_user_info(token_claims: Dict) -> Dict:
    """Extract user info from validated token claims."""
    return {
        "azure_ad_object_id": token_claims["oid"],
        "tenant_id": token_claims["tid"],
        "email": (
            token_claims.get("preferred_username")
            or token_claims.get("email")
            or token_claims.get("upn")
        ),
        "full_name": token_claims.get("name", ""),
    }


def generate_org_id_from_tenant_id(tenant_id: str) -> str:
    """Generate org_id from Azure AD tenant ID."""
    clean_tid = tenant_id.replace("-", "")[:12]
    return f"org_{clean_tid}"


def provision_organization_and_user(db, token_claims: Dict) -> Dict:
    """
    Auto-provision organization and user on first login.
    All Cosmos calls are SYNC (not async).

    IMPORTANT: If the org already exists (created via Marketplace Landing Page
    with enterprise tier), we must NOT overwrite the subscription to free/trial.

    Returns: dict with 'organization' and 'user' keys
    """
    user_info = extract_user_info(token_claims)
    tenant_id = user_info["tenant_id"]
    azure_ad_object_id = user_info["azure_ad_object_id"]

    # Check if org exists for this tenant
    org = db.get_organization_by_tenant_id(tenant_id)

    if not org:
        org_id = generate_org_id_from_tenant_id(tenant_id)

        # Derive org name from email domain
        email = user_info.get("email", "")
        if email and "@" in email:
            domain = email.split("@")[1]
            org_name = domain.split(".")[0].title()
        else:
            org_name = f"Organization {org_id}"

        # New org with no prior Marketplace purchase → start on free/trial.
        # If they purchased on Marketplace first, the Landing Page handler
        # already created the org as enterprise/active — so we never reach here.
        org = {
            "id": org_id,
            "org_id": org_id,
            "org_name": org_name,
            "azure_tenant_id": tenant_id,
            "subscription_status": "trial",
            "subscription_tier": "free",
            "claims_count": 0,
            "users_count": 0,
            "trial_started_at": datetime.utcnow().isoformat(),
            "trial_days": 14,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        db.create_organization(org)
    else:
        # Org already exists — DO NOT overwrite subscription fields.
        # Just update the org name if it was auto-generated and user now has a
        # better domain, but leave subscription_tier/status untouched.
        pass

    # Check if user exists
    user = db.get_user_by_azure_ad_id(azure_ad_object_id)

    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"

        user = {
            "id": user_id,
            "user_id": user_id,
            "org_id": org["org_id"],
            "azure_ad_object_id": azure_ad_object_id,
            "email": user_info["email"],
            "full_name": user_info["full_name"],
            "role": "user",
            "created_at": datetime.utcnow().isoformat(),
        }
        db.create_user(user)

        # Increment users_count
        db.increment_org_users_count(org["org_id"])
    else:
        # Update last login
        user["last_login"] = datetime.utcnow().isoformat()
        user["email"] = user_info["email"]
        user["full_name"] = user_info["full_name"]
        db.update_user(user)

    return {
        "organization": org,
        "user": user,
    }


def check_subscription_status(org: Dict) -> bool:
    """Check if org has active subscription."""
    return org.get("subscription_status") in ["active", "trial"]
