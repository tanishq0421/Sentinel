"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Panel, PageHeader } from "@/components/ui";

type Run = {
  id: string;
  agent_id: string;
  agent_name: string;
  kind: string;
  created_at: string;
  summary: string;
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<{ recent_runs: Run[] }>("/api/stats")
      .then((s) => setRuns(s.recent_runs))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div style={{ padding: "34px 40px", maxWidth: 900 }}>
      <PageHeader title="Recent Runs" sub="sentinel // all eval + red-team activity across agents" />

      <Panel title={`Activity · ${runs.length}`} code="↻">
        {!loaded && <Muted>loading…</Muted>}
        {loaded && runs.length === 0 && (
          <Muted>No runs yet — open an agent in the <Link href="/agents" style={{ color: "var(--accent)" }}>Playground</Link> and run an eval or red-team.</Muted>
        )}
        {runs.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <Link href={`/agents/${r.agent_id}`} className="mono" style={{ fontSize: 13, color: "var(--text-bright)" }}>
                  {r.agent_name}
                </Link>
                <span className={`badge ${r.kind === "eval" ? "accent" : "bad"}`}>{r.kind}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{r.summary}</div>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
              {new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{children}</p>
);
