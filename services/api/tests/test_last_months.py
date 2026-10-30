"""Monthly charts must list each calendar month once, in order."""
import datetime

from shipments.api_views import _last_months


def test_twelve_distinct_months_ending_now():
    months = _last_months(datetime.datetime(2026, 10, 30))
    assert len(months) == 12 == len(set(months))
    assert months[0] == datetime.date(2025, 11, 1)
    assert months[-1] == datetime.date(2026, 10, 1)


def test_crosses_year_boundary():
    assert _last_months(datetime.date(2026, 2, 15), 3) == [
        datetime.date(2025, 12, 1), datetime.date(2026, 1, 1), datetime.date(2026, 2, 1),
    ]
