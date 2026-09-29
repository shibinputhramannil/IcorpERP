import json
from typing import List, Dict, Any, Optional
from .base import BaseAIProvider

class MockProvider(BaseAIProvider):
    def __init__(self, **kwargs):
        pass

    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None, **kwargs) -> Dict[str, Any]:
        last_message = messages[-1]["content"].lower()
        
        user = kwargs.get("user")
        company_id = kwargs.get("company_id")
        
        # Personalized greetings based on user
        if any(greet in last_message for greet in ["hy", "hi", "hello", "hey"]):
            name = user.first_name if user and user.first_name else (user.email.split("@")[0] if user else "there")
            return {
                "content": f"Hi {name.capitalize()}, how can I help you?",
                "tool_calls": []
            }
        
        # Determine if we should call a tool based on keywords
        tool_calls = []
        if "sales" in last_message and tools:
            tool_calls.append({
                "id": "call_mock_sales",
                "name": "get_sales_metrics",
                "arguments": {}
            })
            return {"content": "", "tool_calls": tool_calls}
            
        if "export" in last_message or "pdf" in last_message or "excel" in last_message:
            format_type = "pdf"
            if "excel" in last_message or "xlsx" in last_message:
                format_type = "xlsx"
            if "csv" in last_message:
                format_type = "csv"
                
            tool_calls.append({
                "id": "call_mock_export",
                "name": "generate_export",
                "arguments": {"report_type": "sales", "format": format_type}
            })
            return {"content": "", "tool_calls": tool_calls}

        # If it's the second pass (after a tool call), the last message will be tool role
        if messages[-1]["role"] == "tool" or messages[-1]["role"] == "function":
            return {"content": "Here is the data you requested based on the tool execution!", "tool_calls": []}

        # Default conversational response
        return {
            "content": f"I am your local intelligent Copilot! You said: '{last_message}'. Try asking me about 'sales' or to 'export a pdf' to see my capabilities!",
            "tool_calls": []
        }

    def stream_chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None, **kwargs):
        # We can simulate streaming by yielding words
        response = self.chat(messages, tools, **kwargs)
        if response.get("tool_calls"):
            yield json.dumps({"type": "tool_calls", "tool_calls": response["tool_calls"]}) + "\n"
        else:
            words = response.get("content", "").split(" ")
            for word in words:
                yield json.dumps({"type": "content", "content": word + " "}) + "\n"
