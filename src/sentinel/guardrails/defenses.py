"""Guardrails against indirect prompt injection.

- spotlight_retrieve: data-marking — wrap untrusted context so the model treats
  it as data, not instructions (prompt-level defense).
- pii_egress_filter: output filter — redact emails not belonging to the
  requesting customer (deterministic defense against PII exfiltration).
- (tool confirmation lives on SupportBackend.require_refund_confirmation.)
"""

from __future__ import annotations

import re
from typing import Callable, Iterable

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def spotlight_retrieve(
    base_retrieve_fn: Callable[[str], list[str]],
) -> Callable[[str], list[str]]:
    def retrieve(question: str) -> list[str]:
        return [
            f"<untrusted_data>\n{chunk}\n</untrusted_data>"
            for chunk in base_retrieve_fn(question)
        ]

    return retrieve


def pii_egress_filter(answer: str | None, allowed: Iterable[str]) -> str | None:
    if not answer:
        return answer
    allowed_set = {e.lower() for e in allowed}
    return _EMAIL_RE.sub(
        lambda m: m.group(0) if m.group(0).lower() in allowed_set else "[REDACTED]",
        answer,
    )
