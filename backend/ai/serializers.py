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


class AIAskRequestSerializer(serializers.Serializer):
    """
    Serializer for POST /api/companies/<company_id>/ai/ask/
    Accepts either 'question' or 'query'.
    """
    question = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=2000,
        help_text="Question for the AI assistant."
    )
    query = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=2000,
        help_text="Alternative parameter name for question."
    )
    conversation_history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text="Optional chat history turns."
    )

    def validate(self, attrs):
        question = attrs.get("question") or attrs.get("query")
        if not question or not str(question).strip():
            raise serializers.ValidationError("Either 'question' or 'query' must be provided and non-empty.")
        attrs["question"] = str(question).strip()
        return attrs


class AIAskResponseSerializer(serializers.Serializer):
    question = serializers.CharField()
    answer = serializers.CharField()
    intent = serializers.CharField(required=False, default="GENERAL")
    data = serializers.DictField(required=False, default=dict)
    suggested_questions = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    fallback_used = serializers.BooleanField(required=False, default=True)
    llm_augmented = serializers.BooleanField(required=False, default=False)
