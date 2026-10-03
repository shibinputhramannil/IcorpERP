import re

def fix_percentage():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\PurchasePage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The buggy string is:
    # `${formatCurrency((
    #    (parseFloat(dashboard.metrics?.total_paid_amount || 0) /
    #      parseFloat(dashboard.metrics?.total_invoiced_amount || 1)) *
    #    100
    #  ).toFixed(1))}%`
    
    # Let's replace `${formatCurrency((` with `${((` and remove the trailing `))` that formatCurrency added?
    # Wait, the original was probably `${ ( (parseFloat(...) / parseFloat(...) ) * 100 ).toFixed(1) }%`
    # Let's just do a string replace for the specific block.
    
    old_block = """`${formatCurrency((
                              (parseFloat(dashboard.metrics?.total_paid_amount || 0) /
                                parseFloat(dashboard.metrics?.total_invoiced_amount || 1)) *
                              100
                            ).toFixed(1))}%`"""
                            
    new_block = """`${(
                              (parseFloat(dashboard.metrics?.total_paid_amount || 0) /
                                parseFloat(dashboard.metrics?.total_invoiced_amount || 1)) *
                              100
                            ).toFixed(1)}%`"""
                            
    if old_block in content:
        content = content.replace(old_block, new_block)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed percentage block")
    else:
        # Let's try with regex to be safe about spaces
        content = re.sub(
            r'\$\{formatCurrency\(\(\s*\(\s*parseFloat\((.*?)\)\.toFixed\(1\)\)\}\%',
            r'${( (parseFloat(\1).toFixed(1) }%',
            content,
            flags=re.DOTALL
        )
        
        # Let's just do a simpler replacement
        content = re.sub(
            r'\$\{formatCurrency\(\(\s*(.*?)\s*\)\.toFixed\(1\)\)\}\%',
            r'${\1.toFixed(1)}%',
            content,
            flags=re.DOTALL
        )
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed via regex")

fix_percentage()
