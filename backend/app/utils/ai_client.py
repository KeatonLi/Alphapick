import asyncio
import json
import requests

from app.config import settings


async def chat(messages: list[dict[str, str]], max_tokens: int = 4096) -> str:
    system = messages[0]["content"] if messages[0]["role"] == "system" else ""
    user_messages = messages if system else messages[1:]

    def _sync_call():
        payload = {
            "model": settings.LLM_MODEL,
            "max_tokens": max_tokens,
            "messages": [{"role": m["role"], "content": m["content"]} for m in user_messages],
        }
        if system:
            payload["system"] = system

        resp = requests.post(
            settings.LLM_BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.LLM_AUTH_TOKEN}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        # DeepSeek returns content in choices[0].message.content
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    return await asyncio.to_thread(_sync_call)
