"""
Organization Management Router

Includes:
 - Organization CRUD
 - Subscription management
 - Azure Marketplace Landing Page (SaaS Fulfillment)
 - Azure Marketplace Webhook handler (with persistent idempotency)
"""

import logging
from fastapi import APIRouter, HTTPException, Header, Request, status
from pydantic import BaseModel
from typing import Optional
from ..services.azure_ad_auth import (
    validate_azure_ad_token,
    TokenValidationError,
    generate_org_id_from_tenant_id,
)
from ..services.subscription import (
    get_subscription_info,
    get_tier_limits,
    TIER_LIMITS,
    is_subscription_active,
    check_claims_limit,
    check_users_limit,
)
from ..services.marketplace import (
    resolve_subscription,
    activate_subscription as marketplace_activate,
    update_operation_status,
    map_plan_to_tier,
    MarketplaceError,
)
from ..db.cosmos import get_cosmos_db
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


class OrganizationUpdate(BaseModel):
    org_name: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_tier: Optional[str] = None


class ManualProvisionRequest(BaseModel):
    org_id: str
    org_name: str
    azure_tenant_id: str
    subscription_status: str = "trial"
    subscription_tier: str = "free"


def _get_org_from_token(authorization: str):
    """Extract org from Azure AD token (sync)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    try:
        token_claims = validate_azure_ad_token(parts[1])
        db = get_cosmos_db()

        user = db.get_user_by_azure_ad_id(token_claims["oid"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        org = db.get_organization(user["org_id"])
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        return org

    except TokenValidationError as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")


@router.get("/me")
async def get_my_organization(authorization: str = Header(None)):
    """Get current user's organization details."""
    org = _get_org_from_token(authorization)
    return {
        "org_id": org.get("org_id"),
        "org_name": org.get("org_name"),
        "azure_tenant_id": org.get("azure_tenant_id"),
        "subscription_status": org.get("subscription_status"),
        "subscription_tier": org.get("subscription_tier"),
        "claims_count": org.get("claims_count", 0),
        "users_count": org.get("users_count", 0),
        "created_at": org.get("created_at"),
    }


@router.put("/me")
async def update_my_organization(
    update: OrganizationUpdate,
    authorization: str = Header(None),
):
    """Update current user's organization settings."""
    org = _get_org_from_token(authorization)
    db = get_cosmos_db()

    if update.org_name is not None:
        org["org_name"] = update.org_name

    if update.subscription_status is not None:
        allowed = ["active", "trial", "suspended", "cancelled"]
        if update.subscription_status not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {allowed}")
        org["subscription_status"] = update.subscription_status

    if update.subscription_tier is not None:
        allowed = ["free", "enterprise"]
        if update.subscription_tier not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {allowed}")
        org["subscription_tier"] = update.subscription_tier

    db.update_organization_item(org)

    return {"message": "Organization updated successfully", "organization": org}


