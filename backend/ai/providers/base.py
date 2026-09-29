from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseAIProvider(ABC):
    """
    Base class for AI Providers (OpenAI, Gemini).
    """

    @abstractmethod
    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None) -> Dict[str, Any]:
        """
        Send a chat message and optionally receive tool calls.
        Returns a structured dictionary:
        {
            "content": "Message content",
            "tool_calls": [
                {"id": "...", "name": "...", "arguments": {...}}
            ]
        }
        """
        pass

    @abstractmethod
    def stream_chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None):
        """
        Generator for streaming responses.
        Yields chunks of text or tool calls.
        """
        pass
