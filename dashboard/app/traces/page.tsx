"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, TraceSummary } from "@/lib/api";
import { Panel, PageHeader } from "@/components/ui";

export default function TracesPage() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.traces().then(setTraces).catch((e) => setErr(String(e)));
  }, []);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900 }}>
      <PageHeader title="Traces" sub="sentinel // execution traces from eval & red-team runs" />

      {err && (
        <div className="panel" style={{ padding: 12, marginBottom: 12, borderColor: "var(--bad)" }}>
          <span className="mono" style={{ color: "var(--bad)", fontSize: 11 }}>API unreachable — is the stack running?</span>
        </div>
      )}

      {!err && traces.length === 0 && (
        <Panel>
          <div style={{ padding: "30px 0", textAlign: "center" }}>
            <p className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>No traces yet. Run an eval or red-team from an agent to generate traces.</p>
            <Link href="/agents" className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>Go to playground →</Link>
          </div>
        </Panel>
      )}

      {traces.length > 0 && (
        <Panel title={`${traces.length} traces`} code="▸">
          <div style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 80px", padding: "8px 12px", background: "var(--panel-2)", borderBottom: "1px solid var(--border)" }}>
              <span className="label" style={{ fontSize: 9 }}>Input</span>
              <span className="label" style={{ fontSize: 9 }}>Kind</span>
              <span className="label" style={{ fontSize: 9, textAlign: "center" }}>Spans</span>
              <span className="label" style={{ fontSize: 9, textAlign: "right" }}>Duration</span>
            </div>
            {traces.map((t, i) => (
              <Link key={t.id} href={`/traces/${t.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 80px", padding: "8px 12px", alignItems: "center", borderBottom: i < traces.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {typeof t.input === "string" ? t.input.slice(0, 80) : t.name.slice(0, 80)}
                </span>
                <span className={`badge ${t.kind === "eval" ? "accent" : t.kind === "redteam" ? "bad" : ""}`} style={{ fontSize: 10 }}>
                  {t.kind ?? "—"}
                </span>
                <span className="mono" style={{ fontSize: 11, textAlign: "center", color: "var(--muted)" }}>{t.span_count}</span>
                <span className="mono" style={{ fontSize: 11, textAlign: "right", color: "var(--muted)" }}>
                  {t.duration_ms ? `${Math.round(t.duration_ms)}ms` : "—"}
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
