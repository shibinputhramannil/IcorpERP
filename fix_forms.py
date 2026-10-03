import re

def fix_table_and_forms():
    pages = [
        r"C:\Assignment\erp\transt\frontend\src\pages\PurchasePage.jsx",
        r"C:\Assignment\erp\transt\frontend\src\pages\SalesPage.jsx"
    ]
    
    for path in pages:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original = content

        # 1. Fix grid item sizes for date fields so they aren't squeezed.
        # `<Grid item xs={12} sm={2}>` -> `<Grid item xs={12} sm={3}>` when it contains a Date field
        # Actually, let's just widen the dates in PurchasePage specifically.
        if "PurchasePage" in path:
            # Vendor grid from sm=4 -> sm=3
            # Warehouse grid from sm=4 -> sm=3
            # Order Date from sm=2 -> sm=3
            # Expected Date from sm=2 -> sm=3
            # Direct Bill: Vendor sm=6->sm=4, Bill/Ref sm=6->sm=4, Bill Date sm=6->sm=2, Due Date sm=6->sm=2
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{4\}>\s*<FormControl fullWidth size="small" required>\s*<InputLabel>Vendor</InputLabel>',
                r'<Grid item xs={12} sm={3}>\n                  <FormControl fullWidth size="small" required>\n                    <InputLabel>Vendor</InputLabel>',
                content
            )
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{4\}>\s*<FormControl fullWidth size="small">\s*<InputLabel>Destination Warehouse</InputLabel>',
                r'<Grid item xs={12} sm={3}>\n                  <FormControl fullWidth size="small">\n                    <InputLabel>Destination Warehouse</InputLabel>',
                content
            )
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{2\}>\s*<TextField\s*fullWidth\s*size="small"\s*label="Order Date"',
                r'<Grid item xs={12} sm={3}>\n                  <TextField\n                    fullWidth\n                    size="small"\n                    label="Order Date"',
                content
            )
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{2\}>\s*<TextField\s*fullWidth\s*size="small"\s*label="Expected Date"',
                r'<Grid item xs={12} sm={3}>\n                  <TextField\n                    fullWidth\n                    size="small"\n                    label="Expected Date"',
                content
            )
            
            # Direct bill form:
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{6\}>\s*<FormControl fullWidth size="small" required>\s*<InputLabel>Vendor / Supplier',
                r'<Grid item xs={12} sm={4}>\n                  <FormControl fullWidth size="small" required>\n                    <InputLabel>Vendor / Supplier',
                content
            )
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{6\}>\s*<TextField\s*fullWidth\s*size="small"\s*label="Vendor Bill / Ref #"',
                r'<Grid item xs={12} sm={4}>\n                  <TextField\n                    fullWidth\n                    size="small"\n                    label="Vendor Bill / Ref #"',
                content
            )
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{6\}>\s*<TextField\s*fullWidth\s*size="small"\s*label="Bill Date"',
                r'<Grid item xs={12} sm={2}>\n                  <TextField\n                    fullWidth\n                    size="small"\n                    label="Bill Date"',
                content
            )
            content = re.sub(
                r'<Grid item xs=\{12\} sm=\{6\}>\s*<TextField\s*fullWidth\s*size="small"\s*label="Due Date"',
                r'<Grid item xs={12} sm={2}>\n                  <TextField\n                    fullWidth\n                    size="small"\n                    label="Due Date"',
                content
            )
        
        # 2. Add fullWidth to all TextFields inside TableCell
        # We look for <TextField ... /> that are inside <TableCell>
        # To do this safely, we can just replace `<TextField\s*size="small"` with `<TextField fullWidth size="small"` 
        # but only for quantity, unit_price, discount, tax.
        # We can just match `<TextField` and if it doesn't have `fullWidth`, add it, but only in the lines with `type="number"` inside TableBody.
        def inject_fullwidth(match):
            m_str = match.group(0)
            if 'fullWidth' not in m_str:
                return m_str.replace('<TextField', '<TextField fullWidth')
            return m_str

        # Find all `<TextField ... type="number" ... />`
        content = re.sub(r'<TextField[^>]+type="number"[^>]*>', inject_fullwidth, content)
        
        # In SalesPage, sometimes it doesn't have type="number"
        # Let's just do a generic replace for TableCell > TextField
        content = re.sub(r'(<TableCell>\s*)<TextField\s+size="small"', r'\1<TextField fullWidth size="small"', content)

        # 3. Fix headers Discount ($) and Tax ($) -> Discount (₹) and Tax (₹)
        content = content.replace('Discount ($)', 'Discount (₹)')
        content = content.replace('Tax ($)', 'Tax (₹)')
        content = content.replace('Unit Price ($)', 'Unit Price (₹)')
        content = content.replace('Unit Cost ($)', 'Unit Cost (₹)')

        # Change column widths
        content = content.replace('sx={{ width: 110 }}', 'sx={{ width: 130 }}')
        content = content.replace('sx={{ width: 90 }}', 'sx={{ width: 110 }}')
        content = content.replace('sx={{ width: 100 }}', 'sx={{ width: 120 }}')
        
        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed {path}")

fix_table_and_forms()