@router.post("/provision", status_code=status.HTTP_201_CREATED)
async def manual_provision_organization(
    request: ManualProvisionRequest,
    authorization: str = Header(None)
):
    """
    Manually provision an organization (admin use).
    Requires authentication.
    """
    # Verify user is authenticated (admin check can be added here)
    _get_org_from_token(authorization)
    
    db = get_cosmos_db()

    existing = db.get_organization(request.org_id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Organization {request.org_id} already exists")

    now = datetime.utcnow().isoformat()
    org = {
        "id": request.org_id,
        "org_id": request.org_id,
        "org_name": request.org_name,
        "azure_tenant_id": request.azure_tenant_id,
        "subscription_status": request.subscription_status,
        "subscription_tier": request.subscription_tier,
        "claims_count": 0,
        "users_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    db.create_organization(org)

    return {"message": "Organization created successfully", "organization": org}


# ============================================================================
# SUBSCRIPTION ENDPOINTS
# ============================================================================


@router.get("/subscription")
async def get_my_subscription(authorization: str = Header(None)):
    """Get current organization's subscription details, usage, and limits."""
    org = _get_org_from_token(authorization)
    db = get_cosmos_db()
    return get_subscription_info(org, db)


@router.get("/subscription/tiers")
async def get_available_tiers():
    """Get all available subscription tiers and their limits."""
    tiers = []
    for tier_id, limits in TIER_LIMITS.items():
        tiers.append({
            "tier_id": tier_id,
            "display_name": limits["display_name"],
            "max_claims_per_month": limits["max_claims_per_month"],
            "max_users": limits["max_users"],
            "max_documents_per_claim": limits["max_documents_per_claim"],
            "features": limits["features"],
        })
    return {"tiers": tiers}


class UpgradeRequest(BaseModel):
    tier: str


@router.post("/subscription/upgrade")
async def upgrade_subscription(
    request: UpgradeRequest,
    authorization: str = Header(None),
):
    """
    Upgrade organization subscription tier to enterprise.
    In production, this is triggered by Azure Marketplace webhook.
    """
    org = _get_org_from_token(authorization)
    db = get_cosmos_db()

    valid_tiers = ["free", "enterprise"]
    if request.tier not in valid_tiers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Must be one of: {valid_tiers}",
        )

    current_tier = org.get("subscription_tier", "free")

    if request.tier == current_tier:
        raise HTTPException(
            status_code=400,
            detail=f"Already on {current_tier} tier.",
        )

    if request.tier == "free":
        raise HTTPException(
            status_code=400,
            detail="Cannot downgrade to free tier. Contact support.",
        )

    org["subscription_tier"] = request.tier
    org["subscription_status"] = "active"  # Upgrading activates the subscription
    org["upgraded_at"] = datetime.utcnow().isoformat()
    db.update_organization_item(org)

    return {
        "message": f"Successfully upgraded to {TIER_LIMITS[request.tier]['display_name']}",
        "organization": {
            "org_id": org.get("org_id"),
            "subscription_status": org["subscription_status"],
            "subscription_tier": org["subscription_tier"],
        },
        "new_limits": get_tier_limits(request.tier),
    }


@router.post("/subscription/activate")
async def activate_subscription(authorization: str = Header(None)):
    """
    Activate subscription (move from trial to active).
    In production, this would verify payment first.
    """
    org = _get_org_from_token(authorization)
    db = get_cosmos_db()

    if org.get("subscription_status") == "active":
        raise HTTPException(status_code=400, detail="Subscription is already active")

    org["subscription_status"] = "active"
    org["activated_at"] = datetime.utcnow().isoformat()
    db.update_organization_item(org)

    return {
        "message": "Subscription activated successfully",
        "organization": {
            "org_id": org.get("org_id"),
            "subscription_status": "active",
            "subscription_tier": org.get("subscription_tier"),
        },
    }


# ============================================================================
# AZURE MARKETPLACE — LANDING PAGE (SaaS Fulfillment)
# ============================================================================


class MarketplaceLandingRequest(BaseModel):
    """Body sent by the frontend when the buyer lands on /marketplace/landing?token=..."""
    token: str


@router.post("/marketplace/landing")
async def marketplace_landing(body: MarketplaceLandingRequest):
    """
    Azure Marketplace SaaS Landing Page handler.

    Flow:
    1. Customer purchases on Azure Marketplace → redirected to our landing URL with ?token=...
    2. Frontend captures the token and POSTs it here.
    3. We call the Fulfillment Resolve API to get subscription details.
    4. If org for that tenant already exists → upgrade to enterprise / active.
       If org does not exist → create directly as enterprise / active.
    5. We call the Fulfillment Activate API to confirm purchase with Microsoft.
    6. Return org details for the frontend to display.
    """
    db = get_cosmos_db()

    # --- Step 1: Resolve the marketplace token ---
    try:
        resolved = resolve_subscription(body.token)
    except MarketplaceError as e:
        logger.error(f"Marketplace resolve failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    # Extract subscription details
    sub_details = resolved.get("subscription", resolved)
    marketplace_sub_id = (
        sub_details.get("id")
        or resolved.get("id")
        or resolved.get("subscriptionId")
    )
    plan_id = sub_details.get("planId") or resolved.get("planId") or ""
    offer_id = sub_details.get("offerId") or resolved.get("offerId") or ""

    # The beneficiary is the customer tenant who gets access
    beneficiary = sub_details.get("beneficiary", {})
    tenant_id = beneficiary.get("tenantId")
    purchaser = sub_details.get("purchaser", {})

    if not tenant_id:
        # Fall back to purchaser tenantId
        tenant_id = purchaser.get("tenantId")

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Could not determine tenant ID from marketplace subscription",
        )

    tier = map_plan_to_tier(plan_id)

    # --- Step 2: Provision or upgrade organization ---
    org = db.get_organization_by_tenant_id(tenant_id)
    now = datetime.utcnow().isoformat()

    if org:
        # Existing org — upgrade to paid tier
        org["subscription_tier"] = tier or "enterprise"
        org["subscription_status"] = "active"
        org["marketplace_subscription_id"] = marketplace_sub_id
        org["marketplace_plan_id"] = plan_id
        org["marketplace_offer_id"] = offer_id
        org["marketplace_activated_at"] = now
        org["updated_at"] = now
        db.update_organization_item(org)
        logger.info(
            f"Marketplace landing: upgraded existing org {org['org_id']} → {tier}"
        )
    else:
        # New org — create directly as enterprise (NOT free/trial)
        org_id = generate_org_id_from_tenant_id(tenant_id)

        email_hint = purchaser.get("emailId", "")
        if email_hint and "@" in email_hint:
            org_name = email_hint.split("@")[1].split(".")[0].title()
        else:
            org_name = f"Organization {org_id}"

        org = {
            "id": org_id,
            "org_id": org_id,
            "org_name": org_name,
            "azure_tenant_id": tenant_id,
            "subscription_tier": tier or "enterprise",
            "subscription_status": "active",
            "marketplace_subscription_id": marketplace_sub_id,
            "marketplace_plan_id": plan_id,
            "marketplace_offer_id": offer_id,
            "marketplace_activated_at": now,
            "claims_count": 0,
            "users_count": 0,
            "created_at": now,
            "updated_at": now,
        }
        db.create_organization(org)
        logger.info(
            f"Marketplace landing: created new org {org_id} as {tier}"
        )

    # --- Step 3: Activate subscription with Microsoft ---
    try:
        marketplace_activate(marketplace_sub_id, plan_id)
    except MarketplaceError as e:
        # Non-fatal: the subscription is provisioned on our side even if
        # the activate call fails. Log for manual retry.
        logger.error(
            f"Marketplace activate failed for sub {marketplace_sub_id}: {e}. "
            f"Org {org['org_id']} is provisioned — activate must be retried."
        )

    # --- Step 4: Extract subscription details for frontend display ---
    sub_name = sub_details.get("subscriptionName", "")
    sub_status = sub_details.get("saasSubscriptionStatus", "")
    
    # Customer/Purchaser details for enterprise billing verification
    customer_email = beneficiary.get("emailId", "") or purchaser.get("emailId", "")
    customer_name = beneficiary.get("displayName", "") or beneficiary.get("emailId", "")
    purchaser_email = purchaser.get("emailId", "")
    azure_tenant_id = tenant_id

    return {
        "status": "success",
        "message": "Subscription activated successfully",
        "organization": {
            "org_id": org["org_id"],
            "org_name": org.get("org_name"),
            "subscription_tier": org["subscription_tier"],
            "subscription_status": org["subscription_status"],
            "email": customer_email,
        },
        "subscription": {
            "id": marketplace_sub_id,
            "name": sub_name,
            "status": sub_status,
            "offer_id": offer_id,
            "plan_id": plan_id,
            "customer_email": customer_email,
            "customer_name": customer_name,
            "purchaser_email": purchaser_email if purchaser_email != customer_email else "",
            "azure_tenant_id": azure_tenant_id,
        },
    }


# ============================================================================
# AZURE MARKETPLACE WEBHOOK ENDPOINTS
# ============================================================================

class MarketplaceWebhookPayload(BaseModel):
    """Azure Marketplace webhook payload."""
    id: Optional[str] = None
    activityId: Optional[str] = None
    publisherId: Optional[str] = None
    offerId: Optional[str] = None
    planId: Optional[str] = None
    quantity: Optional[int] = None
    subscriptionId: Optional[str] = None
    timeStamp: Optional[str] = None
    action: Optional[str] = None
    status: Optional[str] = None
    operationId: Optional[str] = None


@router.post("/marketplace/webhook")
async def marketplace_webhook(
    payload: MarketplaceWebhookPayload,
    request: Request,
    authorization: str = Header(None)
):
    """
    Azure Marketplace webhook handler with authentication.

    Webhook events:
      - ChangePlan:      Update tier → PATCH operation with Success
      - ChangeQuantity:  Store quantity → PATCH operation with Success
      - Renew:           Acknowledge only
      - Suspend:         Mark org suspended
      - Unsubscribe:     Mark org cancelled
      - Reinstate:       Reactivate org → PATCH operation with Success
    """
    # --- Validate Azure AD token from Microsoft webhook ---
    if not authorization:
        logger.warning("[Marketplace Webhook] No authorization header")
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        # Validate the JWT token from Microsoft
        token_claims = validate_azure_ad_token(parts[1])
        logger.info(f"[Marketplace Webhook] Authenticated: {token_claims.get('appid', 'unknown')}")
    except TokenValidationError as e:
        logger.error(f"[Marketplace Webhook] Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    db = get_cosmos_db()
    action = (payload.action or "").lower()
    subscription_id = payload.subscriptionId
    activity_id = payload.activityId
    operation_id = payload.operationId or payload.id

    logger.info(
        f"[Marketplace Webhook] action={action} sub={subscription_id} "
        f"activity={activity_id} plan={payload.planId}"
    )

    # --- Persistent idempotency check via Cosmos DB ---
    if activity_id:
        try:
            # Check if this activityId has already been processed
            query = "SELECT * FROM c WHERE c.type = 'webhook_activity' AND c.activity_id = @activity_id"
            params = [{"name": "@activity_id", "value": activity_id}]
            existing = list(db.organizations_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True,
            ))
            
            if existing:
                logger.info(
                    f"[Marketplace Webhook] Duplicate activityId={activity_id}, skipping"
                )
                return {"status": "duplicate", "action": action, "activityId": activity_id}
        except Exception as e:
            logger.error(f"[Marketplace Webhook] Idempotency check failed: {e}")

    # --- Find org by marketplace subscription ID ---
    org = None
    if subscription_id:
        try:
            query = "SELECT * FROM c WHERE c.marketplace_subscription_id = @sub_id"
            params = [{"name": "@sub_id", "value": subscription_id}]
            items = list(db.organizations_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True,
            ))
            org = items[0] if items else None
        except Exception as e:
            logger.error(f"[Marketplace Webhook] Error finding org: {e}")

    if not org:
        # Return 200 to acknowledge — Azure requires this
        logger.warning(
            f"[Marketplace Webhook] No org for sub={subscription_id}, acknowledging"
        )
        return {"status": "acknowledged", "action": action, "org_found": False}

    # --- Handle each action ---
    needs_patch = False  # whether we need to PATCH the operation back to MS
    now = datetime.utcnow().isoformat()

    if action == "changeplan":
        new_tier = map_plan_to_tier(payload.planId or "")
        org["subscription_tier"] = new_tier
        org["marketplace_plan_id"] = payload.planId
        if new_tier == "enterprise":
            org["subscription_status"] = "active"
        org["updated_at"] = now
        db.update_organization_item(org)
        needs_patch = True
        logger.info(f"[Webhook] ChangePlan: {org['org_id']} → {new_tier}")

    elif action == "changequantity":
        org["marketplace_quantity"] = payload.quantity
        org["updated_at"] = now
        db.update_organization_item(org)
        needs_patch = True
        logger.info(f"[Webhook] ChangeQuantity: {org['org_id']} → {payload.quantity}")

    elif action == "suspend":
        org["subscription_status"] = "suspended"
        org["suspended_at"] = now
        org["updated_at"] = now
        db.update_organization_item(org)
        logger.info(f"[Webhook] Suspend: {org['org_id']}")

    elif action == "unsubscribe":
        org["subscription_status"] = "cancelled"
        org["cancelled_at"] = now
        org["updated_at"] = now
        db.update_organization_item(org)
        logger.info(f"[Webhook] Unsubscribe: {org['org_id']}")

    elif action == "reinstate":
        org["subscription_status"] = "active"
        org["reinstated_at"] = now
        org["updated_at"] = now
        db.update_organization_item(org)
        needs_patch = True
        logger.info(f"[Webhook] Reinstate: {org['org_id']}")

    elif action == "renew":
        logger.info(f"[Webhook] Renew: {org['org_id']} — acknowledged")

    else:
        logger.warning(f"[Webhook] Unknown action: {action}")

    # --- PATCH operation back to Microsoft (within 10s requirement) ---
    if needs_patch and subscription_id and operation_id:
        try:
            update_operation_status(subscription_id, operation_id, "Success")
        except Exception as e:
            logger.error(
                f"[Webhook] Failed to PATCH operation {operation_id}: {e}"
            )

    # --- Store activityId in Cosmos DB for persistent idempotency ---
    if activity_id:
        try:
            webhook_record = {
                "id": activity_id,
                "type": "webhook_activity",
                "activity_id": activity_id,
                "action": action,
                "subscription_id": subscription_id,
                "org_id": org.get("org_id"),
                "processed_at": datetime.utcnow().isoformat(),
            }
            db.organizations_container.create_item(webhook_record)
            logger.info(f"[Webhook] Stored activityId={activity_id} for idempotency")
        except Exception as e:
            # Non-fatal: if storage fails, at least we processed the webhook
            logger.error(f"[Webhook] Failed to store activityId: {e}")

    return {"status": "acknowledged", "action": action, "org_id": org.get("org_id")}
