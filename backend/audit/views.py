from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import PermissionDenied
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Check permissions
        if user.is_superuser:
            qs = AuditLog.objects.all()
        else:
            # Check if user is admin in any company
            admin_companies = user.company_memberships.filter(
                role__in=['Admin', 'Owner'], 
                is_active=True
            ).values_list('company_id', flat=True)
            
            if not admin_companies:
                raise PermissionDenied("Only administrators can view audit logs.")
            qs = AuditLog.objects.filter(company_id__in=admin_companies)
            
        company_id = request.query_params.get('company_id')
        if company_id:
            if not user.is_superuser and int(company_id) not in admin_companies:
                raise PermissionDenied("You do not have access to this company's logs.")
            qs = qs.filter(company_id=company_id)
            
        module = request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
            
        action = request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)
            
        # Pagination
        try:
            limit = int(request.query_params.get('limit', 50))
            if limit > 200:
                limit = 200
        except ValueError:
            limit = 50
            
        qs = qs[:limit]
        
        serializer = AuditLogSerializer(qs, many=True)
        return Response({
            'count': len(serializer.data),
            'results': serializer.data
        })
