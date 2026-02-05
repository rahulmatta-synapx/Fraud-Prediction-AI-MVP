import os
import json
import base64
from typing import Dict, Any
from openai import OpenAI # Use standard OpenAI class for this preview pattern

def get_openai_client() -> OpenAI:
    """Get OpenAI client using the exact direct resource URL pattern."""
    # This must be your direct resource key
    api_key = os.environ.get("AZURE_OPENAI_KEY")
    
    # We are hardcoding the structure of the URL to match your working example
    # Replace 'test-invoice-analyzer-2-resource' if the resource name is different
    base_url = "https://test-invoice-analyzer-2-resource.openai.azure.com/openai/v1/"
    
    if not api_key:
        raise ValueError("AZURE_OPENAI_KEY not configured in Environment Variables.")
    
    return OpenAI(
        base_url=base_url,
        api_key=api_key
    )

async def extract_fields_from_document(
    file_content: bytes,
    content_type: str,
    filename: str
) -> Dict[str, Any]:
    """Extract fields using the exact 'client.responses.create' approach."""
    import asyncio
    
    try:
        client = get_openai_client()
        base64_string = base64.b64encode(file_content).decode("utf-8")
        mime_type = get_mime_type(content_type, filename)
        
        # Exact data URL structure from your working example
        file_data_url = f"data:{mime_type};base64,{base64_string}"
        
        # Calling the API exactly as in your reference script
        response = client.responses.create(
            model="gpt-4.1",  # Deployment name from your Azure AI Studio
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
        
        # Extracting the output_text attribute directly
        content = response.output_text.strip()
        
        # Clean up markdown if the model returns it
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines)
        
        extracted = json.loads(content.strip())
        
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
        
    except Exception as e:
        print(f"Document extraction error: {str(e)}")
        return {"error": str(e), "extraction_confidence": 0.0}