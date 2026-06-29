from sentinel.agent.retriever import reciprocal_rank_fusion


def test_rrf_promotes_docs_ranked_high_in_both_lists():
    dense = ["a", "b", "c"]
    sparse = ["b", "a", "d"]

    fused = [doc_id for doc_id, _ in reciprocal_rank_fusion([dense, sparse])]

    # 'a' and 'b' rank highly in both lists → they take the top two slots.
    assert set(fused[:2]) == {"a", "b"}


def test_rrf_scores_are_additive_across_lists():
    fused = dict(reciprocal_rank_fusion([["x"], ["x"]], k=60))

    assert fused["x"] == 2 * (1 / (60 + 1))


def test_rrf_handles_disjoint_lists():
    fused = [doc_id for doc_id, _ in reciprocal_rank_fusion([["a"], ["b"]])]

    assert set(fused) == {"a", "b"}
