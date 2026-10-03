import re

def fix_login_error():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\LoginPage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = re.sub(
        r'const data = err\.response\.data;\s*if \(data\.detail\) \{',
        r'''const data = err.response.data;
          if (typeof data === 'string') {
            if (data.trim().startsWith('<')) {
              setServerError('A server error occurred. Please check the backend logs.');
            } else {
              setServerError(data);
            }
          } else if (data.detail) {''',
        content
    )
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Fixed")

fix_login_error()
