"""Production wiring: build a SupportAgent backed by real LiteLLM + hybrid RAG.

The agent's orchestration lives in graph.py; this module supplies the real
`model_fn` (LiteLLM tool-calling) and `retrieve_fn` (HybridRetriever).
"""

from __future__ import annotations

from typing import Callable

import litellm

from sentinel.agent.graph import SupportAgent
from sentinel.agent.kb import openai_embedder
from sentinel.agent.retriever import HybridRetriever
from sentinel.agent.tools import SupportBackend
from sentinel.core.llm import DEFAULT_AGENT_MODEL, EMBED_DIM


def litellm_model_fn(model: str) -> Callable[[list[dict], list[dict]], dict]:
    """Return a model_fn that calls a tool-capable chat model via LiteLLM."""

    def model_fn(messages: list[dict], tools: list[dict]) -> dict:
        response = litellm.completion(model=model, messages=messages, tools=tools)
        return response.choices[0].message.model_dump()

    return model_fn


def build_support_agent(
    dsn: str,
    backend: SupportBackend,
    model: str = DEFAULT_AGENT_MODEL,
    table: str = "kb_documents",
) -> SupportAgent:
    retriever = HybridRetriever(dsn, embed_fn=openai_embedder, dim=EMBED_DIM, table=table)

    def retrieve_fn(question: str) -> list[str]:
        return [doc.content for doc in retriever.search(question, k=4)]

    return SupportAgent(
        model_fn=litellm_model_fn(model),
        retrieve_fn=retrieve_fn,
        backend=backend,
    )
