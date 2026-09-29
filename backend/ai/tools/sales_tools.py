from typing import Dict, Any
from ai.services import get_sales_metrics

def get_company_sales_metrics(company_id: int) -> Dict[str, Any]:
    """
    Get key sales metrics for a company. Includes total revenue, pending orders, and conversion rate.
    
    Args:
        company_id (int): The ID of the company to get metrics for.
    """
    # In a real scenario we might fetch the company object, but get_sales_metrics might take company_id
    # Let's assume it requires the company object or we mock it for the sake of the wrapper if needed.
    from company.models import Company
    company = Company.objects.get(id=company_id)
    return get_sales_metrics(company)

# Define the JSON schema for this tool
GET_SALES_METRICS_TOOL = {
    "name": "get_company_sales_metrics",
    "description": "Get key sales metrics for the company.",
    "parameters": {
        "type": "object",
        "properties": {},
        "required": []
    }
}
