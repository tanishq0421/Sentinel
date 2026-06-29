from sentinel.evals.retrieval import recall_at_k


def test_recall_is_one_when_expected_in_top_k():
    assert recall_at_k(["a", "b", "c"], ["a"], k=3) == 1.0


def test_recall_is_zero_when_expected_missing():
    assert recall_at_k(["x", "y"], ["a"], k=2) == 0.0


def test_recall_respects_k_cutoff():
    # 'a' is at rank 2, so recall@1 misses it.
    assert recall_at_k(["x", "a"], ["a"], k=1) == 0.0


def test_recall_is_partial_when_some_expected_found():
    assert recall_at_k(["a", "x"], ["a", "b"], k=2) == 0.5
