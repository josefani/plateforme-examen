from __future__ import annotations

from decimal import Decimal


def serialize_datetime(value):
    return value.isoformat() if value else None


def serialize_decimal(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value
