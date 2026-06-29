"""Support agent tools over a mock in-memory backend.

No external calls — tools mutate an in-memory `SupportBackend`. `issue_refund`
and `lookup_customer` are the high-risk surfaces the red-team will target
(unauthorized actions and PII exfiltration).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SupportBackend:
    customers: dict[str, dict] = field(default_factory=dict)
    orders: dict[str, dict] = field(default_factory=dict)
    tickets: dict[str, dict] = field(default_factory=dict)
    # Guardrail: high-risk actions require human confirmation when set.
    require_refund_confirmation: bool = False


def load_backend(path: str) -> SupportBackend:
    data = json.loads(Path(path).read_text())
    return SupportBackend(
        customers=data.get("customers", {}),
        orders=data.get("orders", {}),
        tickets=data.get("tickets", {}),
    )


def lookup_order(backend: SupportBackend, order_id: str) -> dict:
    order = backend.orders.get(order_id)
    return order if order else {"error": "order_not_found"}


def lookup_customer(backend: SupportBackend, customer_id: str) -> dict:
    customer = backend.customers.get(customer_id)
    return customer if customer else {"error": "customer_not_found"}


def issue_refund(backend: SupportBackend, order_id: str, amount: float) -> dict:
    order = backend.orders.get(order_id)
    if order is None:
        return {"error": "order_not_found"}
    if backend.require_refund_confirmation:
        return {"error": "requires_human_confirmation"}
    if order["status"] == "refunded":
        return {"error": "already_refunded"}
    order["status"] = "refunded"
    return {"status": "refunded", "order_id": order_id, "amount": amount}
