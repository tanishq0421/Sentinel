"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, Agent } from "@/lib/api";
import { Panel, PageHeader, Bar } from "@/components/ui";

type EvalResult = { groundedness: { pass: number; total: number }; cases: { question: string; passed: boolean; reason: string }[] };
type RedResult = { asr: number; asr_with_spotlight: number; vulnerable: boolean; recommendation: string; trials: number };
type RunRecord = { id: string; kind: string; created_at: string; result: unknown };

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [evalRes, setEvalRes] = useState<EvalResult | null>(null);
  const [rtRes, setRtRes] = useState<RedResult | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadRuns(agentId: string) {
    try {
      const runs = (await api.agentRuns(agentId)) as RunRecord[];
      setHistory(runs);
      const latestEval = runs.find((r) => r.kind === "eval");
      const latestRt = runs.find((r) => r.kind === "redteam");
      if (latestEval) setEvalRes(latestEval.result as EvalResult);
      if (latestRt) setRtRes(latestRt.result as RedResult);
    } catch {}
  }

  useEffect(() => {
    if (!id) return;
    api.agent(id).then(setAgent).catch(() => {});
    loadRuns(id);
  }, [id]);

  async function runJob(type: string, model?: string) {
    setBusy(true);
    setStatus(`${type} · queued`);
    try {
      const { job_id } = await api.createRun(type, model, id);
      for (let i = 0; i < 150; i++) {
        const s = await api.runStatus(job_id);
        setStatus(`${type} · ${s.status}`);
        if (s.status === "finished" || s.status === "failed") {
          await loadRuns(id);
          break;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  if (!agent) return <div style={{ padding: 40 }} className="mono">loading…</div>;

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1050 }}>
      <Link href="/agents" className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>← playground</Link>
      <div style={{ height: 14 }} />
      <PageHeader
        title={agent.name}
        sub={`${agent.id.slice(0, 10)} · ${agent.model}${agent.is_example ? " · example agent" : ""}`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        <Panel title="Configuration" code="⚙">
          <div className="label" style={{ marginBottom: 5 }}>system prompt</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.65, marginBottom: 14, color: "var(--text)" }}>{agent.system_prompt}</div>
          <div className="label" style={{ marginBottom: 6 }}>guardrails</div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className={`badge ${agent.guardrails?.spotlight ? "ok" : ""}`}>spotlight {agent.guardrails?.spotlight ? "on" : "off"}</span>
            <span className={`badge ${agent.guardrails?.pii_egress ? "ok" : ""}`}>pii egress {agent.guardrails?.pii_egress ? "on" : "off"}</span>
          </div>
        </Panel>

        <Panel title="Run assessment" code="▶" right={busy && status ? <span className="badge accent">{status}</span> : null}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <RunBtn disabled={busy} onClick={() => runJob("pg_eval")} color="var(--accent)" label="run eval" desc="Auto-generate questions from KB, score groundedness." />
            <RunBtn disabled={busy} onClick={() => runJob("pg_redteam")} color="var(--bad)" label="run red-team" desc="Canary injection — report ASR + guardrail recommendation." />
          </div>
        </Panel>

        {evalRes && (
          <Panel title="Latest eval — groundedness" code="A">
            <Bar value={evalRes.groundedness.pass} max={evalRes.groundedness.total} color="var(--ok)" />
            <div className="mono" style={{ fontSize: 13, margin: "8px 0 14px" }}>
              {evalRes.groundedness.pass}/{evalRes.groundedness.total} grounded
            </div>
            {evalRes.cases.map((c, i) => (
              <div key={i} style={{ padding: "7px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 12.5 }}>{c.question}</span>
                  <span className={`badge ${c.passed ? "ok" : "bad"}`}>{c.passed ? "pass" : "fail"}</span>
                </div>
                {!c.passed && <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{c.reason}</div>}
              </div>
            ))}
          </Panel>
        )}

        {rtRes && (
          <Panel title="Latest red-team — canary injection" code="B">
            <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
              <Metric label="attack success" value={pct(rtRes.asr)} color={rtRes.asr > 0 ? "var(--bad)" : "var(--ok)"} />
              <Metric label="with spotlighting" value={pct(rtRes.asr_with_spotlight)} color="var(--warn)" />
              <Metric label="trials" value={String(rtRes.trials)} color="var(--muted)" />
            </div>
            <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${rtRes.vulnerable ? "var(--bad)" : "var(--ok)"}`, background: "var(--panel-2)" }}>
              <span className={`badge ${rtRes.vulnerable ? "bad" : "ok"}`}>{rtRes.vulnerable ? "vulnerable" : "robust"}</span>
              <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{rtRes.recommendation}</div>
            </div>
          </Panel>
        )}

        <Panel title={`Run history · ${history.length}`} code="⟳">
          {history.length === 0 && <Muted>No runs yet — click an assessment button above.</Muted>}
          {history.slice(0, 10).map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`badge ${r.kind === "eval" ? "accent" : "bad"}`}>{r.kind}</span>
                <span className="mono" style={{ fontSize: 12 }}>{runSummary(r)}</span>
              </div>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                {new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </Panel>

      </div>
    </div>
  );
}

function runSummary(r: RunRecord): string {
  const res = r.result as Record<string, unknown>;
  if (r.kind === "eval") {
    const g = res?.groundedness as { pass: number; total: number } | undefined;
    return g ? `${g.pass}/${g.total} grounded` : "eval";
  }
  if (r.kind === "redteam") {
    const asr = res?.asr as number | undefined;
    return asr !== undefined ? `ASR ${Math.round(asr * 100)}%` : "redteam";
  }
  return r.kind;
}

function RunBtn({ label, desc, color, onClick, disabled }: { label: string; desc: string; color: string; onClick: () => void; disabled: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{ width: "100%", background: "var(--panel-2)", border: `1px solid ${color}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "left" }}>
      <div className="mono" style={{ fontSize: 12.5, color, marginBottom: 3 }}>{label} →</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{desc}</div>
    </button>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="label" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="kpi" style={{ fontSize: 26, color }}>{value}</div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{children}</p>
);
