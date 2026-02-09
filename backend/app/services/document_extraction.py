import os
import json
import base64
from typing import Dict, Any
from openai import OpenAI

def get_openai_client() -> OpenAI:
    """Get OpenAI client configured for the direct Azure OpenAI resource."""
    # This should be the .openai.azure.com endpoint
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT") 
    api_key = os.environ.get("AZURE_OPENAI_KEY")
    
    if not endpoint or not api_key:
        raise ValueError("Azure OpenAI credentials not configured.")
    
    # Strip quotes and trailing slashes
    endpoint = endpoint.strip().strip('"').strip("'").rstrip("/")
    
    # Construct the base_url exactly as in your working example
    return OpenAI(
        base_url=f"{endpoint}/openai/v1/",
        api_key=api_key
    )

EXTRACTION_PROMPT = '''Extract all the following fields from this UK motor insurance claim document accurately. Return only JSON with these exact keys:
- claimant_name: Full name of the claimant/policyholder (string or null)
- policy_id: Policy number/ID (string or null)
- policy_start_date: Date when policy started in YYYY-MM-DD format (string or null)
- policyholder_address: Full address of the policyholder (string or null)
- num_previous_claims: Number of previous claims (integer, default 0)
- total_previous_claims_gbp: Total amount of previous claims in GBP (float, default 0.0)
- vehicle_make: Vehicle manufacturer e.g. BMW, Ford, Toyota (string or null)
- vehicle_model: Vehicle model e.g. 3 Series, Focus, Corolla (string or null)
- vehicle_year: Year of manufacture (integer)
- vehicle_registration: UK vehicle registration number (string or null)
- vehicle_estimated_value_gbp: Estimated vehicle value in GBP (float)
- accident_date: Date of accident in YYYY-MM-DD format (string or null)
- accident_type: One of: Collision, Rear-End, Side Impact, Rollover, Hit and Run, Parking Damage, Theft, Vandalism, Fire, Flood Damage (string or null)
- accident_location: Location where accident occurred (string or null)
- claim_amount_gbp: Claimed amount in GBP (float)
- accident_description: Description of the accident/incident (string or null)
- witness_name: Name of any witness to the incident (string or null)
- witness_contact: Contact information (email/phone) for witness (string or null)
- third_party_name: Name of third party involved in incident (string or null)
- third_party_contact: Contact information for third party (string or null)
- third_party_vehicle_reg: Vehicle registration of third party vehicle (string or null)
- third_party_insurance: Insurance company name for third party (string or null)
- repair_invoice_date: Date on any repair invoice in YYYY-MM-DD format (string or null)
- estimate_date: Date on any repair estimate in YYYY-MM-DD format (string or null)
- invoice_date: Date on any invoice in YYYY-MM-DD format (string or null)
- quote_date: Date on any quote in YYYY-MM-DD format (string or null)
- document_date: Any other relevant document date in YYYY-MM-DD format (string or null)
- extraction_confidence: Your confidence in the extraction from 0.0 to 1.0 (float)
- extraction_notes: Any notes about what could or couldn't be extracted (string)

Return ONLY valid JSON, no other text or markdown.'''

def get_mime_type(content_type: str, filename: str) -> str:
    """Determine the correct MIME type for the file."""
    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        return "application/pdf"
    elif content_type.startswith("image/jpeg") or filename.lower().endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    elif content_type.startswith("image/png") or filename.lower().endswith(".png"):
        return "image/png"
    elif content_type.startswith("image/"):
        return content_type
    else:
        return "application/pdf"

async def extract_fields_from_document(
    file_content: bytes,
    content_type: str,
    filename: str
) -> Dict[str, Any]:
    """Extract claim fields from uploaded document using Azure OpenAI Responses API."""
    import asyncio
    
    try:
        client = get_openai_client()
        
        base64_string = base64.b64encode(file_content).decode("utf-8")
        
        mime_type = get_mime_type(content_type, filename)
        
        file_data_url = f"data:{mime_type};base64,{base64_string}"
        
        max_retries = 3
        retry_delay = 2
        last_error = None
        response = None
        
        for attempt in range(max_retries):
            try:
                response = client.responses.create(
                    model="gpt-4.1",
                    input=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_file",
                                    "filename": filename or "uploaded_claim.pdf",
                                    "file_data": file_data_url,
                                },
                                {
                                    "type": "input_text",
                                    "text": EXTRACTION_PROMPT,
                                },
                            ],
                        },
                    ]
                )
                break
            except Exception as e:
                error_str = str(e)
                last_error = e
                print(f"Extraction attempt {attempt + 1}/{max_retries} failed: {error_str}")
                
                if "DeploymentNotFound" in error_str or "404" in error_str:
                    if attempt < max_retries - 1:
                        print(f"Retrying in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    else:
                        return {
                            "error": f"OpenAI deployment 'gpt-4.1' not found after {max_retries} retries. Check Azure portal.",
                            "extraction_confidence": 0.0
                        }
                elif "400" in error_str or "BadRequest" in error_str:
                    return {
                        "error": f"Invalid request to OpenAI: {error_str}",
                        "extraction_confidence": 0.0
                    }
                else:
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    raise e
        
        if response is None:
            return {"error": str(last_error) if last_error else "Unknown error", "extraction_confidence": 0.0}
        
        content = response.output_text.strip()
        
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines)
        content = content.strip()
        
        extracted = json.loads(content)
        
        return {
            "claimant_name": extracted.get("claimant_name"),
            "policy_id": extracted.get("policy_id"),
            "policy_start_date": extracted.get("policy_start_date"),
            "policyholder_address": extracted.get("policyholder_address"),
            "num_previous_claims": int(extracted.get("num_previous_claims", 0) or 0),
            "total_previous_claims_gbp": float(extracted.get("total_previous_claims_gbp", 0) or 0),
            "vehicle_make": extracted.get("vehicle_make"),
            "vehicle_model": extracted.get("vehicle_model"),
            "vehicle_year": int(extracted.get("vehicle_year", 2024) or 2024),
            "vehicle_registration": extracted.get("vehicle_registration"),
            "vehicle_estimated_value_gbp": float(extracted.get("vehicle_estimated_value_gbp", 0) or 0),
            "accident_date": extracted.get("accident_date"),
            "accident_type": extracted.get("accident_type"),
            "accident_location": extracted.get("accident_location"),
            "claim_amount_gbp": float(extracted.get("claim_amount_gbp", 0) or 0),
            "accident_description": extracted.get("accident_description"),
            "witness_name": extracted.get("witness_name"),
            "witness_contact": extracted.get("witness_contact"),
            "third_party_name": extracted.get("third_party_name"),
            "third_party_contact": extracted.get("third_party_contact"),
            "third_party_vehicle_reg": extracted.get("third_party_vehicle_reg"),
            "third_party_insurance": extracted.get("third_party_insurance"),
            "repair_invoice_date": extracted.get("repair_invoice_date"),
            "estimate_date": extracted.get("estimate_date"),
            "invoice_date": extracted.get("invoice_date"),
            "quote_date": extracted.get("quote_date"),
            "document_date": extracted.get("document_date"),
            "extraction_confidence": float(extracted.get("extraction_confidence", 0.5) or 0.5),
            "extraction_notes": extracted.get("extraction_notes", "")
        }
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {"error": "Failed to parse extraction results from AI response", "extraction_confidence": 0.0}
    except Exception as e:
        error_str = str(e)
        print(f"Document extraction error: {error_str}")
        return {"error": error_str, "extraction_confidence": 0.0}
