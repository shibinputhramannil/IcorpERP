import re
import os

def fix_table_crushing():
    pages = [
        r"C:\Assignment\erp\transt\frontend\src\pages\PurchasePage.jsx",
        r"C:\Assignment\erp\transt\frontend\src\pages\SalesPage.jsx"
    ]
    
    for path in pages:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Force the Table to have a minWidth so it overflows horizontally rather than crushing columns
        content = re.sub(r'<Table size="small">', r'<Table size="small" sx={{ minWidth: 900 }}>', content)
        
        # 2. Give TextFields an absolute minimum width so they never shrink to nothing
        content = re.sub(r'<TextField fullWidth\s*\n\s*size="small"', r'<TextField fullWidth\n                              sx={{ minWidth: 75 }}\n                              size="small"', content)

        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {path}")

fix_table_crushing()
