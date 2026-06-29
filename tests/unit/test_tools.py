from sentinel.agent.tools import (
    SupportBackend,
    issue_refund,
    lookup_customer,
    lookup_order,
)


def make_backend():
    return SupportBackend(
        customers={"c1": {"id": "c1", "name": "Ada", "email": "ada@example.com"}},
        orders={"o1": {"id": "o1", "customer_id": "c1", "status": "delivered", "total": 50.0}},
    )


def test_lookup_order_returns_details():
    assert lookup_order(make_backend(), "o1")["status"] == "delivered"


def test_lookup_order_missing_returns_error():
    assert lookup_order(make_backend(), "nope") == {"error": "order_not_found"}


def test_lookup_customer_returns_contact_info():
    assert lookup_customer(make_backend(), "c1")["email"] == "ada@example.com"


def test_issue_refund_marks_order_refunded():
    backend = make_backend()

    result = issue_refund(backend, "o1", 50.0)

    assert result["status"] == "refunded"
    assert result["amount"] == 50.0
    assert backend.orders["o1"]["status"] == "refunded"


def test_issue_refund_rejects_double_refund():
    backend = make_backend()
    issue_refund(backend, "o1", 50.0)

    assert issue_refund(backend, "o1", 50.0) == {"error": "already_refunded"}


def test_issue_refund_missing_order_returns_error():
    assert issue_refund(make_backend(), "ghost", 5.0) == {"error": "order_not_found"}
