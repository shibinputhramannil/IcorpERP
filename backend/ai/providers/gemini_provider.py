import json
from typing import List, Dict, Any, Optional
from django.conf import settings
from .base import BaseAIProvider

try:
    import google.generativeai as genai
except ImportError:
    genai = None

class GeminiProvider(BaseAIProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", None)
        if not self.api_key:
            raise ValueError("Gemini API key is missing.")
        if genai is None:
            raise ImportError("google-generativeai package is not installed.")
        genai.configure(api_key=self.api_key)
        self.model_name = getattr(settings, "GEMINI_MODEL", "gemini-flash-latest")

    def _convert_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Converts OpenAI format to Gemini format
        gemini_messages = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            gemini_messages.append({
                "role": role,
                "parts": [msg.get("content", "")]
            })
        return gemini_messages

    def _format_tools(self, tools: List[Any]) -> List[Any]:
        # Converts simplified function schema to Gemini Tool definition
        # Placeholder for Gemini tool conversion logic
        return tools if tools else None

    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None) -> Dict[str, Any]:
        # Temporarily disabling tools for Gemini to avoid JSON schema parsing KeyError
        model = genai.GenerativeModel(model_name=self.model_name)
        gemini_messages = self._convert_messages(messages)
        
        response = model.generate_content(gemini_messages)
        
        # Parse potential function calls from response
        # Gemini handles function calls differently, simplifying for now
        tool_calls = []
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    args = {k: v for k, v in part.function_call.args.items()}
                    tool_calls.append({
                        "id": f"call_{part.function_call.name}",
                        "name": part.function_call.name,
                        "arguments": args
                    })
        
        content = ""
        try:
            content = response.text
        except ValueError:
            pass
            
        return {
            "content": content,
            "tool_calls": tool_calls
        }

    def stream_chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None):
        model = genai.GenerativeModel(model_name=self.model_name)
        gemini_messages = self._convert_messages(messages)
        
        response = model.generate_content(gemini_messages, stream=True)
        
        for chunk in response:
            try:
                if chunk.text:
                    yield json.dumps({"type": "content", "content": chunk.text}) + "\n"
            except ValueError:
                pass
