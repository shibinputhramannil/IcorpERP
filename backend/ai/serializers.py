from rest_framework import serializers


class AIChatRequestSerializer(serializers.Serializer):
    query = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=2000,
        help_text="Natural-language question or instruction for the ERP assistant."
    )
    conversation_history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text="Optional conversation turns for conversational continuity."
    )


class AIChatResponseSerializer(serializers.Serializer):
    intent = serializers.CharField()
    answer = serializers.CharField()
    data = serializers.DictField(required=False, default=dict)
    suggested_questions = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    llm_augmented = serializers.BooleanField(required=False, default=False)
