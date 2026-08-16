from django.contrib.auth.models import Group, User
from django.db import models

from company.models import Company


class CompanyMembership(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="company_memberships",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.ForeignKey(
    Group,
    on_delete=models.PROTECT,
    related_name="company_memberships",
     null=True,
    blank=True,
)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "company")

    def __str__(self):
        return f"{self.user.username} - {self.company.name}"

# Create your models here.
