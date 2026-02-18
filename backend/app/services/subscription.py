"""
Subscription Management Service

Two tiers only:
  - free:       14-day trial, limited claims/month (50), 5 users, 3 docs/claim
  - enterprise: Unlimited everything, full feature access

Handles:
1. Trial expiry tracking (14-day free trial)
2. Usage enforcement on free tier (block when limits exceeded)
3. Subscription status checks (active, trial, suspended, cancelled)
"""

from datetime import datetime, timedelta
from typing import Dict, Any

# ============================================================================
# TIER DEFINITIONS — only "free" and "enterprise"
# ============================================================================

TIER_LIMITS = {
    "free": {
        "display_name": "Free Tier",
        "max_claims_per_month": 50,
        "max_users": 5,
        "max_documents_per_claim": 3,
        "features": {
            "ai_scoring": True,
            "rules_engine": True,
            "document_extraction": True,
            "broker_analysis": False,
            "batch_processing": False,
            "api_access": False,
            "priority_support": False,
        },
    },
    "enterprise": {
        "display_name": "Enterprise",
        "max_claims_per_month": -1,   # unlimited
        "max_users": -1,              # unlimited
        "max_documents_per_claim": -1, # unlimited
        "features": {
            "ai_scoring": True,
            "rules_engine": True,
            "document_extraction": True,
            "broker_analysis": True,
            "batch_processing": True,
            "api_access": True,
            "priority_support": True,
        },
    },
}

TRIAL_DURATION_DAYS = 14


# ============================================================================
# SUBSCRIPTION CHECKS
# ============================================================================


def get_tier_limits(tier: str) -> Dict[str, Any]:
    """Get limits for a subscription tier."""
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


def is_subscription_active(org: Dict[str, Any]) -> bool:
    """
    Check if an organization's subscription allows access.
    Active and trial (non-expired) are allowed.
    """
    status = org.get("subscription_status", "trial")

    if status in ("active", ""):
        return True

    if status == "trial":
        return not is_trial_expired(org)

    # suspended, cancelled
    return False


def is_trial_expired(org: Dict[str, Any]) -> bool:
    """Check if the organization's trial has expired."""
    if org.get("subscription_status") != "trial":
        return False

    trial_started = org.get("trial_started_at") or org.get("created_at")
    if not trial_started:
        return False

    try:
        if isinstance(trial_started, str):
            start_date = datetime.fromisoformat(trial_started.replace("Z", "+00:00"))
        else:
            start_date = trial_started

        trial_days = org.get("trial_days", TRIAL_DURATION_DAYS)
        expiry_date = start_date + timedelta(days=trial_days)

        return datetime.utcnow() > expiry_date.replace(tzinfo=None)
    except (ValueError, TypeError):
        return False


def get_trial_days_remaining(org: Dict[str, Any]) -> int:
    """Get number of days remaining in trial. Returns 0 if expired or not trial."""
    if org.get("subscription_status") != "trial":
        return 0

    trial_started = org.get("trial_started_at") or org.get("created_at")
    if not trial_started:
        return 0

    try:
        if isinstance(trial_started, str):
            start_date = datetime.fromisoformat(trial_started.replace("Z", "+00:00"))
        else:
            start_date = trial_started

        trial_days = org.get("trial_days", TRIAL_DURATION_DAYS)
        expiry_date = start_date + timedelta(days=trial_days)
        remaining = (expiry_date.replace(tzinfo=None) - datetime.utcnow()).days

        return max(0, remaining)
    except (ValueError, TypeError):
        return 0


