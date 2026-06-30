"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { RunControls } from "@/components/RunControls";

export default function RunsPage() {
  return (
    <div style={{ padding: "34px 40px", maxWidth: 900 }}>
      <PageHeader title="Acme Study — Runs" sub="sentinel // regenerate the case-study benchmarks" />

      <p className="mono" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginTop: -10, marginBottom: 18 }}>
        These jobs regenerate the built-in <b style={{ color: "var(--text)" }}>Acme</b> case study:
        <br />• <b style={{ color: "var(--accent)" }}>eval suite</b> — re-runs the agent over 15 tickets and scores groundedness / policy / refusal / tool-safety.
        <br />• <b style={{ color: "var(--bad)" }}>red-team</b> — runs the indirect-injection campaign against a model.
        <br />• <b style={{ color: "var(--warn)" }}>full red-team suite</b> — cross-model + guardrails before/after + MART.
        <br />Results feed the <Link href="/" style={{ color: "var(--accent)" }}>Overview</Link> charts. (To test <i>your own</i> agent, use the <Link href="/agents" style={{ color: "var(--accent)" }}>Playground</Link>.)
      </p>

      <RunControls />
    </div>
  );
}
