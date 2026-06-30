"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Agent } from "@/lib/api";
import { Panel, PageHeader, Bar } from "@/components/ui";

type EvalResult = { groundedness: { pass: number; total: number }; cases: { passed: boolean }[] };
type RedResult = { asr: number; vulnerable: boolean; recommendation: string };
type Row = { agent: Agent; eval: EvalResult | null; redteam: RedResult | null; busy: boolean };

export default function ComparePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const agents = await api.agents();
    const resolved = await Promise.all(
      agents.map(async (agent) => {
        const [ev, rt] = await Promise.all([
          api.latestRun(agent.id, "eval").catch(() => null),
          api.latestRun(agent.id, "redteam").catch(() => null),
        ]);
        return {
          agent,
          eval: ev ? (ev.result as EvalResult) : null,
          redteam: rt ? (rt.result as RedResult) : null,
          busy: false,
        };
      })
    );
    setRows(resolved);
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function runAll(kind: "pg_eval" | "pg_redteam") {
    setRows((r) => r.map((row) => ({ ...row, busy: true })));
    await Promise.all(
      rows.map(async ({ agent }) => {
        const { job_id } = await api.createRun(kind, undefined, agent.id);
        for (let i = 0; i < 120; i++) {
          const s = await api.runStatus(job_id);
          if (s.status === "finished" || s.status === "failed") break;
          await new Promise((r) => setTimeout(r, 3000));
        }
      })
    );
    await load();
  }

  const groundednessScore = (ev: EvalResult | null) =>
    ev ? ev.groundedness.pass / ev.groundedness.total : null;

  const sorted = [...rows].sort((a, b) => {
    const sa = groundednessScore(a.eval) ?? -1;
    const sb = groundednessScore(b.eval) ?? -1;
    return sb - sa;
  });

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1100 }}>
      <PageHeader title="Agent Leaderboard" sub="sentinel // compare all agents — eval quality + security" />

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => runAll("pg_eval")} className="mono" style={btn("var(--accent)")}>
          ▶ run eval on all agents
        </button>
        <button onClick={() => runAll("pg_redteam")} className="mono" style={btn("var(--bad)")}>
          ▶ red-team all agents
        </button>
      </div>

      {!loaded && <p className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>loading…</p>}

      {loaded && rows.length === 0 && (
        <p className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
          No agents yet. <Link href="/agents" style={{ color: "var(--accent)" }}>Create one →</Link>
        </p>
      )}

      {sorted.length > 0 && (
        <Panel title={`${sorted.length} agents ranked by eval score`} code="↓">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 80px", gap: "0 12px", marginBottom: 10 }}>
            {["agent", "groundedness", "security (ASR)", "guardrails", ""].map((h) => (
              <div key={h} className="label" style={{ fontSize: 9.5, paddingBottom: 6 }}>{h}</div>
            ))}
          </div>

          {sorted.map((row, i) => {
            const score = groundednessScore(row.eval);
            const asr = row.redteam?.asr ?? null;
            return (
              <div
                key={row.agent.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 80px 80px",
                  gap: "0 12px",
                  alignItems: "center",
                  padding: "12px 0",
                  borderTop: "1px solid var(--border)",
                  opacity: row.busy ? 0.5 : 1,
                }}
              >
                <div>
                  <div className="mono" style={{ fontSize: 13, color: "var(--text-bright)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>#{i + 1}</span>
                    {row.agent.name}
                    {row.agent.is_example && <span className="badge accent">example</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{row.agent.model}</div>
                </div>

                <div>
                  {score !== null ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span className="mono" style={{ color: score >= 0.8 ? "var(--ok)" : score >= 0.6 ? "var(--warn)" : "var(--bad)" }}>
                          {Math.round(score * 100)}%
                        </span>
                        <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
                          {row.eval!.groundedness.pass}/{row.eval!.groundedness.total}
                        </span>
                      </div>
                      <Bar value={score} color={score >= 0.8 ? "var(--ok)" : score >= 0.6 ? "var(--warn)" : "var(--bad)"} />
                    </>
                  ) : (
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>not run</span>
                  )}
                </div>

                <div>
                  {asr !== null ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span className="mono" style={{ color: asr === 0 ? "var(--ok)" : asr < 0.5 ? "var(--warn)" : "var(--bad)" }}>
                          {Math.round(asr * 100)}% ASR
                        </span>
                        <span className={`badge ${row.redteam!.vulnerable ? "bad" : "ok"}`}>
                          {row.redteam!.vulnerable ? "vuln" : "robust"}
                        </span>
                      </div>
                      <Bar value={asr} color={asr === 0 ? "var(--ok)" : asr < 0.5 ? "var(--warn)" : "var(--bad)"} />
                    </>
                  ) : (
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>not run</span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {row.agent.guardrails?.spotlight && <span className="badge ok" style={{ fontSize: 9 }}>spotlight</span>}
                  {row.agent.guardrails?.pii_egress && <span className="badge ok" style={{ fontSize: 9 }}>pii</span>}
                  {!row.agent.guardrails?.spotlight && !row.agent.guardrails?.pii_egress && (
                    <span className="badge" style={{ fontSize: 9 }}>none</span>
                  )}
                </div>

                <Link href={`/agents/${row.agent.id}`} className="mono" style={{ fontSize: 11, color: "var(--accent)", textAlign: "right" }}>
                  open →
                </Link>
              </div>
            );
          })}
        </Panel>
      )}

      <p className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 16, lineHeight: 1.7 }}>
        Eval: auto-generated groundedness questions from each agent&apos;s KB, scored by LLM judge.<br />
        Security: canary injection attack — ASR = fraction of trials where the attack succeeded.<br />
        Example agents (HelpDesk Pro · NaiveBot · SecureDesk) are seeded on startup via <code>sentinel seed-examples</code>.
      </p>
    </div>
  );
}

function btn(color: string) {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    borderRadius: 7,
    padding: "9px 16px",
    fontSize: 12,
    cursor: "pointer",
  } as const;
}
