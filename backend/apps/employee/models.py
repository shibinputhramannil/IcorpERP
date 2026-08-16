from django.contrib.auth.models import User
from django.db import models

from company.models import Company


class Employee(models.Model):
    employee_id = models.CharField(
        max_length=50,
        unique=True,
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="employees",
    )

    first_name = models.CharField(
        max_length=100,
    )

    last_name = models.CharField(
        max_length=100,
        blank=True,
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
    )

    designation = models.CharField(
        max_length=100,
        blank=True,
    )

    department = models.CharField(
        max_length=100,
        blank=True,
    )

    joining_date = models.DateField(
        null=True,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return f"{self.employee_id} - {self.first_name} {self.last_name}"