from rest_framework.permissions import BasePermission


class IsCompanyAdmin(BasePermission):
    message = "Company Admin permission required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        return request.user.groups.filter(name="Company Admin").exists()