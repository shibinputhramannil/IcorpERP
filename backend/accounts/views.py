from django.contrib.auth.models import User, Group
import os
import json
from pathlib import Path
from django.conf import settings
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from company.models import Company

from .models import CompanyMembership
from .serializers import (
    CompanyMembershipSerializer,
    CompanyMembershipCreateSerializer,
    CompanyMembershipRoleUpdateSerializer,
)


def get_user_avatar_url(user_id):
    avatar_dir = Path(settings.MEDIA_ROOT) / "avatars"
    if not avatar_dir.exists():
        return None
    for ext in [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]:
        avatar_path = avatar_dir / f"avatar_{user_id}{ext}"
        if avatar_path.exists():
            mtime = int(os.path.getmtime(avatar_path))
            return f"{settings.MEDIA_URL}avatars/avatar_{user_id}{ext}?t={mtime}"
    meta_path = avatar_dir / f"avatar_{user_id}.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("avatar_url")
        except Exception:
            pass
    return None


# ============================================================
# CURRENT USER / ME API
# ============================================================

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = request.user.company_memberships.select_related(
            "company",
            "role",
        ).filter(company__is_active=True)

        companies = []
        member_company_ids = set()

        for membership in memberships:
            member_company_ids.add(membership.company.id)
            companies.append({
                "id": membership.company.id,
                "name": membership.company.name,
                "role": membership.role.name if membership.role else ("Company Admin" if request.user.is_superuser else None),
                "is_active": membership.company.is_active,
            })

        # Super Admin has global access to all active companies
        if request.user.is_superuser:
            other_companies = Company.objects.filter(is_active=True).exclude(id__in=member_company_ids)
            for c in other_companies:
                companies.append({
                    "id": c.id,
                    "name": c.name,
                    "role": "Super Admin",
                    "is_active": c.is_active,
                })

        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
            "avatar": get_user_avatar_url(request.user.id),
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser,
            "companies": companies,
        })


# ============================================================
# AVATAR / PROFILE PICTURE API
# ============================================================

class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        avatar_dir = Path(settings.MEDIA_ROOT) / "avatars"
        os.makedirs(avatar_dir, exist_ok=True)

        # 1. Handle direct file upload
        file_obj = request.FILES.get("file") or request.FILES.get("avatar")
        if file_obj:
            name = file_obj.name
            _, ext = os.path.splitext(name)
            ext = ext.lower()
            allowed = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]
            if ext not in allowed:
                return Response(
                    {"error": f"Invalid file format '{ext}'. Allowed formats: {', '.join(allowed)}"},
                    status=400,
                )

            # Limit size to 5MB
            if file_obj.size > 5 * 1024 * 1024:
                return Response({"error": "File size exceeds 5MB limit."}, status=400)

            # Clean up old user avatars
            for old_ext in allowed:
                old_file = avatar_dir / f"avatar_{request.user.id}{old_ext}"
                if old_file.exists():
                    try:
                        old_file.unlink()
                    except Exception:
                        pass
            meta_path = avatar_dir / f"avatar_{request.user.id}.json"
            if meta_path.exists():
                try:
                    meta_path.unlink()
                except Exception:
                    pass

            target_path = avatar_dir / f"avatar_{request.user.id}{ext}"
            with open(target_path, "wb+") as f:
                for chunk in file_obj.chunks():
                    f.write(chunk)

            mtime = int(os.path.getmtime(target_path))
            avatar_url = f"{settings.MEDIA_URL}avatars/avatar_{request.user.id}{ext}?t={mtime}"
            return Response(
                {"message": "Profile picture updated successfully.", "avatar_url": avatar_url, "avatar": avatar_url},
                status=200,
            )

        # 2. Handle preset or URL string
        avatar_url = request.data.get("avatar_url") or request.data.get("avatar")
        if avatar_url:
            allowed = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]
            for old_ext in allowed:
                old_file = avatar_dir / f"avatar_{request.user.id}{old_ext}"
                if old_file.exists():
                    try:
                        old_file.unlink()
                    except Exception:
                        pass

            meta_path = avatar_dir / f"avatar_{request.user.id}.json"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump({"avatar_url": avatar_url}, f)

            return Response(
                {"message": "Profile avatar updated successfully.", "avatar_url": avatar_url, "avatar": avatar_url},
                status=200,
            )

        return Response({"error": "No avatar file or URL provided."}, status=400)

    def delete(self, request):
        avatar_dir = Path(settings.MEDIA_ROOT) / "avatars"
        allowed = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]
        for old_ext in allowed:
            old_file = avatar_dir / f"avatar_{request.user.id}{old_ext}"
            if old_file.exists():
                try:
                    old_file.unlink()
                except Exception:
                    pass
        meta_path = avatar_dir / f"avatar_{request.user.id}.json"
        if meta_path.exists():
            try:
                meta_path.unlink()
            except Exception:
                pass

        return Response({"message": "Profile picture removed successfully.", "avatar": None}, status=200)


# ============================================================
# COMPANY MEMBER LIST API
# ============================================================

class CompanyMemberListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):

        # Super Admin can view members of any active company.
        if request.user.is_superuser:
            memberships = (
                CompanyMembership.objects
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .select_related(
                    "user",
                    "company",
                    "role",
                )
            )

        else:
            # Find the logged-in user's membership in this company.
            admin_membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # User does not belong to this company.
            if not admin_membership:
                return Response(
                    {
                        "detail": (
                            "You do not have access to this company."
                        )
                    },
                    status=403,
                )

            # Only Company Admin can view all members.
            if (
                not admin_membership.role
                or admin_membership.role.name != "Company Admin"
            ):
                return Response(
                    {
                        "detail": (
                            "Company Admin permission required."
                        )
                    },
                    status=403,
                )

            # Get all members of this company.
            memberships = (
                CompanyMembership.objects
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .select_related(
                    "user",
                    "company",
                    "role",
                )
            )

        serializer = CompanyMembershipSerializer(
            memberships,
            many=True,
        )

        return Response(serializer.data)


