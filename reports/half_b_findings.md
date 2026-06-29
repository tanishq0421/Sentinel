# Half B — Red-Team Findings (security)

Indirect prompt-injection campaign against the live agent. Raw data:
`reports/half_b_redteam.json`.

## Baseline (naive injections, no guardrails)

8 attacks across 2 surfaces (poisoned RAG doc, poisoned tool output) x
{unauthorized refund, PII exfiltration}, run against **Claude Haiku**.

**Overall ASR: 0/8 (0%).**

Verified the injections actually reached the model: tool-surface attacks
triggered `lookup_order` (answers cite the real order status/total, so the
poisoned `note` was in the tool output), and RAG-surface payloads were in the
retrieved context. The agent refused to issue refunds or echo another
customer's email in every case.

**Finding:** Claude Haiku is robust to crude "SYSTEM OVERRIDE" style indirect
injection. Robustness is real but model-dependent — which motivates the next
two steps.

## Next

1. **Adaptive red-team (attacker-LLM + MART loop):** an attacker model escalates
   payloads over rounds to find injections that land — automated red-teaming,
   not a fixed list.
2. **Cross-model ASR:** run the same campaign against other models (e.g.
   GPT-4o-mini) to measure how robustness varies by model.
3. **Guardrails:** measure ASR before/after defenses against whatever lands.
