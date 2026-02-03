import os
from azure.cosmos import CosmosClient, PartitionKey, exceptions
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

class CosmosDBService:
    def __init__(self):
        connection_string = os.environ.get("COSMOS_CONNECTION_STRING")
        if not connection_string:
            raise ValueError("COSMOS_CONNECTION_STRING environment variable is required")
        
        self.client = CosmosClient.from_connection_string(connection_string)
        self.database = self.client.get_database_client("fraud-agent")
        self.claims_container = self.database.get_container_client("claims")
        self.audit_container = self.database.get_container_client("audit-logs")
    
    def save_claim(self, claim: Dict[str, Any]) -> Dict[str, Any]:
        claim["updated_at"] = datetime.utcnow().isoformat()
        return self.claims_container.upsert_item(claim)
    
    def get_claim(self, claim_id: str) -> Optional[Dict[str, Any]]:
        try:
            query = "SELECT * FROM c WHERE c.claim_id = @claim_id"
            params = [{"name": "@claim_id", "value": claim_id}]
            items = list(self.claims_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None
    
    def get_claim_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        try:
            query = "SELECT * FROM c WHERE c.id = @id"
            params = [{"name": "@id", "value": id}]
            items = list(self.claims_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            return items[0] if items else None
        except exceptions.CosmosResourceNotFoundError:
            return None
    
    def list_claims(self, limit: int = 100) -> List[Dict[str, Any]]:
        query = "SELECT * FROM c ORDER BY c.fraud_score DESC OFFSET 0 LIMIT @limit"
        params = [{"name": "@limit", "value": limit}]
        items = list(self.claims_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        return sorted(items, key=lambda x: x.get("fraud_score", 0) or 0, reverse=True)
    
    def list_claims_last_24h(self) -> List[Dict[str, Any]]:
        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        query = "SELECT * FROM c WHERE c.created_at >= @cutoff ORDER BY c.fraud_score DESC"
        params = [{"name": "@cutoff", "value": cutoff}]
        items = list(self.claims_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        return items
    
    def update_claim(self, claim_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        claim = self.get_claim(claim_id)
        if not claim:
            return None
        claim.update(updates)
        claim["updated_at"] = datetime.utcnow().isoformat()
        return self.claims_container.upsert_item(claim)
    
    def delete_claim(self, claim_id: str, id: str) -> bool:
        try:
            self.claims_container.delete_item(item=id, partition_key=claim_id)
            return True
        except exceptions.CosmosResourceNotFoundError:
            return False
    
    def save_audit_log(self, audit_log: Dict[str, Any]) -> Dict[str, Any]:
        return self.audit_container.upsert_item(audit_log)
    
    def get_audit_logs(self, claim_id: str) -> List[Dict[str, Any]]:
        query = "SELECT * FROM c WHERE c.claim_id = @claim_id ORDER BY c.timestamp DESC"
        params = [{"name": "@claim_id", "value": claim_id}]
        items = list(self.audit_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        return items
    
    def get_stats(self) -> Dict[str, int]:
        claims = self.list_claims(1000)
        today = datetime.utcnow().date().isoformat()
        
        high_risk = sum(1 for c in claims if c.get("risk_band") == "high")
        medium_risk = sum(1 for c in claims if c.get("risk_band") == "medium")
        low_risk = sum(1 for c in claims if c.get("risk_band") == "low")
        pending = sum(1 for c in claims if c.get("status") in ["pending", "under_review"])
        
        all_audits = []
        for claim in claims:
            audits = self.get_audit_logs(claim.get("claim_id", ""))
            all_audits.extend(audits)
        
        overrides_today = sum(
            1 for a in all_audits 
            if a.get("action_type") == "OVERRIDE" and 
            a.get("timestamp", "").startswith(today)
        )
        
        return {
            "total_claims": len(claims),
            "high_risk_claims": high_risk,
            "medium_risk_claims": medium_risk,
            "low_risk_claims": low_risk,
            "pending_review": pending,
            "overrides_today": overrides_today
        }

cosmos_db: Optional[CosmosDBService] = None

def get_cosmos_db() -> CosmosDBService:
    global cosmos_db
    if cosmos_db is None:
        cosmos_db = CosmosDBService()
    return cosmos_db
