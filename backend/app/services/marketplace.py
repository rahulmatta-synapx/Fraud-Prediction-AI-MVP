"""
Azure Marketplace SaaS Fulfillment API v2 Client

Handles the full Marketplace lifecycle:
1. Resolve — convert marketplace token into subscription details
2. Activate — confirm purchase with Microsoft
3. Get Subscription — fetch subscription status
4. Update Operation — acknowledge webhook operations

Reference: https://learn.microsoft.com/en-us/azure/marketplace/partner-center-portal/pc-saas-fulfillment-subscription-api
"""

import os
import time
import logging
from typing import Dict, Any, Optional

import requests as http_requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration — set in .env / Azure App Settings
# ---------------------------------------------------------------------------
MARKETPLACE_PUBLISHER_ID = os.getenv("MARKETPLACE_PUBLISHER_ID", "")
MARKETPLACE_OFFER_ID = os.getenv("MARKETPLACE_OFFER_ID", "")

# The Azure AD app registration used to authenticate against
# the SaaS Fulfillment API.  Can be the same client ID as your
# multi-tenant app or a separate one.
MARKETPLACE_CLIENT_ID = os.getenv("MARKETPLACE_CLIENT_ID") or os.getenv("AZURE_AD_CLIENT_ID", "")
MARKETPLACE_CLIENT_SECRET = os.getenv("MARKETPLACE_CLIENT_SECRET", "")
MARKETPLACE_TENANT_ID = os.getenv("MARKETPLACE_TENANT_ID") or os.getenv("AZURE_AD_TENANT_ID", "")

FULFILLMENT_API_VERSION = "2018-08-31"
FULFILLMENT_BASE_URL = "https://marketplaceapi.microsoft.com/api/saas/subscriptions"

# ---------------------------------------------------------------------------
# Token cache for service-to-service calls
# ---------------------------------------------------------------------------
_token_cache: Dict[str, Any] = {
    "access_token": None,
    "expires_at": 0,
}


class MarketplaceError(Exception):
    """Raised when a Marketplace API call fails."""
    pass


def _get_marketplace_token() -> str:
    """
    Get an access token for the SaaS Fulfillment API using client credentials.
    Resource: 20e940b3-4c77-4b0b-9a53-9e16a1b010a7 (Azure Marketplace)
    """
    now = time.time()
    if _token_cache["access_token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    if not MARKETPLACE_CLIENT_SECRET:
        raise MarketplaceError(
            "MARKETPLACE_CLIENT_SECRET not configured. "
            "Cannot authenticate with Azure Marketplace Fulfillment API."
        )

    token_url = f"https://login.microsoftonline.com/{MARKETPLACE_TENANT_ID}/oauth2/token"

    data = {
        "grant_type": "client_credentials",
        "client_id": MARKETPLACE_CLIENT_ID,
        "client_secret": MARKETPLACE_CLIENT_SECRET,
        "resource": "20e940b3-4c77-4b0b-9a53-9e16a1b010a7",  # Marketplace resource
    }

    try:
        resp = http_requests.post(token_url, data=data, timeout=15)
        resp.raise_for_status()
        token_data = resp.json()

        _token_cache["access_token"] = token_data["access_token"]
        _token_cache["expires_at"] = now + int(token_data.get("expires_in", 3600))

        return token_data["access_token"]
    except http_requests.RequestException as e:
        logger.error(f"Failed to get Marketplace token: {e}")
        raise MarketplaceError(f"Failed to authenticate with Marketplace: {e}")


def _marketplace_headers() -> Dict[str, str]:
    token = _get_marketplace_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "x-ms-marketplace-token": "",  # only used in resolve
    }


# ---------------------------------------------------------------------------
# SaaS Fulfillment API v2 Operations
# ---------------------------------------------------------------------------


