"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, Agent } from "@/lib/api";
import { Panel, PageHeader, Bar } from "@/components/ui";

type EvalResult = { groundedness: { pass: number; total: number }; cases: { question: string; passed: boolean; reason: string }[] };
type RedteamResult = { asr: number; asr_with_spotlight: number; vulnerable: boolean; recommendation: string; trials: number };

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [evalRes, setEvalRes] = useState<EvalResult | null>(null);
  const [rtRes, setRtRes] = useState<RedteamResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (id) api.agent(id).then(setAgent).catch(() => {}); }, [id]);

  async function run(type: "pg_eval" | "pg_redteam") {
    setBusy(true);
    setStatus(`${type} · queued`);
    try {
      const { job_id } = await api.createRun(type, undefined, id);
      for (let i = 0; i < 150; i++) {
        const s = await api.runStatus(job_id);
        setStatus(`${type} · ${s.status}`);
        if (s.status === "finished") {
          if (type === "pg_eval") setEvalRes(s.result as EvalResult);
          else setRtRes(s.result as RedteamResult);
          break;
        }
        if (s.status === "failed") break;
        await new Promise((r) => setTimeout(r, 2500));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!agent) return <div style={{ padding: 40 }} className="mono">loading…</div>;

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1000 }}>
      <Link href="/agents" className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>← playground</Link>
      <div style={{ height: 14 }} />
      <PageHeader title={agent.name} sub={`agent ${agent.id.slice(0, 12)} · ${agent.model}`} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel title="Configuration" code="⚙">
          <div className="label" style={{ marginBottom: 5 }}>system prompt</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14, color: "var(--text)" }}>{agent.system_prompt}</div>
          <div className="label" style={{ marginBottom: 6 }}>guardrails</div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className={`badge ${agent.guardrails?.spotlight ? "ok" : ""}`}>spotlighting {agent.guardrails?.spotlight ? "on" : "off"}</span>
            <span className={`badge ${agent.guardrails?.pii_egress ? "ok" : ""}`}>pii egress {agent.guardrails?.pii_egress ? "on" : "off"}</span>
          </div>
        </Panel>

        <Panel title="Assess this agent" code="▶" right={busy ? <span className="badge accent">{status}</span> : null}>
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={busy} onClick={() => run("pg_eval")} style={btn("var(--accent)")} className="mono">run eval</button>
            <button disabled={busy} onClick={() => run("pg_redteam")} style={btn("var(--bad)")} className="mono">run red-team</button>
          </div>
          <p className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
            eval auto-generates questions from this agent&apos;s KB and scores groundedness. red-team fires a canary
            injection and recommends a guardrail if it lands.
          </p>
        </Panel>

        {evalRes && (
          <Panel title="Eval — groundedness" code="A">
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
          <Panel title="Red-team — canary injection" code="B">
            <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
              <Metric label="attack success" value={pct(rtRes.asr)} color={rtRes.asr > 0 ? "var(--bad)" : "var(--ok)"} />
              <Metric label="with spotlighting" value={pct(rtRes.asr_with_spotlight)} color="var(--warn)" />
            </div>
            <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${rtRes.vulnerable ? "var(--bad)" : "var(--ok)"}`, background: "var(--panel-2)" }}>
              <span className={`badge ${rtRes.vulnerable ? "bad" : "ok"}`}>{rtRes.vulnerable ? "vulnerable" : "robust"}</span>
              <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{rtRes.recommendation}</div>
            </div>
          </Panel>
        )}
      </div>
    </div>
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
function btn(color: string): CSSProperties {
  return { flex: 1, background: "transparent", border: `1px solid ${color}`, color, borderRadius: 7, padding: "10px", fontSize: 12, cursor: "pointer" };
}
