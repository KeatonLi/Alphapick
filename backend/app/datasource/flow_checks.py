"""Small, testable checks for the quant data pipeline."""

from __future__ import annotations

from datetime import date
from typing import Iterable


def evaluate_candidate_quality(
    snapshot_count: int,
    candidate_count: int,
    min_snapshot_count: int = 3000,
    min_candidate_count: int = 5,
) -> dict:
    issues = []
    if snapshot_count <= 0:
        issues.append("no normalized stock snapshot")
    elif snapshot_count < min_snapshot_count:
        issues.append(f"snapshot count below threshold: {snapshot_count} < {min_snapshot_count}")

    if candidate_count <= 0:
        issues.append("no strategy candidates")
    elif candidate_count < min_candidate_count:
        issues.append(f"candidate count below threshold: {candidate_count} < {min_candidate_count}")

    return {
        "status": "success" if not issues else "failed",
        "snapshot_count": snapshot_count,
        "candidate_count": candidate_count,
        "issues": issues,
    }


def evaluate_tracking_gaps(
    recommend_date: date,
    trade_days: Iterable[date],
    available_bar_dates: set[date],
    milestones: tuple[int, ...] = (1, 2, 3, 5, 7),
    as_of: date | None = None,
) -> dict:
    ordered_days = list(trade_days)
    needed_dates = [
        day for idx, day in enumerate(ordered_days, start=1)
        if idx in milestones
    ]
    today = as_of or date.today()
    due_dates = [day for day in needed_dates if day <= today]
    future_dates = sorted(day for day in needed_dates if day > today)
    available = sorted(day for day in due_dates if day in available_bar_dates)
    missing = sorted(day for day in due_dates if day not in available_bar_dates)
    if not due_dates:
        status = "pending"
    elif not missing:
        status = "success"
    elif available:
        status = "partial"
    else:
        status = "failed"
    return {
        "status": status,
        "recommend_date": str(recommend_date),
        "needed_dates": [str(day) for day in needed_dates],
        "available_dates": [str(day) for day in available],
        "missing_dates": [str(day) for day in missing],
        "future_dates": [str(day) for day in future_dates],
    }