def check_claims_limit(org: Dict[str, Any], db) -> Dict[str, Any]:
    """
    Check if the organization can create more claims this month.
    Returns dict with 'allowed', 'current', 'limit', 'message'.
    """
    tier = org.get("subscription_tier", "free")
    limits = get_tier_limits(tier)
    max_claims = limits["max_claims_per_month"]

    # Unlimited (enterprise)
    if max_claims == -1:
        return {
            "allowed": True,
            "current": 0,
            "limit": -1,
            "message": "Unlimited claims",
        }

    # Count claims created this month
    org_id = org.get("org_id")
    claims_this_month = _count_claims_this_month(org_id, db)

    allowed = claims_this_month < max_claims

    return {
        "allowed": allowed,
        "current": claims_this_month,
        "limit": max_claims,
        "message": (
            f"Claim limit reached ({claims_this_month}/{max_claims} this month). "
            f"Upgrade to Enterprise for unlimited claims."
            if not allowed
            else f"{claims_this_month}/{max_claims} claims used this month"
        ),
    }


def check_users_limit(org: Dict[str, Any]) -> Dict[str, Any]:
    """Check if the organization can add more users."""
    tier = org.get("subscription_tier", "free")
    limits = get_tier_limits(tier)
    max_users = limits["max_users"]

    current_users = org.get("users_count", 0)

    if max_users == -1:
        return {"allowed": True, "current": current_users, "limit": -1}

    allowed = current_users < max_users

    return {
        "allowed": allowed,
        "current": current_users,
        "limit": max_users,
        "message": (
            f"User limit reached ({current_users}/{max_users}). "
            f"Upgrade to Enterprise for unlimited users."
            if not allowed
            else f"{current_users}/{max_users} users"
        ),
    }


def check_documents_limit(org: Dict[str, Any], claim: Dict[str, Any]) -> Dict[str, Any]:
    """Check if more documents can be uploaded to a claim."""
    tier = org.get("subscription_tier", "free")
    limits = get_tier_limits(tier)
    max_docs = limits["max_documents_per_claim"]

    current_docs = len(claim.get("documents", []))

    if max_docs == -1:
        return {"allowed": True, "current": current_docs, "limit": -1}

    allowed = current_docs < max_docs

    return {
        "allowed": allowed,
        "current": current_docs,
        "limit": max_docs,
        "message": (
            f"Document limit reached ({current_docs}/{max_docs} per claim). "
            f"Upgrade to Enterprise for unlimited documents."
            if not allowed
            else f"{current_docs}/{max_docs} documents"
        ),
    }


def check_feature_access(org: Dict[str, Any], feature: str) -> bool:
    """Check if an organization has access to a specific feature."""
    tier = org.get("subscription_tier", "free")
    limits = get_tier_limits(tier)
    return limits["features"].get(feature, False)


def get_subscription_info(org: Dict[str, Any], db) -> Dict[str, Any]:
    """
    Get full subscription info for an organization.
    Used by the frontend to display usage, limits, and banners.
    """
    tier = org.get("subscription_tier", "free")
    status = org.get("subscription_status", "trial")
    limits = get_tier_limits(tier)

    org_id = org.get("org_id")
    claims_this_month = _count_claims_this_month(org_id, db) if org_id else 0

    info = {
        "subscription_status": status,
        "subscription_tier": tier,
        "tier_display_name": limits["display_name"],
        "is_active": is_subscription_active(org),
        "limits": {
            "max_claims_per_month": limits["max_claims_per_month"],
            "max_users": limits["max_users"],
            "max_documents_per_claim": limits["max_documents_per_claim"],
        },
        "usage": {
            "claims_this_month": claims_this_month,
            "total_claims": org.get("claims_count", 0),
            "users_count": org.get("users_count", 0),
        },
        "features": limits["features"],
    }

    # Add trial info if applicable
    if status == "trial":
        info["trial"] = {
            "days_remaining": get_trial_days_remaining(org),
            "trial_days": org.get("trial_days", TRIAL_DURATION_DAYS),
            "is_expired": is_trial_expired(org),
            "started_at": org.get("trial_started_at") or org.get("created_at"),
        }

    return info


# ============================================================================
# INTERNAL HELPERS
# ============================================================================


def _count_claims_this_month(org_id: str, db) -> int:
    """Count claims created by org in the current calendar month."""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    try:
        claims = db.list_claims(org_id, limit=10000)
        return sum(
            1 for c in claims if c.get("created_at", "") >= month_start
        )
    except Exception:
        return 0
