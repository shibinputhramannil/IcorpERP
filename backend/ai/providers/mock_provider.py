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
        
        # Dynamic Tool Matching Engine
        tool_calls = []
        if tools:
            for tool in tools:
                if isinstance(tool, dict) and "name" in tool:
                    name = tool["name"].lower()
                    desc = tool.get("description", "").lower()
                    
                    # Create a set of keywords from the tool name (e.g. get_sales_metrics -> get, sales, metrics)
                    keywords = set(name.replace("_", " ").split())
                    
                    # Add common synonyms
                    if "lead" in name or "crm" in name:
                        keywords.update(["leads", "customer", "prospect"])
                    if "sale" in name or "invoice" in name:
                        keywords.update(["sales", "revenue", "invoices", "money"])
                    if "export" in name:
                        keywords.update(["pdf", "excel", "csv", "download", "report"])
                        
                    # Check if any keywords match the user's message
                    if any(kw in last_message for kw in keywords if len(kw) > 3 or kw in ["pdf", "csv"]):
                        args = {}
                        if "export" in name:
                            format_type = "pdf"
                            if "excel" in last_message or "xlsx" in last_message:
                                format_type = "xlsx"
                            if "csv" in last_message:
                                format_type = "csv"
                            args = {"report_type": "summary", "format": format_type}
                            
                        tool_calls.append({
                            "id": f"call_mock_{name}",
                            "name": tool["name"],
                            "arguments": args
                        })
                        
                        return {
                            "content": f"I am executing the {tool['name']} process for you now...",
                            "tool_calls": tool_calls
                        }

        # If it's the second pass (after a tool call), the last message will be tool role
        if messages[-1]["role"] == "tool" or messages[-1]["role"] == "function":
            return {"content": "Here is the dynamic data retrieved from your ERP system based on your request! I have analyzed the module and everything looks perfectly on track.", "tool_calls": []}

        # Default conversational response
        return {
            "content": f"I am your local intelligent Copilot! You said: '{last_message}'. Try asking me about 'leads', 'sales', or to 'export a pdf' to see my dynamic capabilities!",
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
