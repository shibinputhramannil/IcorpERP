import os
import csv
from typing import Dict, Any, List
from django.conf import settings
from django.core.files.storage import default_storage

try:
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None

try:
    import openpyxl
except ImportError:
    openpyxl = None

def generate_export_file(company_id: int, format_type: str, data: List[Dict[str, Any]]) -> str:
    """
    Export data to a file (pdf, xlsx, csv).
    """
    file_name = f"export_{company_id}.{format_type}"
    # Use media directory
    media_path = os.path.join(settings.MEDIA_ROOT, "exports", file_name)
    os.makedirs(os.path.dirname(media_path), exist_ok=True)
    
    if format_type == "csv":
        with open(media_path, "w", newline="", encoding="utf-8") as f:
            if data:
                writer = csv.DictWriter(f, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
    elif format_type == "xlsx" and openpyxl:
        wb = openpyxl.Workbook()
        ws = wb.active
        if data:
            headers = list(data[0].keys())
            ws.append(headers)
            for row in data:
                ws.append([row.get(h) for h in headers])
        wb.save(media_path)
    elif format_type == "pdf" and canvas:
        c = canvas.Canvas(media_path)
        c.drawString(100, 800, f"Export for Company {company_id}")
        y = 780
        for row in data:
            c.drawString(100, y, str(row))
            y -= 20
        c.save()
    else:
        raise ValueError(f"Unsupported format or missing library for {format_type}")
        
    return f"{settings.MEDIA_URL}exports/{file_name}"

GENERATE_EXPORT_TOOL = {
    "name": "generate_export",
    "description": "Generate an export file (PDF, XLSX, CSV) and return its URL.",
    "parameters": {
        "type": "object",
        "properties": {
            "format_type": {
                "type": "string",
                "enum": ["pdf", "xlsx", "csv"],
                "description": "The format of the export file."
            },
            "data": {
                "type": "string", 
                "description": "JSON string of list of dictionaries representing rows to export."
            }
        },
        "required": ["format_type", "data"]
    }
}
