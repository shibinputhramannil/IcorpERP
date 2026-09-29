from .base import BaseAIProvider
from .openai_provider import OpenAIProvider
from .gemini_provider import GeminiProvider

class AIProviderRegistry:
    _providers = {
        "openai": OpenAIProvider,
        "gemini": GeminiProvider,
    }

    @classmethod
    def get_provider(cls, name: str, **kwargs) -> BaseAIProvider:
        provider_class = cls._providers.get(name.lower())
        if not provider_class:
            raise ValueError(f"Provider {name} is not supported.")
        return provider_class(**kwargs)
