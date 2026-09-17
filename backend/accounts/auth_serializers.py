from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Allows users to authenticate using either their username or their email address.
    """

    def validate(self, attrs):
        username_or_email = attrs.get("username", "").strip()
        password = attrs.get("password")

        # Check if an email was supplied instead of a username
        if "@" in username_or_email:
            user = User.objects.filter(email__iexact=username_or_email).first()
            if user:
                attrs["username"] = user.username
        else:
            # Fallback check: if username doesn't exist, check if email matches
            if not User.objects.filter(username=username_or_email).exists():
                user = User.objects.filter(email__iexact=username_or_email).first()
                if user:
                    attrs["username"] = user.username

        data = super().validate(attrs)

        # Include user profile metadata with token response
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "is_staff": self.user.is_staff,
            "is_superuser": self.user.is_superuser,
        }

        return data


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer
