"""Unit tests for API keys utility functions."""

from datetime import UTC, datetime

from src.app.support.api_keys.utils import (
    _add_usage_record,
    _empty_daily_usage,
    _usage_datetime,
    calculate_basic_metrics,
    calculate_daily_usage,
    calculate_endpoint_usage,
    calculate_error_breakdown,
    calculate_response_time_metrics,
    parse_usage_records,
)


def test_calculate_basic_metrics_empty():
    res = calculate_basic_metrics([])
    assert res == {
        "total_requests": 0,
        "successful_requests": 0,
        "failed_requests": 0,
        "total_tokens": 0,
        "total_cost": 0,
    }


def test_calculate_basic_metrics_mixed():
    records = [
        {"status_code": 200, "tokens_used": 10, "cost_microcents": 100},
        {"status_code": 201, "tokens_used": None, "cost_microcents": None},
        {"status_code": 400, "tokens_used": 5, "cost_microcents": 50},
        {"status_code": 500},
        "not_a_dict",
        None,
    ]
    res = calculate_basic_metrics(records)
    assert res["total_requests"] == 6
    assert res["successful_requests"] == 2
    assert res["failed_requests"] == 4
    assert res["total_tokens"] == 15
    assert res["total_cost"] == 150


def test_calculate_response_time_metrics_empty():
    assert calculate_response_time_metrics([]) is None
    assert calculate_response_time_metrics([{"response_time_ms": None}]) is None
    assert calculate_response_time_metrics(["invalid"]) is None


def test_calculate_response_time_metrics_valid():
    records = [
        {"response_time_ms": 100.0},
        {"response_time_ms": 200.0},
        {"response_time_ms": None},
        "invalid",
    ]
    avg = calculate_response_time_metrics(records)
    assert avg == 150.0


def test_calculate_endpoint_usage_empty():
    assert calculate_endpoint_usage([]) == []


def test_calculate_endpoint_usage_sorted_and_limited():
    records = [
        {"endpoint": "/api/v1/a"},
        {"endpoint": "/api/v1/b"},
        {"endpoint": "/api/v1/a"},
        {"endpoint": "/api/v1/c"},
        {"endpoint": "/api/v1/a"},
        {"endpoint": "/api/v1/b"},
        "invalid",
    ]
    res = calculate_endpoint_usage(records, limit=2)
    assert len(res) == 2
    assert res[0] == {"endpoint": "/api/v1/a", "count": 3}
    assert res[1] == {"endpoint": "/api/v1/b", "count": 2}


def test_calculate_error_breakdown_empty():
    assert calculate_error_breakdown([]) == {}


def test_calculate_error_breakdown_counts():
    records = [
        {"status_code": 200},
        {"status_code": 400},
        {"status_code": 404},
        {"status_code": 400},
        {"status_code": 500},
        "invalid",
    ]
    res = calculate_error_breakdown(records)
    assert res == {
        "400": 2,
        "404": 1,
        "500": 1,
    }


def test_usage_datetime_datetime_obj():
    now = datetime.now(UTC)
    assert _usage_datetime({"created_at": now}) == now


def test_usage_datetime_iso_strings():
    dt = _usage_datetime({"created_at": "2026-08-10T12:00:00Z"})
    assert dt is not None
    assert dt.year == 2026
    assert dt.month == 8
    assert dt.day == 10

    dt2 = _usage_datetime({"created_at": "2026-08-10T12:00:00+00:00"})
    assert dt2 is not None


def test_usage_datetime_invalid():
    assert _usage_datetime({}) is None
    assert _usage_datetime({"created_at": 12345678}) is None
    assert _usage_datetime({"created_at": "invalid-date-string"}) is None


def test_empty_daily_usage():
    day = _empty_daily_usage("2026-08-10")
    assert day == {
        "date": "2026-08-10",
        "requests": 0,
        "successful_requests": 0,
        "failed_requests": 0,
        "tokens": 0,
        "cost_microcents": 0,
    }


def test_add_usage_record():
    day = _empty_daily_usage("2026-08-10")
    _add_usage_record(
        day,
        {
            "status_code": 200,
            "tokens_used": 50,
            "cost_microcents": 1000,
        },
    )
    assert day["requests"] == 1
    assert day["successful_requests"] == 1
    assert day["failed_requests"] == 0
    assert day["tokens"] == 50
    assert day["cost_microcents"] == 1000

    _add_usage_record(
        day,
        {
            "status_code": 500,
            "tokens_used": None,
            "cost_microcents": None,
        },
    )
    assert day["requests"] == 2
    assert day["successful_requests"] == 1
    assert day["failed_requests"] == 1
    assert day["tokens"] == 50
    assert day["cost_microcents"] == 1000


def test_calculate_daily_usage():
    records = [
        {
            "created_at": "2026-08-10T10:00:00Z",
            "status_code": 200,
            "tokens_used": 10,
            "cost_microcents": 100,
        },
        {
            "created_at": "2026-08-10T11:00:00Z",
            "status_code": 404,
            "tokens_used": 5,
            "cost_microcents": 50,
        },
        {
            "created_at": "2026-08-09T08:00:00Z",
            "status_code": 201,
            "tokens_used": 20,
            "cost_microcents": 200,
        },
        {"created_at": "invalid"},
        "not_a_dict",
    ]
    daily = calculate_daily_usage(records)
    assert len(daily) == 2
    assert daily[0]["date"] == "2026-08-09"
    assert daily[0]["requests"] == 1
    assert daily[1]["date"] == "2026-08-10"
    assert daily[1]["requests"] == 2
    assert daily[1]["successful_requests"] == 1
    assert daily[1]["failed_requests"] == 1


def test_parse_usage_records():
    assert parse_usage_records(None) == []
    assert parse_usage_records({}) == []
    assert parse_usage_records({"data": "not a list"}) == []
    assert parse_usage_records({"data": [{"id": 1}]}) == [{"id": 1}]
