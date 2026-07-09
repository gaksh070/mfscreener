"""Validation gates. Per architecture doc §3: any gate failure -> job exits
non-zero, no partial artifact commit, site keeps serving last-good data."""
from __future__ import annotations

from .common import JobError


def validate_universe_coverage(matched: int, previous_universe_size: int | None, min_pct: float = 98.0) -> None:
    if previous_universe_size is None or previous_universe_size == 0:
        return  # first run ever - nothing to compare against
    pct = 100 * matched / previous_universe_size
    if pct < min_pct:
        raise JobError(
            f"scheme-code coverage {pct:.1f}% of previous universe "
            f"({matched}/{previous_universe_size}) is below the {min_pct}% gate"
        )


def validate_row_count_delta(today_count: int, previous_count: int | None, max_pct: float = 5.0) -> None:
    if previous_count is None or previous_count == 0:
        return
    delta_pct = 100 * abs(today_count - previous_count) / previous_count
    if delta_pct > max_pct:
        raise JobError(
            f"today's canonical-universe row count ({today_count}) differs from "
            f"yesterday's ({previous_count}) by {delta_pct:.1f}%, exceeding the {max_pct}% gate"
        )


def validate_nav_value(scheme_code: str, nav: float) -> None:
    if nav is None or nav <= 0:
        raise JobError(f"scheme {scheme_code}: NAV {nav!r} is not > 0")


def validate_day_over_day(scheme_code: str, prev_nav: float | None, new_nav: float, max_pct: float = 30.0) -> None:
    if prev_nav is None or prev_nav <= 0:
        return
    change_pct = 100 * abs(new_nav - prev_nav) / prev_nav
    if change_pct > max_pct:
        raise JobError(
            f"scheme {scheme_code}: day-over-day NAV change {change_pct:.1f}% "
            f"({prev_nav} -> {new_nav}) exceeds the {max_pct}% sanity gate"
        )


def validate_holdings_weights(scheme_code: str, total_weight: float, low: float = 97.0, high: float = 103.0) -> None:
    if not (low <= total_weight <= high):
        raise JobError(
            f"scheme {scheme_code}: holdings weights sum to {total_weight:.1f}%, "
            f"outside the [{low}, {high}] gate"
        )
