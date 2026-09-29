from .sales_tools import GET_SALES_METRICS_TOOL, get_company_sales_metrics
from .export_tools import GENERATE_EXPORT_TOOL, generate_export_file

TOOLS_REGISTRY = {
    "get_company_sales_metrics": get_company_sales_metrics,
    "generate_export": generate_export_file
}

AVAILABLE_TOOLS = [GET_SALES_METRICS_TOOL, GENERATE_EXPORT_TOOL]
