import re

def fix_sales_page():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\SalesPage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace formatCurrency(parseFloat(...).toLocaleString(undefined, { minimumFractionDigits: 2 )}
    # with formatCurrency(...)
    
    # regex for: formatCurrency(parseFloat(X).toLocaleString(undefined, { minimumFractionDigits: 2 )})
    # We want to keep X.
    
    content = re.sub(
        r'formatCurrency\(\s*parseFloat\(([^)]+)\)\.toLocaleString\(undefined,\s*\{\s*minimumFractionDigits:\s*2\s*\)\}\)',
        r'formatCurrency(\1)',
        content
    )
    
    content = re.sub(
        r'formatCurrency\(\s*parseFloat\(([^)]+)\)\.toLocaleString\(undefined,\s*\{\s*minimumFractionDigits:\s*2\s*\)\}\)',
        r'formatCurrency(\1)',
        content
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
def fix_finance_page():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\FinancePage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the local formatCurrency
    content = re.sub(r'const formatCurrency = \(val\) => \{.*?return.*?;\s*\};', '', content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
def fix_reports_page():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\ReportsPage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the local formatCurrency
    content = re.sub(r'const formatCurrency = \(val\) => \{.*?return.*?;\s*\};', '', content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_sales_page()
fix_finance_page()
fix_reports_page()
