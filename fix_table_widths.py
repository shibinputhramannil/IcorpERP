import re

def fix_table_widths():
    pages = [
        r"C:\Assignment\erp\transt\frontend\src\pages\PurchasePage.jsx",
        r"C:\Assignment\erp\transt\frontend\src\pages\SalesPage.jsx"
    ]
    
    for path in pages:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Let's change `width: 130` to `minWidth: 120`
        content = content.replace('sx={{ width: 130 }}', 'sx={{ minWidth: 120 }}')
        
        # Change `width: 110` to `minWidth: 120`
        content = content.replace('sx={{ width: 110 }}', 'sx={{ minWidth: 120 }}')
        
        # Change `width: 90` to `minWidth: 100`
        content = content.replace('sx={{ width: 90 }}', 'sx={{ minWidth: 100 }}')

        # Product column: `minWidth: 220` -> `width: '40%', minWidth: 250`
        content = content.replace('sx={{ minWidth: 220 }}', "sx={{ width: '40%', minWidth: 250 }}")
        content = content.replace('sx={{ minWidth: 180 }}', "sx={{ width: '40%', minWidth: 250 }}")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {path}")

fix_table_widths()
