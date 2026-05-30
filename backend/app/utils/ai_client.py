import asyncio
import json
import requests

from app.config import settings


async def chat(messages: list[dict[str, str]], max_tokens: int = 4096) -> str:
    def _sync_call():
        all_messages = [{"role": m["role"], "content": m["content"]} for m in messages]
        payload = {
            "model": settings.LLM_MODEL,
            "max_tokens": max_tokens,
            "messages": all_messages,
        }

        base = settings.LLM_BASE_URL.rstrip("/")
        resp = requests.post(
            f"{base}/chat/completions",
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
