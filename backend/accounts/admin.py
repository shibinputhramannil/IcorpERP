from django.contrib import admin

from .models import CompanyMembership


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "created_at")
    list_filter = ("company", "role")
    search_fields = ("user__username", "company__name")