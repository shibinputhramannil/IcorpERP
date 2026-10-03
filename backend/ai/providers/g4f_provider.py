import json
from typing import List, Dict, Any, Optional
from django.conf import settings
from .base import BaseAIProvider

try:
    import g4f
    from g4f.client import Client
except ImportError:
    g4f = None
    Client = None

class G4FProvider(BaseAIProvider):
    def __init__(self, **kwargs):
        if g4f is None:
            raise ImportError("g4f package is not installed.")
        self.model = getattr(settings, "G4F_MODEL", "gpt-4o-mini")

    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None, **kwargs) -> Dict[str, Any]:
        # Temporarily removing tools for G4F as it doesn't robustly support strict JSON schema tool calling across all free providers
        
        # Remove tool role messages to prevent confusion in free providers
        safe_messages = []
        for msg in messages:
            if msg["role"] in ["user", "assistant", "system"]:
                safe_messages.append({"role": msg["role"], "content": str(msg.get("content", ""))})

        response_text = g4f.ChatCompletion.create(
            model=self.model,
            messages=safe_messages,
        )
        
        if isinstance(response_text, type(None)):
            response_text = "I'm sorry, I couldn't process that right now."
            
        return {
            "content": str(response_text).strip(),
            "tool_calls": []
        }

    def stream_chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None, **kwargs):
        safe_messages = []
        for msg in messages:
            if msg["role"] in ["user", "assistant", "system"]:
                safe_messages.append({"role": msg["role"], "content": str(msg.get("content", ""))})

        response = g4f.ChatCompletion.create(
            model=self.model,
            messages=safe_messages,
            stream=True
        )
        
        for chunk in response:
            if chunk:
                yield json.dumps({"type": "content", "content": chunk}) + "\n"
