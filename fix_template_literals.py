import os
import re

FRONTEND_PAGES_DIR = r"C:\Assignment\erp\transt\frontend\src\pages"

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # 1. Fix double formatCurrency
    # formatCurrency(formatCurrency(X)) -> formatCurrency(X)
    while 'formatCurrency(formatCurrency(' in content:
        content = re.sub(r'formatCurrency\(\s*formatCurrency\(([^)]+)\)\s*\)', r'formatCurrency(\1)', content)
        
    # Wait, formatCurrency(formatCurrency(dashboard.metrics?.total_purchase_value || 0))
    # might have extra parens.
    # A safer way: replace "formatCurrency(formatCurrency(" with "formatCurrency(" and remove one ")"
    # Actually regex: formatCurrency\(formatCurrency\((.*?)\)\) -> formatCurrency(\1)
    content = re.sub(r'formatCurrency\(\s*formatCurrency\((.*?)\)\s*\)', r'formatCurrency(\1)', content)
    
    # 2. Fix broken string interpolation without $
    # If we have `value={`{formatCurrency(X)}`}` -> `value={formatCurrency(X)}`
    content = re.sub(r'=\s*\{\s*`\s*\{formatCurrency\((.*?)\)\}\s*`\s*\}', r'={formatCurrency(\1)}', content)
    
    # If we have `subtitle={`Something {formatCurrency(X)}`}` -> `subtitle={`Something ${formatCurrency(X)}`}`
    # basically any `{formatCurrency` inside backticks needs to be `${formatCurrency`
    # Let's find `{formatCurrency` and replace with `${formatCurrency` if it's currently inside a template string.
    # Actually, a simple text replace of `{formatCurrency` to `${formatCurrency` won't work everywhere because JSX expects `{formatCurrency}` outside backticks.
    # But inside backticks, we want `${formatCurrency`.
    # Let's use regex to find `{formatCurrency` that is preceded by backtick or text, but not by `=` or `>` (JSX brackets).
    
    # First, let's just globally replace `{formatCurrency(` with `${formatCurrency(` if we know it's inside backticks.
    # It's easier to find ``` `...{formatCurrency(...)...` ```
    # Let's just iterate over matches of backtick strings and replace inside them.
    def replacer(match):
        inner = match.group(0)
        # replace `{formatCurrency` with `${formatCurrency` unless it's already `${formatCurrency`
        inner = re.sub(r'(?<!\$)\{formatCurrency', r'${formatCurrency', inner)
        return inner
        
    content = re.sub(r'`[^`]*`', replacer, content)

    # 3. There is a specific bug in PurchasePage line 1251:
    # `? `{formatCurrency(( (parseFloat(dashboard.metrics?.total_paid_amount || 0) / parseFloat(dashboard.metrics?.total_invoiced_amount || 1)) * 100 ).toFixed(1))}%`
    # We replaced `${` with `{formatCurrency`.
    # If it's a percentage, it shouldn't use formatCurrency at all!
    # Let's check for formatCurrency(...) followed by }%
    # e.g., ${formatCurrency(( ... ).toFixed(1))}% -> ${ ( ... ).toFixed(1) }%
    content = re.sub(r'\$\{formatCurrency\(\s*\(\s*\(\s*parseFloat(.*?\)\.toFixed\(\d+\))\s*\)\}\%', r'${ (parseFloat\1 }%', content)
    
    # also `{formatCurrency(( (parseFloat` -> `${ ((parseFloat`
    content = re.sub(r'\$\{formatCurrency\(\(\s*\(\s*parseFloat(.*?)\)\.toFixed\((\d+)\)\s*\)\}\%', r'${ ((parseFloat\1).toFixed(\2) }%', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")

for root, _, files in os.walk(FRONTEND_PAGES_DIR):
    for file in files:
        if file.endswith('.jsx'):
            fix_file(os.path.join(root, file))
