import re

def fix_login_error():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\LoginPage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The buggy code:
    original = """        if (err.response?.data) {
          const data = err.response.data;
          if (data.detail) {"""
    
    replacement = """        if (err.response?.data) {
          const data = err.response.data;
          if (typeof data === 'string') {
            if (data.trim().startsWith('<')) {
              setServerError('A server error occurred. Please check the backend logs.');
            } else {
              setServerError(data);
            }
          } else if (data.detail) {"""
    
    if original in content:
        content = content.replace(original, replacement)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed LoginPage.jsx")
    else:
        print("Original string not found in LoginPage.jsx")

fix_login_error()
