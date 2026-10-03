import re

def fix_login_page():
    login_path = r"C:\Assignment\erp\transt\frontend\src\pages\LoginPage.jsx"
    with open(login_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the link block for forgot password
    # <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
    #   <Link component={RouterLink} to="/forgot-password" ...
    
    if 'to="/register"' not in content:
        insert_text = """
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Don't have an account?{' '}
                  <Link component={RouterLink} to="/register" underline="hover" sx={{ fontWeight: 600 }}>
                    Sign up
                  </Link>
                </Typography>
              </Box>
"""
        # Insert it after the Sign In button
        # <Button type="submit" ... >Sign In</Button>
        content = re.sub(
            r'(<Button\s+type="submit"[\s\S]*?>\s*\{loading \? <CircularProgress [^>]+> : \'Sign In\'\}\s*</Button>)',
            r'\1\n' + insert_text,
            content
        )
        with open(login_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated LoginPage.jsx with Register link")

fix_login_page()
