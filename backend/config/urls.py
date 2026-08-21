"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import MeView,CompanyMemberListView,CompanyMemberCreateView,CompanyMemberUpdateView
from company.views import CompanyListView, CompanyDetailView,CompanyCreateView
from apps.employee.views import EmployeeListView,EmployeeDetailView
from crm.views import ContactListCreateView, ContactDetailView,LeadListCreateView,LeadDetailView


urlpatterns = [
    path("admin/", admin.site.urls),

    path(
        "api/auth/login/",
        TokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "api/auth/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "api/auth/me/",
        MeView.as_view(),
        name="auth_me",
    ),
    path(
    "api/companies/",
    CompanyListView.as_view(),
    name="company_list",
    
),
path(
    "api/companies/<int:pk>/",
    CompanyDetailView.as_view(),
    name="company_detail",
),
path(
    "api/companies/create/",
    CompanyCreateView.as_view(),
    name="company_create",
),
path(
    "api/companies/<int:company_id>/members/",
    CompanyMemberListView.as_view(),
    name="company_members",
),
path(
    "api/companies/<int:company_id>/members/add/",
    CompanyMemberCreateView.as_view(),
    name="company_member_create",
),
path(
    "api/companies/<int:company_id>/members/<int:membership_id>/",
    CompanyMemberUpdateView.as_view(),
    name="company-member-update",
),
path(
    "api/companies/<int:company_id>/employees/",
    EmployeeListView.as_view(),
    name="employee_list",
),
path(
    "api/companies/<int:company_id>/employees/<int:employee_id>/",
    EmployeeDetailView.as_view(),
    name="employee_detail",
),
path(
    "api/companies/<int:company_id>/contacts/",
    ContactListCreateView.as_view(),
    name="contact_list_create",
),
path(
    "api/companies/<int:company_id>/contacts/<int:contact_id>/",
    ContactDetailView.as_view(),
    name="contact_detail",
),
# List/Create leads for a company
path(
    "api/companies/<int:company_id>/leads/",
    LeadListCreateView.as_view(),
    name="lead_list_create",
),

# View/Update one lead
path(
    "api/companies/<int:company_id>/leads/<int:lead_id>/",
    LeadDetailView.as_view(),
    name="lead_detail",
),
]