import os
import re

def add_backend_registration():
    # 1. accounts/views.py
    views_path = r"C:\Assignment\erp\transt\backend\accounts\views.py"
    with open(views_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if "class RegisterView" not in content:
        imports_end = content.find("\n\n")
        new_imports = """
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User, Group
from company.models import Company
"""
        # add to imports
        content = content.replace("from rest_framework.permissions import IsAuthenticated", "from rest_framework.permissions import IsAuthenticated, AllowAny")
        
        register_view = """
# ============================================================
# REGISTRATION API
# ============================================================

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        company_name = request.data.get('company_name', f"{first_name}'s Company" if first_name else "My Company")

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=400)

        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': 'Email is already registered'}, status=400)

        username = email.split('@')[0]
        base_username = username
        counter = 1
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )

            # Create default company for the new user
            company = Company.objects.create(
                name=company_name,
                email=email,
                currency_code='INR',
                currency_symbol='₹',
                timezone='Asia/Kolkata',
                date_format='DD/MM/YYYY'
            )

            admin_group, _ = Group.objects.get_or_create(name='Admin')

            CompanyMembership.objects.create(
                user=user,
                company=company,
                role=admin_group,
                is_active=True
            )

            return Response({
                'message': 'Account created successfully',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                }
            }, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
"""
        content += "\n" + register_view
        
        # Wait, need to add Group import if missing
        if "from django.contrib.auth.models" not in content:
            content = "from django.contrib.auth.models import User, Group\n" + content
            
        with open(views_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated views.py")

    # 2. config/urls.py
    urls_path = r"C:\Assignment\erp\transt\backend\config\urls.py"
    with open(urls_path, 'r', encoding='utf-8') as f:
        urls_content = f.read()
        
    if "RegisterView" not in urls_content:
        urls_content = urls_content.replace(
            "MeView,",
            "MeView,\n    RegisterView,"
        )
        urls_content = urls_content.replace(
            "path(\"api/auth/me/\", UserMeView.as_view(), name=\"auth_me\"),",
            "path(\"api/auth/me/\", UserMeView.as_view(), name=\"auth_me\"),\n    path(\"api/auth/register/\", RegisterView.as_view(), name=\"auth_register\"),"
        )
        # handle UserMeView renaming? Wait, the file imported MeView but mapped UserMeView? Let me check how it was mapped.
        # Let's just use regex to insert the path
        if "api/auth/register/" not in urls_content:
            urls_content = re.sub(
                r'(path\("api/auth/me/",.*?name="auth_me"\),)',
                r'\1\n    path("api/auth/register/", RegisterView.as_view(), name="auth_register"),',
                urls_content
            )
        with open(urls_path, 'w', encoding='utf-8') as f:
            f.write(urls_content)
        print("Updated urls.py")

add_backend_registration()
