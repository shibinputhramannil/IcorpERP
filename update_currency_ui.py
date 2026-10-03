import os
import re

FRONTEND_PAGES_DIR = r"C:\Assignment\erp\transt\frontend\src\pages"
COMPONENTS_DIR = r"C:\Assignment\erp\transt\frontend\src\components"

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace simple UI labels
    content = re.sub(r'\bValue \(\$\)', 'Value (₹)', content)
    content = re.sub(r'\bAmount \(\$\)', 'Amount (₹)', content)
    content = re.sub(r'\bPrice \(\$\)', 'Price (₹)', content)
    content = re.sub(r'\bTotal \(\$\)', 'Total (₹)', content)
    content = re.sub(r'\bCost Price \(\$\)', 'Cost Price (₹)', content)
    content = re.sub(r'\bSelling Price \(\$\)', 'Selling Price (₹)', content)
    content = re.sub(r'\(\$ Amount\)', '(₹ Amount)', content)
    content = re.sub(r'placeholder="\$0\.00"', 'placeholder="₹0.00"', content)

    # Replace React interpolation with parseFloat and toFixed(2)
    # e.g., ${parseFloat(item.unit_price).toFixed(2)} -> {formatCurrency(item.unit_price)}
    content = re.sub(r'\$\{\s*parseFloat\(([^)]+)\)\.toFixed\(2\)\s*\}', r'{formatCurrency(\1)}', content)
    
    # Replace React interpolation directly with variables
    # e.g., ${invoiceTotals.subtotal} -> {formatCurrency(invoiceTotals.subtotal)}
    # Note: we should only target the specific ones we know are currencies. But wait, what if we just target \$\{([^}]+(total|amount|price|discount|tax|balance|paid)[^}]*)\} where it makes sense?
    # Better: explicitly replace known ones.
    content = re.sub(r'\$\{(orderTotals\.[a-zA-Z0-9_]+)\}', r'{formatCurrency(\1)}', content)
    content = re.sub(r'\$\{(invoiceTotals\.[a-zA-Z0-9_]+)\}', r'{formatCurrency(\1)}', content)
    
    # Replace simple $ literals in JSX text, like `${lineTot}`
    content = re.sub(r'\$\{\s*([^}]+(Tot|total|amount|price|value)[^}]*)\s*\}', r'{formatCurrency(\1)}', content)
    
    # For AIAssistantPage formatters
    content = re.sub(r"'\$0\.00'", "'₹0.00'", content)
    
    # Specific fix for CRM deal value
    content = re.sub(r'Value: \$\$\{d\.value\}', 'Value: {formatCurrency(d.value)}', content)
    content = re.sub(r'Value: \$\$\{parseFloat\(d\.value\)\.toLocaleString\(\)\}', 'Value: {formatCurrency(d.value)}', content)
    content = re.sub(r'\$\$\{parseFloat\(([^)]+)\)\.toLocaleString\(\)\}', r'{formatCurrency(\1)}', content)
    content = re.sub(r'\$\{(d\.value)\}', r'{formatCurrency(\1)}', content)
    content = re.sub(r'\$([0-9,.]+)', r'₹\1', content) # static fallback for pure text values like $1000

    if content != original_content:
        # Check if we need to import formatCurrency
        if 'formatCurrency' in content and 'import { formatCurrency }' not in content:
            # Determine path to utils
            depth = filepath.replace(FRONTEND_PAGES_DIR, '').count(os.sep)
            if 'pages' in filepath:
                utils_path = '../utils/currency'
                if depth > 1:
                    utils_path = '../../utils/currency'
            else:
                utils_path = '../utils/currency' # Adjust for components
            
            import_statement = f"import {{ formatCurrency }} from '{utils_path}';\n"
            # Insert after the first import
            if 'import React' in content:
                content = content.replace('import React', import_statement + 'import React', 1)
            else:
                content = import_statement + content

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(FRONTEND_PAGES_DIR):
    for file in files:
        if file.endswith('.jsx'):
            update_file(os.path.join(root, file))

for root, _, files in os.walk(COMPONENTS_DIR):
    for file in files:
        if file.endswith('.jsx'):
            update_file(os.path.join(root, file))
