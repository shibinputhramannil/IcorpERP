import json
from typing import List, Dict, Any, Optional
from django.conf import settings
from .base import BaseAIProvider

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

class GroqProvider(BaseAIProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or getattr(settings, "GROQ_API_KEY", None)
        if not self.api_key:
            raise ValueError("Groq API key is missing. Please add it to your .env file as GROQ_API_KEY.")
        if OpenAI is None:
            raise ImportError("openai package is not installed.")
            
        # Groq uses the OpenAI SDK format with a custom base_url
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.groq.com/openai/v1"
        )
        self.model = getattr(settings, "GROQ_MODEL", "llama3-70b-8192")

    def _format_tools(self, tools: List[Any]) -> List[Dict[str, Any]]:
        if not tools:
            return None
        formatted = []
        for tool in tools:
            if isinstance(tool, dict) and "name" in tool:
                formatted.append({"type": "function", "function": tool})
        return formatted if formatted else None

    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None, **kwargs) -> Dict[str, Any]:
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

    def stream_chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None, **kwargs):
        formatted_tools = self._format_tools(tools)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=formatted_tools,
            tool_choice="auto" if formatted_tools else None,
            stream=True
        )
        
        for chunk in response:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            
            if delta.content:
                yield json.dumps({"type": "content", "content": delta.content}) + "\n"
