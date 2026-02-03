from typing import List, Dict, Any, Callable
from datetime import datetime
import uuid

class Rule:
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        weight: int,
        condition: Callable[[Dict[str, Any], List[Dict[str, Any]]], bool]
    ):
        self.id = id
        self.name = name
        self.description = description
        self.weight = weight
        self.condition = condition

def high_claim_ratio(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    claim_amount = claim.get("claim_amount_gbp", 0)
    vehicle_value = claim.get("vehicle_estimated_value_gbp", 1)
    ratio = claim_amount / vehicle_value if vehicle_value > 0 else 0
    return ratio > 0.4

def claim_exceeds_value(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    claim_amount = claim.get("claim_amount_gbp", 0)
    vehicle_value = claim.get("vehicle_estimated_value_gbp", 1)
    return claim_amount > vehicle_value

def multiple_previous_claims(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    return claim.get("num_previous_claims", 0) >= 3

def high_historical_amount(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    return claim.get("total_previous_claims_gbp", 0) > 15000

def new_policy_pattern(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    return claim.get("num_previous_claims", 0) == 0 and claim.get("claim_amount_gbp", 0) > 10000

def old_vehicle_high_claim(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    current_year = datetime.now().year
    vehicle_age = current_year - claim.get("vehicle_year", current_year)
    claim_amount = claim.get("claim_amount_gbp", 0)
    vehicle_value = claim.get("vehicle_estimated_value_gbp", 1)
    return vehicle_age > 8 and claim_amount > vehicle_value * 0.6

def theft_claim(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    return claim.get("accident_type") == "Theft"

def fire_damage(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    return claim.get("accident_type") == "Fire"

def ai_high_confidence_signals(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    return any(s.get("confidence", 0) > 0.8 for s in signals)

def multiple_ai_observations(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    return len(signals) >= 3

RULES = [
    Rule("high_claim_ratio", "High Claim-to-Value Ratio", 
         "Claim amount exceeds 40% of vehicle value", 15, high_claim_ratio),
    Rule("claim_exceeds_value", "Claim Exceeds Vehicle Value",
         "Claim amount is greater than the estimated vehicle value", 25, claim_exceeds_value),
    Rule("multiple_claims", "Multiple Previous Claims",
         "Claimant has 3 or more previous claims", 10, multiple_previous_claims),
    Rule("high_historical", "High Historical Claim Amount",
         "Total previous claims exceed £15,000", 12, high_historical_amount),
    Rule("new_policy_high_claim", "New Policy Pattern",
         "First claim on policy with amount over £10,000", 8, new_policy_pattern),
    Rule("old_vehicle", "Old Vehicle High Claim",
         "Vehicle over 8 years old with claim exceeding 60% of value", 10, old_vehicle_high_claim),
    Rule("theft", "Theft Claim Type",
         "Claim type is theft", 8, theft_claim),
    Rule("fire", "Fire Damage Claim",
         "Claim involves fire damage", 10, fire_damage),
    Rule("ai_high_confidence", "AI High-Confidence Signal",
         "AI detected pattern with confidence above 80%", 15, ai_high_confidence_signals),
    Rule("multiple_ai", "Multiple AI Observations",
         "AI detected 3 or more patterns", 12, multiple_ai_observations),
]

def calculate_risk_band(score: int) -> str:
    if score > 70:
        return "high"
    elif score >= 30:
        return "medium"
    else:
        return "low"

def run_rules_engine(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> Dict[str, Any]:
    triggered_rules = []
    total_weight = 0
    max_possible_weight = sum(r.weight for r in RULES)
    
    for rule in RULES:
        try:
            if rule.condition(claim, signals):
                triggered_rules.append({
                    "id": str(uuid.uuid4()),
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "description": rule.description,
                    "weight": rule.weight,
                    "triggered_at": datetime.utcnow().isoformat()
                })
                total_weight += rule.weight
        except Exception:
            continue
    
    raw_score = (total_weight / max_possible_weight) * 100 if max_possible_weight > 0 else 0
    fraud_score = min(100, max(0, int(raw_score)))
    risk_band = calculate_risk_band(fraud_score)
    
    return {
        "fraud_score": fraud_score,
        "risk_band": risk_band,
        "triggered_rules": triggered_rules,
        "total_weight": total_weight,
        "max_weight": max_possible_weight
    }