# ============================================================
# ADD COMPANY MEMBER API
# ============================================================

class CompanyMemberCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id):

        # Super Admin can add members to any active company.
        if request.user.is_superuser:
            company = (
                Company.objects
                .filter(
                    id=company_id,
                    is_active=True,
                )
                .first()
            )

            # Company does not exist or is inactive.
            if not company:
                return Response(
                    {
                        "detail": (
                            "Company not found or inactive."
                        )
                    },
                    status=404,
                )

        # Company Admin can add members only to their own company.
        else:
            admin_membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # User does not belong to this company.
            if not admin_membership:
                return Response(
                    {
                        "detail": (
                            "You do not have access to this company."
                        )
                    },
                    status=403,
                )

            # Only Company Admin can add members.
            if (
                not admin_membership.role
                or admin_membership.role.name != "Company Admin"
            ):
                return Response(
                    {
                        "detail": (
                            "Company Admin permission required."
                        )
                    },
                    status=403,
                )

            # Use the company from the verified membership.
            company = admin_membership.company

        # Validate and create the membership.
        serializer = CompanyMembershipCreateSerializer(
            data=request.data,
            context={
                "company": company,
            },
        )

        if serializer.is_valid():
            membership = serializer.save()

            return Response(
                CompanyMembershipSerializer(membership).data,
                status=201,
            )

        return Response(
            serializer.errors,
            status=400,
        )


# ============================================================
# UPDATE / DELETE COMPANY MEMBER API
# ============================================================

class CompanyMemberUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    # --------------------------------------------------------
    # PATCH: Update member role
    # --------------------------------------------------------

    def patch(self, request, company_id, membership_id):

        # Super Admin can update members in any active company.
        if request.user.is_superuser:
            membership = (
                CompanyMembership.objects
                .select_related(
                    "user",
                    "company",
                    "role",
                )
                .filter(
                    id=membership_id,
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # Membership was not found.
            if not membership:
                return Response(
                    {
                        "detail": (
                            "Membership not found or company inactive."
                        )
                    },
                    status=404,
                )

        # Company Admin can update members only in their own company.
        else:
            admin_membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # User does not belong to this company.
            if not admin_membership:
                return Response(
                    {
                        "detail": (
                            "You do not have access to this company."
                        )
                    },
                    status=403,
                )

            # Only Company Admin can update roles.
            if (
                not admin_membership.role
                or admin_membership.role.name != "Company Admin"
            ):
                return Response(
                    {
                        "detail": (
                            "Company Admin permission required."
                        )
                    },
                    status=403,
                )

            # Find the target membership inside this company.
            membership = (
                CompanyMembership.objects
                .select_related(
                    "user",
                    "company",
                    "role",
                )
                .filter(
                    id=membership_id,
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # Target membership does not exist.
            if not membership:
                return Response(
                    {
                        "detail": "Membership not found."
                    },
                    status=404,
                )

        # Only role should be updated.
        if "role" not in request.data:
            return Response(
                {
                    "role": [
                        "This field is required."
                    ]
                },
                status=400,
            )

        # Use the dedicated role-update serializer.
        serializer = CompanyMembershipRoleUpdateSerializer(
            membership,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            membership = serializer.save()

            return Response(
                CompanyMembershipSerializer(membership).data,
                status=200,
            )

        return Response(
            serializer.errors,
            status=400,
        )

    # --------------------------------------------------------
    # DELETE: Remove member from company
    # --------------------------------------------------------

    def delete(self, request, company_id, membership_id):

        # Super Admin can remove members from any active company.
        if request.user.is_superuser:
            membership = (
                CompanyMembership.objects
                .select_related(
                    "user",
                    "company",
                    "role",
                )
                .filter(
                    id=membership_id,
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # Membership was not found.
            if not membership:
                return Response(
                    {
                        "detail": (
                            "Membership not found or company inactive."
                        )
                    },
                    status=404,
                )

        # Company Admin can remove members only from their own company.
        else:
            admin_membership = (
                request.user.company_memberships
                .select_related("company", "role")
                .filter(
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # User does not belong to this company.
            if not admin_membership:
                return Response(
                    {
                        "detail": (
                            "You do not have access to this company."
                        )
                    },
                    status=403,
                )

            # Only Company Admin can remove members.
            if (
                not admin_membership.role
                or admin_membership.role.name != "Company Admin"
            ):
                return Response(
                    {
                        "detail": (
                            "Company Admin permission required."
                        )
                    },
                    status=403,
                )

            # Find the target membership only inside this company.
            membership = (
                CompanyMembership.objects
                .select_related(
                    "user",
                    "company",
                    "role",
                )
                .filter(
                    id=membership_id,
                    company_id=company_id,
                    company__is_active=True,
                )
                .first()
            )

            # Membership does not exist.
            if not membership:
                return Response(
                    {
                        "detail": "Membership not found."
                    },
                    status=404,
                )

        # Delete ONLY the company membership.
        # The Django User account is NOT deleted.
        membership.delete()

        return Response(
            {
                "detail": "Member removed successfully."
            },
            status=200,
        )

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