def resolve_subscription(marketplace_token: str) -> Dict[str, Any]:
    """
    Resolve a marketplace purchase token into subscription details.
    Called from the Landing Page when customer is redirected from Marketplace.

    POST https://marketplaceapi.microsoft.com/api/saas/subscriptions/resolve
    Header: x-ms-marketplace-token = <token from query string>

    Returns: {
        "id": "<subscription GUID>",
        "subscriptionName": "...",
        "offerId": "...",
        "planId": "...",
        "quantity": ...,
        "subscription": {
            "id": "...",
            "publisherId": "...",
            "offerId": "...",
            "planId": "...",
            "quantity": ...,
            "beneficiary": { "tenantId": "...", ... },
            "purchaser": { "tenantId": "...", ... },
            "saasSubscriptionStatus": "PendingFulfillmentStart"
        }
    }
    """
    token = _get_marketplace_token()

    url = f"{FULFILLMENT_BASE_URL}/resolve?api-version={FULFILLMENT_API_VERSION}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "x-ms-marketplace-token": marketplace_token,
    }

    try:
        resp = http_requests.post(url, headers=headers, timeout=30)

        if resp.status_code == 200:
            return resp.json()
        elif resp.status_code == 400:
            raise MarketplaceError("Invalid marketplace token (expired or malformed)")
        elif resp.status_code == 403:
            raise MarketplaceError("Forbidden — check Marketplace API credentials")
        elif resp.status_code == 404:
            raise MarketplaceError("Subscription not found for this token")
        elif resp.status_code == 500:
            raise MarketplaceError("Marketplace API internal error — retry later")
        else:
            raise MarketplaceError(
                f"Unexpected response from Marketplace Resolve API: "
                f"{resp.status_code} {resp.text[:200]}"
            )
    except http_requests.RequestException as e:
        logger.error(f"Marketplace resolve failed: {e}")
        raise MarketplaceError(f"Failed to contact Marketplace API: {e}")


def activate_subscription(subscription_id: str, plan_id: str) -> bool:
    """
    Activate a SaaS subscription after provisioning is complete.
    This tells Microsoft the customer is now set up.

    POST https://marketplaceapi.microsoft.com/api/saas/subscriptions/{id}/activate
    Body: { "planId": "...", "quantity": "" }
    """
    token = _get_marketplace_token()
    url = (
        f"{FULFILLMENT_BASE_URL}/{subscription_id}"
        f"/activate?api-version={FULFILLMENT_API_VERSION}"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {
        "planId": plan_id,
        "quantity": "",
    }

    try:
        resp = http_requests.post(url, json=body, headers=headers, timeout=30)
        if resp.status_code in (200, 202):
            logger.info(f"Marketplace subscription {subscription_id} activated")
            return True
        else:
            logger.error(
                f"Marketplace activate failed: {resp.status_code} {resp.text[:200]}"
            )
            raise MarketplaceError(
                f"Failed to activate subscription: {resp.status_code}"
            )
    except http_requests.RequestException as e:
        logger.error(f"Marketplace activate request failed: {e}")
        raise MarketplaceError(f"Failed to contact Marketplace API: {e}")


def get_subscription(subscription_id: str) -> Dict[str, Any]:
    """
    Get current status of a Marketplace subscription.
    """
    token = _get_marketplace_token()
    url = (
        f"{FULFILLMENT_BASE_URL}/{subscription_id}"
        f"?api-version={FULFILLMENT_API_VERSION}"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        resp = http_requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except http_requests.RequestException as e:
        logger.error(f"Marketplace get subscription failed: {e}")
        raise MarketplaceError(f"Failed to fetch subscription: {e}")


def update_operation_status(
    subscription_id: str,
    operation_id: str,
    status: str = "Success",
) -> bool:
    """
    Report the result of an async webhook operation back to Microsoft.
    PATCH /saas/subscriptions/{id}/operations/{operationId}
    Body: { "status": "Success" | "Failure" }

    Must be called within 10 seconds of the webhook for
    ChangePlan / ChangeQuantity / Reinstate.
    """
    token = _get_marketplace_token()
    url = (
        f"{FULFILLMENT_BASE_URL}/{subscription_id}"
        f"/operations/{operation_id}"
        f"?api-version={FULFILLMENT_API_VERSION}"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {"status": status}

    try:
        resp = http_requests.patch(url, json=body, headers=headers, timeout=15)
        if resp.status_code in (200, 202):
            logger.info(
                f"Operation {operation_id} for sub {subscription_id} → {status}"
            )
            return True
        else:
            logger.error(
                f"Update operation failed: {resp.status_code} {resp.text[:200]}"
            )
            return False
    except http_requests.RequestException as e:
        logger.error(f"Update operation request failed: {e}")
        return False


def map_plan_to_tier(plan_id: str) -> str:
    """Map a Marketplace planId to our internal tier name."""
    if not plan_id:
        return "free"
    lower = plan_id.lower()
    if "enterprise" in lower or "premium" in lower or "pro" in lower:
        return "enterprise"
    return "free"
