"""Help-center knowledge base: load articles and seed the retriever.

The KB is the RAG corpus the agent grounds answers in, the ground truth for
groundedness/policy evals, and the surface the red-team poisons.
"""

from __future__ import annotations

import json
from pathlib import Path

from sentinel.core.llm import DEFAULT_EMBED_MODEL, embed
from sentinel.agent.retriever import Document, HybridRetriever


def load_kb_articles(path: str) -> list[Document]:
    """Load articles into Documents whose content includes title + body."""
    articles = json.loads(Path(path).read_text())
    return [
        Document(id=a["id"], content=f"{a['title']}\n{a['content']}")
        for a in articles
    ]


def openai_embedder(text: str) -> list[float]:
    """Production embedder wired to the configured embedding model."""
    return embed(DEFAULT_EMBED_MODEL, text)


def seed_kb(retriever: HybridRetriever, path: str) -> int:
    """Embed and index every KB article; returns the number indexed."""
    docs = load_kb_articles(path)
    retriever.index(docs)
    return len(docs)
