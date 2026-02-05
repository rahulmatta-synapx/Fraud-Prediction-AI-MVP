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
