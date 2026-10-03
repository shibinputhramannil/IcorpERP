from django.db import models


class Company(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    
    # Localization / Currency Settings
    currency_code = models.CharField(max_length=10, default='INR')
    currency_name = models.CharField(max_length=50, default='Indian Rupee')
    currency_symbol = models.CharField(max_length=10, default='₹')
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    date_format = models.CharField(max_length=20, default='DD/MM/YYYY')
    financial_year_start = models.CharField(max_length=5, default='04-01', help_text="MM-DD format (April 1st)")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

# Create your models here.
