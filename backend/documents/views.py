import os
import mimetypes
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Company
from accounts.models import WorkspaceActivity
from notifications.services import notify_company_admins
from documents.models import Document
from documents.serializers import DocumentSerializer

# Security Constraints
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "png", "jpg", "jpeg", "webp", "zip",
    "rtf", "svg", "json", "md"
}

DANGEROUS_EXTENSIONS = {
    "exe", "bat", "cmd", "sh", "py", "php", "pl", "cgi",
    "js", "msi", "vbs", "ps1", "scr", "jar", "dll", "com",
    "pif", "app"
}


class DocumentBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def get_company_and_membership(self, request, company_id):
        if request.user.is_superuser:
            company = Company.objects.filter(id=company_id, is_active=True).first()
            return company, True

        membership = (
            request.user.company_memberships
            .select_related("company", "role")
            .filter(company_id=company_id, company__is_active=True, is_active=True)
            .first()
        )
        if not membership:
            return None, False

        is_admin = bool(membership.role and membership.role.name == "Company Admin")
        return membership.company, is_admin


class DocumentListCreateView(DocumentBaseView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company's documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = Document.objects.filter(company=company).select_related("uploaded_by")

        # Filters
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search.strip()) | Q(tags__icontains=search.strip()))

        category = request.query_params.get("category")
        if category and category != "all":
            queryset = queryset.filter(category=category.strip().lower())

        file_type = request.query_params.get("file_type")
        if file_type:
            queryset = queryset.filter(file_type__iexact=file_type.strip())

        module = request.query_params.get("related_module")
        if module:
            queryset = queryset.filter(related_module__iexact=module.strip())

        page_number = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)

        serializer = DocumentSerializer(page.object_list, many=True)
        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page.number,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request, company_id):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"file": ["No file was provided."]}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Size Validation
        if file_obj.size > MAX_FILE_SIZE_BYTES:
            return Response(
                {"file": [f"File size ({file_obj.size / (1024 * 1024):.1f}MB) exceeds the maximum limit of 25MB."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Extension / Type Validation
        original_name = os.path.basename(file_obj.name)
        ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""

        if ext in DANGEROUS_EXTENSIONS:
            return Response(
                {"file": [f"Files with extension '.{ext}' are prohibited for security reasons."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {"file": [f"File format '.{ext}' is not supported. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        custom_name = request.data.get("name")
        doc_name = str(custom_name).strip() if custom_name else original_name

        category = request.data.get("category", "general")
        tags = request.data.get("tags", "")

        related_module = request.data.get("related_module", "workspace")
        related_object_id = request.data.get("related_object_id")
        if related_object_id:
            try:
                related_object_id = int(related_object_id)
            except (ValueError, TypeError):
                related_object_id = None

        document = Document.objects.create(
            company=company,
            uploaded_by=request.user,
            name=doc_name,
            file=file_obj,
            file_type=ext.upper(),
            file_size=file_obj.size,
            category=category.lower() if category else "general",
            tags=tags.strip(),
            related_module=related_module,
            related_object_id=related_object_id,
        )

        # Log Activity
        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="document_uploaded",
            details=f"Uploaded document: {doc_name} ({ext.upper()})",
        )

        # Notify Admins
        notify_company_admins(
            company=company,
            title="Document Uploaded",
            message=f"{request.user.username} uploaded document '{doc_name}' ({document.file_size_formatted() if hasattr(document, 'file_size_formatted') else ext.upper()}).",
            notification_type="system",
        )

        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)


class DocumentDetailView(DocumentBaseView):
    def get(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        document = Document.objects.filter(id=pk, company=company).select_related("uploaded_by").first()
        if not document:
            return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(DocumentSerializer(document).data, status=status.HTTP_200_OK)

    def patch(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        document = Document.objects.filter(id=pk, company=company).first()
        if not document:
            return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        can_edit = is_admin or request.user.is_superuser or (document.uploaded_by_id == request.user.id)
        if not can_edit:
            return Response({"detail": "You do not have permission to edit this document."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DocumentSerializer(document, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_doc = serializer.save()
        return Response(DocumentSerializer(updated_doc).data, status=status.HTTP_200_OK)

    def delete(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        document = Document.objects.filter(id=pk, company=company).first()
        if not document:
            return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        # Only uploader or admin can delete
        can_delete = is_admin or request.user.is_superuser or (document.uploaded_by_id == request.user.id)
        if not can_delete:
            return Response(
                {"detail": "You do not have permission to delete this document."},
                status=status.HTTP_403_FORBIDDEN,
            )

        doc_name = document.name

        # Safe removal from disk
        if document.file:
            try:
                document.file.delete(save=False)
            except Exception:
                pass

        document.delete()

        # Log Activity
        WorkspaceActivity.objects.create(
            company=company,
            user=request.user,
            action="document_deleted",
            details=f"Deleted document: {doc_name}",
        )

        return Response({"detail": "Document deleted successfully."}, status=status.HTTP_200_OK)


class DocumentDownloadView(DocumentBaseView):
    def get(self, request, company_id, pk):
        company, is_admin = self.get_company_and_membership(request, company_id)
        if not company:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        document = Document.objects.filter(id=pk, company=company).first()
        if not document or not document.file:
            raise Http404("Document does not exist.")

        try:
            file_handle = document.file.open("rb")
        except Exception:
            raise Http404("File could not be opened.")

        content_type, _ = mimetypes.guess_type(document.name)
        if not content_type:
            content_type = "application/octet-stream"

        response = FileResponse(file_handle, content_type=content_type)
        safe_name = os.path.basename(document.name)
        # Ensure the filename ends with file_type if missing
        if document.file_type and not safe_name.lower().endswith(f".{document.file_type.lower()}"):
            safe_name = f"{safe_name}.{document.file_type.lower()}"
        response["Content-Disposition"] = f'attachment; filename="{safe_name}"'
        return response
