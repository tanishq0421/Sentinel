"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, RunDetail } from "@/lib/api";
import { Panel, PageHeader, Bar } from "@/components/ui";

type RunRow = { id: string; agent_id: string; agent_name: string; kind: string; created_at: string; summary: string; result: Record<string, unknown> };
type StatsResponse = { recent_runs: RunRow[] };

export default function RunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "eval" | "redteam">("all");

  useEffect(() => {
    api.get<StatsResponse>("/api/stats").then((s) => setRuns(s.recent_runs)).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const filtered = filter === "all" ? runs : runs.filter((r) => r.kind === filter);

  return (
    <div style={{ padding: "24px 28px" }}>
      <PageHeader title="Runs" sub="sentinel // all eval + red-team activity" />

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {(["all", "eval", "redteam"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="mono"
            style={{ fontSize: 9, padding: "4px 10px", borderRadius: 2, border: `1px solid ${filter === f ? "var(--accent)" : "var(--border)"}`, background: filter === f ? "var(--accent-dim)" : "transparent", color: filter === f ? "var(--accent)" : "var(--muted)" }}>
            {f}
          </button>
        ))}
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", alignSelf: "center", marginLeft: 8 }}>{filtered.length} runs</span>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <table style={{ width: "100%" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
              <Th>Agent</Th><Th>Type</Th><Th>Status</Th><Th>Result</Th><Th align="right">Time</Th><Th width={30}></Th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <tr><td colSpan={6} className="mono" style={{ padding: 16, fontSize: 10, color: "var(--muted)" }}>loading…</td></tr>}
            {loaded && filtered.length === 0 && (
              <tr><td colSpan={6} className="mono" style={{ padding: 16, fontSize: 10, color: "var(--muted)" }}>
                No runs. <Link href="/agents" style={{ color: "var(--accent)" }}>Run an eval →</Link>
              </td></tr>
            )}
            {filtered.map((r) => (
              <RunTableRow key={r.id} r={r} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunTableRow({ r, expanded, onToggle }: { r: RunRow; expanded: boolean; onToggle: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);

  useEffect(() => {
    if (expanded && !detail) {
      api.agentRuns(r.agent_id).then((runs) => {
        const match = (runs as RunDetail[]).find((x) => x.id === r.id);
        if (match) setDetail(match);
      }).catch(() => {});
    }
  }, [expanded, r.id, r.agent_id, detail]);

  return (
    <>
      <tr onClick={onToggle} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: expanded ? "var(--panel-2)" : "transparent" }}>
        <Td>
          <Link href={`/agents/${r.agent_id}`} className="mono" style={{ fontSize: 11, color: "var(--text-bright)" }} onClick={(e) => e.stopPropagation()}>
            {r.agent_name}
          </Link>
        </Td>
        <Td><span className={`badge ${r.kind === "eval" ? "accent" : "bad"}`}>{r.kind}</span></Td>
        <Td><span className="badge ok" style={{ fontSize: 9 }}>completed</span></Td>
        <Td><span className="mono" style={{ fontSize: 11 }}>{r.summary}</span></Td>
        <Td align="right"><span className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>{new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></Td>
        <Td><span style={{ fontSize: 9, color: "var(--muted)" }}>{expanded ? "▾" : "▸"}</span></Td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <td colSpan={6} style={{ padding: "10px 14px", background: "var(--panel)" }}>
            {!detail ? <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>loading…</span> : <DetailInline detail={detail} />}
          </td>
        </tr>
      )}
    </>
  );
}

function DetailInline({ detail }: { detail: RunDetail }) {
  const res = detail.result;
  if (detail.kind === "eval") {
    const checks = (res.checks || {}) as Record<string, { pass: number; total: number }>;
    const cases = (res.cases || []) as { question: string; passed: boolean; checks: Record<string, { passed: boolean; reason: string }> }[];
    return (
      <div>
        {Object.keys(checks).length > 0 && (
          <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
            {Object.entries(checks).map(([n, v]) => (
              <div key={n}>
                <div className="label" style={{ fontSize: 8 }}>{n}</div>
                <div className="kpi" style={{ fontSize: 16, color: v.pass === v.total ? "var(--ok)" : "var(--warn)" }}>{v.pass}/{v.total}</div>
              </div>
            ))}
          </div>
        )}
        {cases.map((c, i) => (
          <div key={i} style={{ padding: "4px 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 11 }}>{c.question}</span>
            <span className={`badge ${c.passed ? "ok" : "bad"}`}>{c.passed ? "pass" : "fail"}</span>
          </div>
        ))}
      </div>
    );
  }
  if (detail.kind === "redteam") {
    const attacks = (res.attacks || []) as { attack_id: string; attack_name: string; category: string; succeeded: number; trials: number; asr: number }[];
    return (
      <div>
        <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
          <div><div className="label" style={{ fontSize: 8 }}>ASR</div><div className="kpi" style={{ fontSize: 16, color: (res.asr as number) > 0 ? "var(--bad)" : "var(--ok)" }}>{Math.round((res.asr as number) * 100)}%</div></div>
          <div><div className="label" style={{ fontSize: 8 }}>vulnerable</div><div className="kpi" style={{ fontSize: 16, color: "var(--warn)" }}>{String(res.vulnerable_count)}/{String(res.total_attacks)}</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 4 }}>
          {attacks.map((a) => (
            <div key={a.attack_id} style={{ padding: "4px 6px", borderRadius: 2, fontSize: 10, border: `1px solid ${a.asr > 0 ? "var(--bad)" : "var(--border)"}`, background: a.asr > 0 ? "var(--bad-dim)" : "var(--panel-2)" }}>
              <span className="mono" style={{ color: "var(--text-bright)" }}>{a.attack_name}</span>
              <span className="mono" style={{ float: "right", color: a.asr > 0 ? "var(--bad)" : "var(--ok)" }}>{a.succeeded}/{a.trials}</span>
            </div>
          ))}
        </div>
        {typeof res.recommendation === "string" && (
          <div className="mono" style={{ fontSize: 10, color: "var(--text)", marginTop: 6, lineHeight: 1.4 }}>{res.recommendation}</div>
        )}
      </div>
    );
  }
  return <pre className="mono" style={{ fontSize: 9, color: "var(--muted)", margin: 0 }}>{JSON.stringify(res, null, 2)}</pre>;
}

function Th({ children, align, width }: { children?: React.ReactNode; align?: string; width?: number }) {
  return <th className="label" style={{ padding: "8px 14px", textAlign: (align as "left" | "right") || "left", fontSize: 8.5, fontWeight: 500, width }}>{children}</th>;
}
function Td({ children, align }: { children: React.ReactNode; align?: string }) {
  return <td style={{ padding: "8px 14px", textAlign: (align as "left" | "right") || "left" }}>{children}</td>;
}
