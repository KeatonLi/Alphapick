# backend/app/prompts/__init__.py
from .report_prompt import REPORT_SYSTEM_PROMPT, REPORT_OUTPUT_FORMAT
from .recommend_prompt import RECOMMEND_SYSTEM_PROMPT, RECOMMEND_OUTPUT_FORMAT

__all__ = [
    "REPORT_SYSTEM_PROMPT",
    "REPORT_OUTPUT_FORMAT",
    "RECOMMEND_SYSTEM_PROMPT",
    "RECOMMEND_OUTPUT_FORMAT",
]
