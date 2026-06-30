"""Structured trace model: one agent run as an ordered list of spans.

The whole framework reads these traces — the dashboard renders them, and evals
and red-team attacks both operate over the same trace objects.
"""

from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from enum import Enum
from typing import Any, Iterator


class SpanType(str, Enum):
    RETRIEVAL = "retrieval"
    LLM = "llm"
    TOOL = "tool"


class Span:
    def __init__(self, name: str, type: SpanType, input: Any = None) -> None:
        self.id = uuid.uuid4().hex
        self.name = name
        self.type = type
        self.input = input
        self.output: Any = None
        self.duration_ms: float | None = None

    def set_output(self, output: Any) -> None:
        self.output = output

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "input": self.input,
            "output": self.output,
            "duration_ms": self.duration_ms,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Span":
        span = cls(name=d["name"], type=SpanType(d["type"]), input=d.get("input"))
        span.id = d["id"]
        span.output = d.get("output")
        span.duration_ms = d.get("duration_ms")
        return span


class Trace:
    def __init__(self, name: str, input: Any = None, agent_id: str | None = None, kind: str | None = None) -> None:
        self.id = uuid.uuid4().hex
        self.name = name
        self.input = input
        self.output: Any = None
        self.duration_ms: float | None = None
        self.spans: list[Span] = []
        self.agent_id = agent_id
        self.kind = kind

    def set_output(self, output: Any) -> None:
        self.output = output

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "input": self.input,
            "output": self.output,
            "duration_ms": self.duration_ms,
            "spans": [s.to_dict() for s in self.spans],
        }
        if self.agent_id is not None:
            d["agent_id"] = self.agent_id
        if self.kind is not None:
            d["kind"] = self.kind
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Trace":
        trace = cls(name=d["name"], input=d.get("input"),
                    agent_id=d.get("agent_id"), kind=d.get("kind"))
        trace.id = d["id"]
        trace.output = d.get("output")
        trace.duration_ms = d.get("duration_ms")
        trace.spans = [Span.from_dict(s) for s in d.get("spans", [])]
        return trace

    @contextmanager
    def span(self, name: str, type: SpanType, input: Any = None) -> Iterator[Span]:
        span = Span(name, type, input)
        self.spans.append(span)
        start = time.perf_counter()
        try:
            yield span
        finally:
            span.duration_ms = (time.perf_counter() - start) * 1000


class Tracer:
    @contextmanager
    def trace(self, name: str, input: Any = None) -> Iterator[Trace]:
        trace = Trace(name, input)
        start = time.perf_counter()
        try:
            yield trace
        finally:
            trace.duration_ms = (time.perf_counter() - start) * 1000
