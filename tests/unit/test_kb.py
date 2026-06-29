from sentinel.agent.kb import load_kb_articles


def test_loads_all_articles_as_documents():
    docs = load_kb_articles("datasets/kb/articles.json")

    assert len(docs) == 10
    by_id = {d.id for d in docs}
    assert "kb-refunds" in by_id
    assert "kb-privacy" in by_id


def test_document_content_includes_title_and_body():
    docs = {d.id: d for d in load_kb_articles("datasets/kb/articles.json")}

    refund = docs["kb-refunds"]
    assert "Refund Policy" in refund.content  # title is searchable
    assert "30 days" in refund.content  # body is searchable
