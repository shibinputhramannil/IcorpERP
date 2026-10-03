import re

def add_frontend_registration():
    # 1. Update AppRoutes.jsx
    routes_path = r"C:\Assignment\erp\transt\frontend\src\routes\AppRoutes.jsx"
    with open(routes_path, 'r', encoding='utf-8') as f:
        routes_content = f.read()

    if "RegisterPage" not in routes_content:
        routes_content = routes_content.replace(
            "import LoginPage from '../pages/LoginPage';",
            "import LoginPage from '../pages/LoginPage';\nimport RegisterPage from '../pages/RegisterPage';"
        )
        routes_content = routes_content.replace(
            '<Route path="/login" element={<LoginPage />} />',
            '<Route path="/login" element={<LoginPage />} />\n        <Route path="/register" element={<RegisterPage />} />'
        )
        with open(routes_path, 'w', encoding='utf-8') as f:
            f.write(routes_content)
        print("Updated AppRoutes.jsx")

    # 2. Update LoginPage.jsx
    login_path = r"C:\Assignment\erp\transt\frontend\src\pages\LoginPage.jsx"
    with open(login_path, 'r', encoding='utf-8') as f:
        login_content = f.read()
        
    if "/register" not in login_content:
        # We need to find the "Forgot password?" link box and add a "Don't have an account? Sign up" link
        login_content = login_content.replace(
            '<Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ fontWeight: 600 }}>',
            '<Link component={RouterLink} to="/register" variant="body2" sx={{ fontWeight: 600 }}>\n                  Don\'t have an account? Sign Up\n                </Link>\n              </Grid>\n              <Grid item xs={12} textAlign="center" sx={{ mt: 1 }}>\n                <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ fontWeight: 600 }}>'
        )
        with open(login_path, 'w', encoding='utf-8') as f:
            f.write(login_content)
        print("Updated LoginPage.jsx")

add_frontend_registration()
