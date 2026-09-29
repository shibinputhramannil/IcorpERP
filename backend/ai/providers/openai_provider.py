import json
from typing import List, Dict, Any, Optional
from django.conf import settings
from .base import BaseAIProvider

try:
    import openai
except ImportError:
    openai = None

class OpenAIProvider(BaseAIProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or getattr(settings, "OPENAI_API_KEY", None)
        if not self.api_key:
            raise ValueError("OpenAI API key is missing.")
        if openai is None:
            raise ImportError("openai package is not installed.")
        self.client = openai.OpenAI(api_key=self.api_key)
        self.model = getattr(settings, "OPENAI_MODEL", "gpt-4o")

    def _format_tools(self, tools: List[Any]) -> List[Dict[str, Any]]:
        if not tools:
            return None
        formatted = []
        for tool in tools:
            # Assumes tool is a dict following OpenAI function schema
            if isinstance(tool, dict) and "name" in tool:
                formatted.append({"type": "function", "function": tool})
        return formatted if formatted else None

    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None) -> Dict[str, Any]:
        formatted_tools = self._format_tools(tools)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=formatted_tools,
            tool_choice="auto" if formatted_tools else None
        )
        message = response.choices[0].message
        
        tool_calls = []
        if message.tool_calls:
            for tc in message.tool_calls:
                try:
                    arguments = json.loads(tc.function.arguments)
                except Exception:
                    arguments = {}
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": arguments,
                })
        
        return {
            "content": message.content or "",
            "tool_calls": tool_calls
        }

    def stream_chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None):
        formatted_tools = self._format_tools(tools)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=formatted_tools,
            tool_choice="auto" if formatted_tools else None,
            stream=True
        )
        
        for chunk in response:
            delta = chunk.choices[0].delta
            
            # Simple content streaming mapping, full tool streaming requires more complex buffering
            # For simplicity in this implementation, we yield content chunks
            if delta.content:
                yield json.dumps({"type": "content", "content": delta.content}) + "\n"
            
            # Note: comprehensive tool call streaming implementation omitted for brevity,
            # would require buffering tool call chunks and yielding when complete.
