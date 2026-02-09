from typing import List, Dict, Any, Callable
from datetime import datetime
import uuid
import re

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


def late_notification(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF (Claim_Submission_Date - Incident_Date) > 14 days → Late_Notification (+20)"""
    try:
        accident_date_str = claim.get("accident_date")
        created_at_str = claim.get("created_at")
        
        if not accident_date_str or not created_at_str:
            return False
        
        # Handle both ISO format and simple date format, including future dates
        try:
            if "T" in str(accident_date_str):
                accident_date = datetime.fromisoformat(str(accident_date_str).replace("Z", "+00:00"))
            else:
                # Try multiple date formats
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
                    try:
                        accident_date = datetime.strptime(str(accident_date_str), fmt)
                        break
                    except ValueError:
                        continue
                else:
                    return False
        except Exception:
            return False
            
        try:
            created_at = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00"))
        except Exception:
            return False
        
        # Remove timezone info for comparison
        days_diff = (created_at.replace(tzinfo=None) - accident_date.replace(tzinfo=None)).days
        return days_diff > 14
    except Exception as e:
        return False


def suspicious_timing(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Claim_Submitted BETWEEN 11pm AND 5am → Suspicious_Timing (+10)"""
    try:
        created_at_str = claim.get("created_at")
        if not created_at_str:
            return False
            
        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        hour = created_at.hour
        return hour >= 23 or hour < 5
    except Exception:
        return False


def early_policy_claim(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Policy_Start_Date <= Incident_Date <= Policy_Start_Date + 7 days → Early_Policy_Claim (+30)"""
    try:
        # Check if policy is new (num_previous_claims is 0)
        if claim.get("num_previous_claims", 0) > 0:
            return False
            
        policy_start_str = claim.get("policy_start_date")
        accident_date_str = claim.get("accident_date")
        
        # If we have policy_start_date, use it for accurate detection
        if policy_start_str and accident_date_str:
            try:
                # Parse policy start date
                if "T" in str(policy_start_str):
                    policy_start = datetime.fromisoformat(str(policy_start_str).replace("Z", "+00:00"))
                else:
                    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
                        try:
                            policy_start = datetime.strptime(str(policy_start_str), fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        return False
                
                # Parse accident date
                if "T" in str(accident_date_str):
                    accident_date = datetime.fromisoformat(str(accident_date_str).replace("Z", "+00:00"))
                else:
                    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
                        try:
                            accident_date = datetime.strptime(str(accident_date_str), fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        return False
                
                days_since_policy_start = (accident_date.replace(tzinfo=None) - policy_start.replace(tzinfo=None)).days
                # Incident must be within 7 days of policy start and after or on policy start
                return 0 <= days_since_policy_start <= 7
            except Exception:
                pass
        
        # Fallback: if no policy_start_date, check if new policy and accident happened recently
        if accident_date_str:
            created_at_str = claim.get("created_at")
            if not created_at_str:
                return False
            
            try:
                if "T" in str(accident_date_str):
                    accident_date = datetime.fromisoformat(str(accident_date_str).replace("Z", "+00:00"))
                else:
                    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
                        try:
                            accident_date = datetime.strptime(str(accident_date_str), fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        return False
                    
                created_at = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00"))
                
                days_since_accident = (created_at.replace(tzinfo=None) - accident_date.replace(tzinfo=None)).days
                return days_since_accident <= 7
            except Exception:
                return False
            
        return False
    except Exception:
        return False


def frequent_claimant(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Number of previous claims > 2 in last 12 months → Frequent_Claimant (+25)"""
    return claim.get("num_previous_claims", 0) > 2


def vague_location(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Incident_Location is NULL OR vague ("near home", "local road") → Vague_Location (+15)"""
    location = claim.get("accident_location", "")
    
    if not location or location.strip() == "":
        return True
    
    vague_patterns = [
        r"near\s+home",
        r"local\s+road",
        r"near\s+my\s+house",
        r"around\s+the\s+corner",
        r"nearby",
        r"somewhere",
        r"not\s+sure",
        r"unknown",
        r"n/a",
    ]
    
    location_lower = location.lower()
    for pattern in vague_patterns:
        if re.search(pattern, location_lower):
            return True
    
    if len(location.strip()) < 10:
        return True
        
    return False


def unusual_location(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Accident_Location != Policyholder_Address AND Distance > 100 miles → Unusual_Location (+20)
    Heuristic: Check if description mentions unusual location indicators
    """
    description = claim.get("accident_description", "").lower()
    location = claim.get("accident_location", "").lower()
    
    unusual_indicators = [
        "motorway", "highway", "far from home", "100 miles", "200 miles",
        "other city", "another city", "abroad", "overseas", "scotland",
        "wales", "ireland", "holiday", "vacation", "trip"
    ]
    
    combined_text = f"{description} {location}"
    for indicator in unusual_indicators:
        if indicator in combined_text:
            return True
    
    return False


def description_mismatch(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Damage_Description contradicts Accident_Type → Description_Mismatch (+30)"""
    accident_type = claim.get("accident_type", "").lower()
    description = claim.get("accident_description", "").lower()
    
    if not accident_type or not description:
        return False
    
    print(f"\n[Description Mismatch Check]")
    print(f"  Type: '{accident_type}'")
    print(f"  Desc: '{description[:150]}...'")
    
    # Comprehensive contradictions with expanded patterns
    contradictions = {
        "rear-end": [
            "head-on", "head on", "frontal", "front damage", "front-end", "front end",
            "bonnet", "grille", "headlight", "radiator", "bumper front",
            "hit from front", "from the front", "opposite direction", "coming towards",
            "front bumper", "front panel", "hood", "fender front"
        ],
        "rear end": [
            "head-on", "head on", "frontal", "front damage", "front-end", "front end",
            "bonnet", "grille", "headlight", "radiator", "bumper front",
            "hit from front", "from the front", "opposite direction", "coming towards",
            "front bumper", "front panel", "hood", "fender front"
        ],
        "collision": [],  # Too generic to contradict
        "side impact": [
            "rear damage", "rear-end", "rear end", "from behind", "back bumper",
            "frontal", "head-on", "front bumper", "hit from front",
            "boot", "trunk", "rear panel"
        ],
        "rollover": [
            "minor damage", "scratches only", "small dent", "no structural damage",
            "rear-end", "side impact", "head-on"
        ],
        "hit and run": [
            "collision", "impact", "crash", "frontal", "side impact", "rear-end",
            "other driver", "their vehicle", "they hit", "he hit", "she hit"
        ],
        "parking damage": [
            "high speed", "motorway", "highway", "fast", "60 mph", "70 mph",
            "speeding", "racing", "collision at speed"
        ],
        "theft": [
            "collision", "crash", "impact", "hit", "bumper", "damage from accident",
            "dent", "scratched in crash"
        ],
        "vandalism": [
            "collision", "crash", "accident", "hit another", "impact with",
            "driving", "while moving"
        ],
        "fire": [
            "collision", "crash", "hit", "impact", "water damage", "flood", "wet",
            "soaked"
        ],
        "flood damage": [
            "fire", "burnt", "burned", "smoke damage", "flames", "ignited",
            "collision", "crash"
        ],
    }
    
    # Check all possible variations of the accident type
    found_contradiction = False
    matched_pattern = None
    
    for key in contradictions.keys():
        if key in accident_type or accident_type in key:
            contradiction_list = contradictions[key]
            print(f"  Checking {len(contradiction_list)} contradictions for type '{key}'")
            
            for contradiction in contradiction_list:
                # Check if contradiction phrase appears in description
                if contradiction in description:
                    found_contradiction = True
                    matched_pattern = contradiction
                    print(f"  ✓ CONTRADICTION FOUND: '{contradiction}' in description")
                    break
            
            if found_contradiction:
                break
    
    if not found_contradiction:
        print(f"  ✗ No contradictions found")
    
    return found_contradiction


def invalid_document_timeline(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Repair_Invoice_Date < Incident_Date → Invalid_Document_Timeline (+25)
    Check AI signals for timeline inconsistencies
    """
    for signal in signals:
        signal_type = signal.get("signal_type", "").lower()
        description = signal.get("description", "").lower()
        
        if "timeline" in signal_type or "date" in signal_type:
            if "before" in description or "prior" in description or "inconsistent" in description:
                return True
    
    return False


def repeat_third_party(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Same Third_Party appears in >2 claims across different policies → Repeat_Third_Party (+40)
    Checks both structured third_party_name field and AI signals for patterns
    """
    # Check AI signals for third party patterns
    for signal in signals:
        signal_type = signal.get("signal_type", "").lower()
        description = signal.get("description", "").lower()
        
        if "third party" in signal_type or "third-party" in signal_type:
            if "repeat" in description or "multiple" in description or "same" in description:
                return True
        
        if "pattern" in signal_type:
            if "third party" in description or "third-party" in description:
                return True
    
    # Note: Cross-claim matching for third_party_name would require database access
    # This is a placeholder for when historical claim lookup is implemented
    third_party = claim.get("third_party_name", "")
    if third_party and len(third_party.strip()) > 0:
        # Future: Query database for claims with same third_party_name
        # For now, rely on AI signals
        pass
    
    return False


def professional_witness(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> bool:
    """IF Witness_Name matches previous claims → Professional_Witness (+35)
    Checks both structured witness_name field and AI signals for patterns
    """
    # Check AI signals for witness patterns
    for signal in signals:
        signal_type = signal.get("signal_type", "").lower()
        description = signal.get("description", "").lower()
        
        if "witness" in signal_type:
            if "repeat" in description or "professional" in description or "same" in description or "multiple" in description:
                return True
    
    # Note: Cross-claim matching for witness_name would require database access
    # This is a placeholder for when historical claim lookup is implemented
    witness = claim.get("witness_name", "")
    if witness and len(witness.strip()) > 0:
        # Future: Query database for claims with same witness_name
        # For now, rely on AI signals
        pass
    
    return False


RULES = [
    Rule(
        "late_notification", 
        "Late Notification",
        "Claim submitted more than 14 days after incident",
        20,
        late_notification
    ),
    Rule(
        "early_policy_claim",
        "Early Policy Claim",
        "Claim filed on a new policy within 7 days of policy start",
        30,
        early_policy_claim
    ),
    Rule(
        "frequent_claimant",
        "Frequent Claimant",
        "More than 2 previous claims in last 12 months",
        25,
        frequent_claimant
    ),
    Rule(
        "vague_location",
        "Vague Location",
        "Incident location is missing or vague (e.g., 'near home', 'local road')",
        15,
        vague_location
    ),
    Rule(
        "unusual_location",
        "Unusual Location",
        "Accident location appears far from policyholder's usual area (>100 miles)",
        20,
        unusual_location
    ),
    Rule(
        "description_mismatch",
        "Description Mismatch",
        "Damage description contradicts the stated accident type",
        30,
        description_mismatch
    ),
    Rule(
        "invalid_document_timeline",
        "Invalid Document Timeline",
        "Document dates (e.g., repair invoice) appear before incident date",
        25,
        invalid_document_timeline
    ),
    Rule(
        "repeat_third_party",
        "Repeat Third Party",
        "Same third party appears in multiple claims across different policies",
        40,
        repeat_third_party
    ),
    Rule(
        "professional_witness",
        "Professional Witness",
        "Witness name matches witnesses from previous claims",
        35,
        professional_witness
    ),
]


def calculate_risk_band(score: int) -> str:
    """Calculate risk band based on score.
    < 30 → Low Risk (Auto-approve)
    30-60 → Medium Risk (Manual review)
    > 60 → High Risk (SIU referral)
    """
    if score > 60:
        return "high"
    elif score >= 30:
        return "medium"
    else:
        return "low"


def get_risk_action(risk_band: str) -> str:
    """Get recommended action based on risk band."""
    actions = {
        "low": "Auto-approve",
        "medium": "Manual review",
        "high": "SIU referral"
    }
    return actions.get(risk_band, "Manual review")


def run_rules_engine(claim: Dict[str, Any], signals: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Run all rules against the claim and calculate fraud score."""
    triggered_rules = []
    total_weight = 0
    
    for rule in RULES:
        try:
            is_triggered = rule.condition(claim, signals)
            if is_triggered:
                triggered_rules.append({
                    "id": str(uuid.uuid4()),
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "description": rule.description,
                    "weight": rule.weight,
                    "triggered_at": datetime.utcnow().isoformat()
                })
                total_weight += rule.weight
                print(f"  ✓ Rule '{rule.name}' triggered (+{rule.weight})")
            else:
                print(f"  ✗ Rule '{rule.name}' not triggered")
        except Exception as e:
            print(f"  ❌ Error evaluating rule {rule.id}: {e}")
            continue
    
    fraud_score = min(100, total_weight)
    risk_band = calculate_risk_band(fraud_score)
    recommended_action = get_risk_action(risk_band)
    
    return {
        "fraud_score": fraud_score,
        "risk_band": risk_band,
        "recommended_action": recommended_action,
        "triggered_rules": triggered_rules,
        "total_weight": total_weight
    }


def get_all_rules_info() -> List[Dict[str, Any]]:
    """Get information about all rules for display in Help page."""
    return [
        {
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "weight": rule.weight,
            "category": get_rule_category(rule.id)
        }
        for rule in RULES
    ]


def get_rule_category(rule_id: str) -> str:
    """Get the category for a rule."""
    categories = {
        "late_notification": "Claim Timing",
        "early_policy_claim": "Policyholder Behaviour",
        "frequent_claimant": "Policyholder Behaviour",
        "vague_location": "Location & Circumstance",
        "unusual_location": "Location & Circumstance",
        "description_mismatch": "Document Consistency",
        "invalid_document_timeline": "Document Consistency",
        "repeat_third_party": "Third-Party Patterns",
        "professional_witness": "Third-Party Patterns",
    }
    return categories.get(rule_id, "General")
