import re

def fix_register_page_logo():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\RegisterPage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove BrandingIcon import
    content = re.sub(r'import BrandingIcon from \'\.\./components/common/BrandingIcon\';\n', '', content)
    
    # Replace <BrandingIcon size={48} /> with the img
    img_html = """<img 
            src="/src/assets/branding/transt-logo-transparent.svg" 
            alt="transt" 
            style={{ width: '100%', maxWidth: '180px', height: 'auto', marginBottom: '8px', display: 'inline-block' }} 
          />"""
    content = content.replace("<BrandingIcon size={48} />", img_html)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed RegisterPage.jsx logo")

fix_register_page_logo()
