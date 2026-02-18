import os
import re
import uuid
from azure.cosmos import CosmosClient, PartitionKey, exceptions
from azure.core.credentials import AzureKeyCredential
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

def parse_cosmos_connection_string(connection_string: str) -> tuple[str, str]:
    """Parse Cosmos DB connection string to extract endpoint and key."""
    connection_string = connection_string.strip().strip('"').strip("'")
    
    endpoint = None
    key = None
    
    endpoint_match = re.search(r'AccountEndpoint=([^;]+)', connection_string, re.IGNORECASE)
    if endpoint_match:
        endpoint = endpoint_match.group(1).strip()
    
    key_match = re.search(r'AccountKey=([^;]+)', connection_string, re.IGNORECASE)
    if key_match:
        key = key_match.group(1).strip()
    
    return endpoint, key

class CosmosDBService:
    """
    Multi-tenant Cosmos DB Service
    All queries now filter by org_id for data isolation
    """
    
    def __init__(self):
        connection_string = os.environ.get("COSMOS_CONNECTION_STRING")
        if not connection_string:
            raise ValueError("COSMOS_CONNECTION_STRING environment variable is required")
        
        connection_string = connection_string.strip().strip('"').strip("'")
        
        try:
            endpoint, key = parse_cosmos_connection_string(connection_string)
            
            if endpoint and key:
                self.client = CosmosClient(endpoint, credential=key)
            else:
                self.client = CosmosClient.from_connection_string(connection_string)
            
            self.database = self.client.get_database_client("fraud-agent")
            
            # Existing containers (will be updated with org_id)
            self.claims_container = self.database.get_container_client("claims")
            self.audit_container = self.database.get_container_client("audit-logs")
            
            # NEW: Multi-tenant containers
            self.organizations_container = self.database.get_container_client("organizations")
            self.users_container = self.database.get_container_client("users")
            
        except ValueError as e:
            raise ValueError(f"Failed to connect to Cosmos DB: {str(e)}. Expected format: 'AccountEndpoint=https://xxx.documents.azure.com:443/;AccountKey=xxx;'")
        except Exception as e:
            raise ValueError(f"Failed to connect to Cosmos DB: {str(e)}")
    
    # ========================================================================
    # ORGANIZATION MANAGEMENT
    # ========================================================================
    
    def create_organization(self, org_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new organization"""
        if not org_data.get("org_id"):
            org_data["org_id"] = f"org_{uuid.uuid4().hex[:12]}"
        org_data["created_at"] = datetime.utcnow().isoformat()
        org_data["updated_at"] = datetime.utcnow().isoformat()
        return self.organizations_container.upsert_item(org_data)
    
    def get_organization(self, org_id: str) -> Optional[Dict[str, Any]]:
        """Get organization by org_id"""
        try:
            query = "SELECT * FROM c WHERE c.org_id = @org_id"
            params = [{"name": "@org_id", "value": org_id}]
            items = list(self.organizations_container.query_items(
                query=query,
                parameters=params,
                partition_key=org_id
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None
    
    def get_organization_by_tenant_id(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get organization by Azure AD tenant ID (cross-partition query)"""
        try:
            query = "SELECT * FROM c WHERE c.azure_tenant_id = @tenant_id"
            params = [{"name": "@tenant_id", "value": tenant_id}]
            items = list(self.organizations_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None

    def update_organization(self, org_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update organization"""
        org = self.get_organization(org_id)
        if not org:
            return None
        org.update(updates)
        org["updated_at"] = datetime.utcnow().isoformat()
        return self.organizations_container.upsert_item(org)

    def update_organization_item(self, org_data: Dict[str, Any]) -> Dict[str, Any]:
        """Upsert a full organization item"""
        org_data["updated_at"] = datetime.utcnow().isoformat()
        return self.organizations_container.upsert_item(org_data)

    def update_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Upsert a full user item"""
        return self.users_container.upsert_item(user_data)
    
    def increment_org_claims_count(self, org_id: str) -> None:
        """Increment claims_count for usage tracking"""
        org = self.get_organization(org_id)
        if org:
            org["claims_count"] = org.get("claims_count", 0) + 1
            org["updated_at"] = datetime.utcnow().isoformat()
            self.organizations_container.upsert_item(org)
    
    def increment_org_users_count(self, org_id: str) -> None:
        """Increment users_count for usage tracking"""
        org = self.get_organization(org_id)
        if org:
            org["users_count"] = org.get("users_count", 0) + 1
            org["updated_at"] = datetime.utcnow().isoformat()
            self.organizations_container.upsert_item(org)
    
    # ========================================================================
    # USER MANAGEMENT
    # ========================================================================
    
    def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new user"""
        if not user_data.get("user_id"):
            user_data["user_id"] = f"user_{uuid.uuid4().hex[:12]}"
        user_data["created_at"] = datetime.utcnow().isoformat()
        return self.users_container.upsert_item(user_data)
    
    def get_user_by_email(self, org_id: str, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email within an organization"""
        try:
            query = "SELECT * FROM c WHERE c.org_id = @org_id AND c.email = @email"
            params = [
                {"name": "@org_id", "value": org_id},
                {"name": "@email", "value": email.lower()}
            ]
            items = list(self.users_container.query_items(
                query=query,
                parameters=params,
                partition_key=org_id
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None
    
    def get_user_by_azure_ad_id(self, azure_ad_object_id: str) -> Optional[Dict[str, Any]]:
        """Get user by Azure AD object ID (cross-partition query)"""
        try:
            query = "SELECT * FROM c WHERE c.azure_ad_object_id = @azure_ad_object_id"
            params = [{"name": "@azure_ad_object_id", "value": azure_ad_object_id}]
            items = list(self.users_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None
    
    def update_user_last_login(self, org_id: str, user_id: str) -> None:
        """Update user's last login timestamp"""
        try:
            query = "SELECT * FROM c WHERE c.org_id = @org_id AND c.user_id = @user_id"
            params = [
                {"name": "@org_id", "value": org_id},
                {"name": "@user_id", "value": user_id}
            ]
            items = list(self.users_container.query_items(
                query=query,
                parameters=params,
                partition_key=org_id
            ))
            if items:
                user = items[0]
                user["last_login"] = datetime.utcnow().isoformat()
                self.users_container.upsert_item(user)
        except Exception:
            pass
    
    def list_org_users(self, org_id: str) -> List[Dict[str, Any]]:
        """List all users in an organization"""
        query = "SELECT * FROM c WHERE c.org_id = @org_id"
        params = [{"name": "@org_id", "value": org_id}]
        items = list(self.users_container.query_items(
            query=query,
            parameters=params,
            partition_key=org_id
        ))
        return items
    
    # ========================================================================
    # CLAIMS MANAGEMENT (Multi-Tenant)
    # ========================================================================
    
    def save_claim(self, claim: Dict[str, Any]) -> Dict[str, Any]:
        """Save/Update claim - org_id required for new claims, optional for legacy updates"""
        claim["updated_at"] = datetime.utcnow().isoformat()
        # Set default org_id if missing (backward compatibility)
        if not claim.get("org_id"):
            claim["org_id"] = "org_default"
        return self.claims_container.upsert_item(claim)
    
    def get_claim(self, org_id: str, claim_id: str) -> Optional[Dict[str, Any]]:
        """Get claim by claim_id within organization. Partition key is /claim_id."""
        try:
            query = "SELECT * FROM c WHERE c.org_id = @org_id AND c.claim_id = @claim_id"
            params = [
                {"name": "@org_id", "value": org_id},
                {"name": "@claim_id", "value": claim_id}
            ]
            items = list(self.claims_container.query_items(
                query=query,
                parameters=params,
                partition_key=claim_id
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None
    
    def get_claim_by_id(self, org_id: str, id: str) -> Optional[Dict[str, Any]]:
        """Get claim by internal ID within organization. Cross-partition since we don't have claim_id."""
        try:
            query = "SELECT * FROM c WHERE c.org_id = @org_id AND c.id = @id"
            params = [
                {"name": "@org_id", "value": org_id},
                {"name": "@id", "value": id}
            ]
            items = list(self.claims_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None
    
    def list_claims(self, org_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """List claims for a specific organization. Cross-partition since partition key is /claim_id."""
        query = "SELECT * FROM c WHERE c.org_id = @org_id ORDER BY c.fraud_score DESC OFFSET 0 LIMIT @limit"
        params = [
            {"name": "@org_id", "value": org_id},
            {"name": "@limit", "value": limit}
        ]
        items = list(self.claims_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        return sorted(items, key=lambda x: x.get("fraud_score", 0) or 0, reverse=True)
    
    def list_claims_last_24h(self, org_id: str) -> List[Dict[str, Any]]:
        """List claims from last 24 hours for a specific organization"""
        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        query = "SELECT * FROM c WHERE c.org_id = @org_id AND c.created_at >= @cutoff ORDER BY c.fraud_score DESC"
        params = [
            {"name": "@org_id", "value": org_id},
            {"name": "@cutoff", "value": cutoff}
        ]
        items = list(self.claims_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        return items
    
    def update_claim(self, org_id: str, claim_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update claim within organization"""
        claim = self.get_claim(org_id, claim_id)
        if not claim:
            return None
        claim.update(updates)
        claim["updated_at"] = datetime.utcnow().isoformat()
        return self.claims_container.upsert_item(claim)
    
    def delete_claim(self, org_id: str, claim_id: str, id: str) -> bool:
        """Delete claim within organization. Partition key is /claim_id."""
        try:
            self.claims_container.delete_item(item=id, partition_key=claim_id)
            return True
        except exceptions.CosmosResourceNotFoundError:
            return False
    
    # ========================================================================
    # AUDIT LOGS (Multi-Tenant)
    # ========================================================================
    
    def save_audit_log(self, audit_log: Dict[str, Any]) -> Dict[str, Any]:
        """Save audit log - org_id set to default if missing"""
        if not audit_log.get("org_id"):
            audit_log["org_id"] = "org_default"
        return self.audit_container.upsert_item(audit_log)
    
    def get_audit_logs(self, org_id: str, claim_id: str) -> List[Dict[str, Any]]:
        """Get audit logs for a claim within organization. Partition key is /claim_id."""
        query = "SELECT * FROM c WHERE c.org_id = @org_id AND c.claim_id = @claim_id ORDER BY c.timestamp DESC"
        params = [
            {"name": "@org_id", "value": org_id},
            {"name": "@claim_id", "value": claim_id}
        ]
        items = list(self.audit_container.query_items(
            query=query,
            parameters=params,
            partition_key=claim_id
        ))
        return items
    
    # ========================================================================
    # STATISTICS (Multi-Tenant)
    # ========================================================================
    
    def get_stats(self, org_id: str) -> Dict[str, Any]:
        """Get statistics for a specific organization"""
        claims = self.list_claims(org_id, 1000)
        now = datetime.utcnow()
        this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        last_24h = (now - timedelta(hours=24)).isoformat()
        
        high_risk = sum(1 for c in claims if c.get("risk_band") == "high")
        medium_risk = sum(1 for c in claims if c.get("risk_band") == "medium")
        low_risk = sum(1 for c in claims if c.get("risk_band") == "low")
        
        needs_review = sum(1 for c in claims if c.get("status") == "needs_review")
        approved = sum(1 for c in claims if c.get("status") == "approved")
        rejected = sum(1 for c in claims if c.get("status") == "rejected")
        
        claims_this_month = sum(1 for c in claims if c.get("created_at", "") >= this_month_start)
        claims_last_24h = sum(1 for c in claims if c.get("created_at", "") >= last_24h)
        
        scored_claims = [c for c in claims if c.get("fraud_score") is not None]
        avg_score = 0.0
        if scored_claims:
            avg_score = sum(c.get("fraud_score", 0) for c in scored_claims) / len(scored_claims)
        
        total_value = sum(c.get("claim_amount_gbp", 0) or 0 for c in claims)
        
        return {
            "total_claims": len(claims),
            "high_risk_claims": high_risk,
            "medium_risk_claims": medium_risk,
            "low_risk_claims": low_risk,
            "pending_review": needs_review,
            "needs_review_count": needs_review,
            "approved_count": approved,
            "rejected_count": rejected,
            "decisions_made": approved + rejected,
            "claims_this_month": claims_this_month,
            "claims_last_24h": claims_last_24h,
            "average_score": round(avg_score, 1),
            "total_value_gbp": total_value
        }
    
    # ========================================================================
    # DATA MIGRATION
    # ========================================================================
    
    def migrate_existing_claims_to_org(self, org_id: str) -> Dict[str, Any]:
        """
        Migration script: Assign all existing claims (without org_id) to an organization
        Run this ONCE after creating your first organization
        """
        try:
            # Find all claims without org_id
            query = "SELECT * FROM c WHERE NOT IS_DEFINED(c.org_id)"
            items = list(self.claims_container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            
            migrated_count = 0
            for claim in items:
                claim["org_id"] = org_id
                claim["updated_at"] = datetime.utcnow().isoformat()
                self.claims_container.upsert_item(claim)
                migrated_count += 1
            
            return {
                "success": True,
                "migrated_claims": migrated_count,
                "org_id": org_id
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def migrate_existing_audit_logs_to_org(self, org_id: str) -> Dict[str, Any]:
        """
        Migration script: Assign all existing audit logs (without org_id) to an organization
        Run this ONCE after creating your first organization
        """
        try:
            # Find all audit logs without org_id
            query = "SELECT * FROM c WHERE NOT IS_DEFINED(c.org_id)"
            items = list(self.audit_container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            
            migrated_count = 0
            for log in items:
                log["org_id"] = org_id
                self.audit_container.upsert_item(log)
                migrated_count += 1
            
            return {
                "success": True,
                "migrated_audit_logs": migrated_count,
                "org_id": org_id
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Singleton instance
cosmos_db: Optional[CosmosDBService] = None

def get_cosmos_db() -> CosmosDBService:
    global cosmos_db
    if cosmos_db is None:
        cosmos_db = CosmosDBService()
    return cosmos_db
