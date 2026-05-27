import asyncio
import json
import requests

from app.config import settings


async def chat(messages: list[dict[str, str]], max_tokens: int = 4096) -> str:
    system = messages[0]["content"] if messages[0]["role"] == "system" else ""
    user_messages = messages if system else messages[1:]

    def _sync_call():
        payload = {
            "model": settings.ANTHROPIC_MODEL,
            "max_tokens": max_tokens,
            "messages": [{"role": m["role"], "content": m["content"]} for m in user_messages],
        }
        if system:
            payload["system"] = system

        resp = requests.post(
            settings.ANTHROPIC_BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.ANTHROPIC_AUTH_TOKEN}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()

        # 检查 API 错误（如配额用尽）
        base_resp = data.get("base_resp", {})
        if base_resp.get("status_code", 0) != 0:
            raise Exception(f"AI API 错误: {base_resp.get('status_msg', '未知错误')}")

        # MiniMax returns content in choices[0].message.content
        choices = data.get("choices") or []
        if not choices:
            raise Exception("AI API 返回为空，请检查 API 配额")
        return choices[0].get("message", {}).get("content", "")

    return await asyncio.to_thread(_sync_call)
