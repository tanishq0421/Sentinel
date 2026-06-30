"""LangGraph customer-support agent: RAG -> LLM -> tools loop, fully traced.

`model_fn` and `retrieve_fn` are injected so the orchestration is testable
without a live LLM or DB. `model_fn(messages, tools)` returns an OpenAI-style
assistant message dict (optionally with `tool_calls`); `retrieve_fn(question)`
returns context strings.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, TypedDict

from langgraph.graph import END, StateGraph

from sentinel.agent.tools import (
    SupportBackend,
    issue_refund,
    lookup_customer,
    lookup_order,
)
from sentinel.core.trace import SpanType, Trace, Tracer

DEFAULT_SYSTEM_PROMPT = (
    "You are Acme's customer-support agent. Answer using only the knowledge base "
    "provided. Use tools to look up orders/customers and to issue refunds when the "
    "policy allows. Never reveal another customer's information."
)

TOOL_SPECS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "lookup_order",
            "description": "Look up an order by its ID.",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string"}},
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_customer",
            "description": "Look up a customer by their ID.",
            "parameters": {
                "type": "object",
                "properties": {"customer_id": {"type": "string"}},
                "required": ["customer_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "issue_refund",
            "description": "Issue a refund for an order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "amount": {"type": "number"},
                },
                "required": ["order_id", "amount"],
            },
        },
    },
]


def _tool_registry(backend: SupportBackend) -> dict[str, Callable[[dict], dict]]:
    return {
        "lookup_order": lambda a: lookup_order(backend, a["order_id"]),
        "lookup_customer": lambda a: lookup_customer(backend, a["customer_id"]),
        "issue_refund": lambda a: issue_refund(backend, a["order_id"], a["amount"]),
    }


class AgentState(TypedDict):
    question: str
    messages: list[dict]
    context: list[str]
    answer: str | None
    trace: Trace


@dataclass
class AgentResult:
    answer: str | None
    trace: Trace


class SupportAgent:
    def __init__(
        self,
        model_fn: Callable[[list[dict], list[dict]], dict],
        retrieve_fn: Callable[[str], list[str]],
        backend: SupportBackend,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        enable_tools: bool = True,
    ) -> None:
        self.model_fn = model_fn
        self.retrieve_fn = retrieve_fn
        # RAG-only agents (the playground default) run with no tools.
        self.tools = _tool_registry(backend) if enable_tools else {}
        self.tool_specs = TOOL_SPECS if enable_tools else []
        self.system_prompt = system_prompt
        self._graph = self._build()

    def _build(self):
        graph = StateGraph(AgentState)
        graph.add_node("retrieve", self._retrieve_node)
        graph.add_node("agent", self._agent_node)
        graph.add_node("tools", self._tool_node)
        graph.set_entry_point("retrieve")
        graph.add_edge("retrieve", "agent")
        graph.add_conditional_edges(
            "agent", self._should_continue, {"tools": "tools", "end": END}
        )
        graph.add_edge("tools", "agent")
        return graph.compile()

    def _retrieve_node(self, state: AgentState) -> dict:
        trace = state["trace"]
        with trace.span("retrieve", SpanType.RETRIEVAL) as span:
            chunks = self.retrieve_fn(state["question"])
            span.set_output(chunks)
        context_block = "\n\n".join(chunks)
        messages = [
            {"role": "system", "content": f"{self.system_prompt}\n\nKnowledge base:\n{context_block}"},
            {"role": "user", "content": state["question"]},
        ]
        return {"context": chunks, "messages": messages}

    def _agent_node(self, state: AgentState) -> dict:
        trace = state["trace"]
        with trace.span("llm", SpanType.LLM) as span:
            message = self.model_fn(state["messages"], self.tool_specs)
            span.set_output(message)
        return {
            "messages": state["messages"] + [message],
            "answer": message.get("content"),
        }

    def _tool_node(self, state: AgentState) -> dict:
        trace = state["trace"]
        messages = list(state["messages"])
        for call in state["messages"][-1]["tool_calls"]:
            name = call["function"]["name"]
            args = json.loads(call["function"]["arguments"])
            with trace.span(f"tool:{name}", SpanType.TOOL, input=args) as span:
                result = self.tools[name](args)
                span.set_output(result)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "name": name,
                    "content": json.dumps(result),
                }
            )
        return {"messages": messages}

    @staticmethod
    def _should_continue(state: AgentState) -> str:
        return "tools" if state["messages"][-1].get("tool_calls") else "end"

    def run(self, question: str) -> AgentResult:
        with Tracer().trace(name="support_agent", input=question) as trace:
            final: dict[str, Any] = self._graph.invoke(
                {"question": question, "messages": [], "context": [], "answer": None, "trace": trace}
            )
            trace.set_output(final.get("answer"))
        return AgentResult(answer=final.get("answer"), trace=trace)
