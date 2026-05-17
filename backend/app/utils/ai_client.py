import asyncio

from anthropic import Anthropic

from app.config import settings

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(
            base_url=settings.ANTHROPIC_BASE_URL,
            api_key=settings.ANTHROPIC_AUTH_TOKEN,
        )
    return _client


async def chat(messages: list[dict[str, str]], max_tokens: int = 4096) -> str:
    client = get_client()
    system = messages[0]["content"] if messages[0]["role"] == "system" else ""
    user_messages = messages if not system else messages[1:]

    def _sync_call():
        return client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": m["role"], "content": m["content"]} for m in user_messages],
        )

    response = await asyncio.to_thread(_sync_call)

    # MiniMax returns thinking blocks first, text blocks last.
    # Collect text from all text-type content blocks.
    texts = [
        block.text for block in response.content
        if block.type == "text" and block.text
    ]
    return "\n".join(texts) if texts else ""
