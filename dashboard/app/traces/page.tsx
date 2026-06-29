"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, TraceSummary } from "@/lib/api";
import { PageHeader, Panel } from "@/components/ui";

export default function TracesPage() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.traces()
      .then(setTraces)
      .catch((e) => setErr(String(e)))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1100 }}>
      <PageHeader title="Traces" sub={`sentinel // ${traces.length} captured runs`} />
      {err && (
        <Panel>
          <span className="mono" style={{ color: "var(--bad)", fontSize: 12 }}>API unreachable: {err}</span>
        </Panel>
      )}
      <Panel style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="label"
          style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 70px 70px", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--border)" }}
        >
          <span>id</span><span>input</span><span>output</span><span>spans</span><span>ms</span>
        </div>
        {!loaded && (
          <div className="mono" style={{ padding: 18, fontSize: 12, color: "var(--muted)" }}>loading…</div>
        )}
        {loaded && !err && traces.length === 0 && (
          <div className="mono" style={{ padding: 18, fontSize: 12, color: "var(--muted)" }}>
            no traces yet — run an eval from the Overview, or `uv run sentinel ask &quot;…&quot;`
          </div>
        )}
        {traces.map((t, i) => (
          <Link
            key={t.id}
            href={`/traces/${t.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 1fr 70px 70px",
              gap: 12,
              padding: "12px 18px",
              borderBottom: "1px solid var(--border)",
              alignItems: "center",
              background: i % 2 ? "rgba(255,255,255,0.012)" : "transparent",
            }}
          >
            <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{t.id.slice(0, 8)}</span>
            <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{str(t.input)}</span>
            <span style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{str(t.output)}</span>
            <span className="mono" style={{ fontSize: 12 }}>{t.span_count}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{t.duration_ms ? Math.round(t.duration_ms) : "—"}</span>
          </Link>
        ))}
      </Panel>
    </div>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
