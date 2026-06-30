"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Panel, PageHeader, Bar, asrColor } from "@/components/ui";

type Stats = {
  total_agents: number;
  agents_evaled: number;
  agents_redteamed: number;
  avg_groundedness: number | null;
  avg_asr: number | null;
  vulnerable_agents: number;
  recent_runs: {
    id: string;
    agent_id: string;
    agent_name: string;
    kind: string;
    created_at: string;
    summary: string;
  }[];
};

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<Stats>("/api/stats")
      .then(setStats)
      .catch((e) => setErr(String(e)));
  }, []);

  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1100 }}>
      <PageHeader title="Platform Overview" sub="sentinel // live stats across all agents" />

      {err && (
        <div className="panel" style={{ padding: 14, marginBottom: 14, borderColor: "var(--bad)" }}>
          <span className="mono" style={{ color: "var(--bad)", fontSize: 12 }}>
            API unreachable — is the stack running? ({err})
          </span>
        </div>
      )}

      {!stats && !err && (
        <p className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>loading…</p>
      )}

      {stats && (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
            <Kpi label="Total agents" value={String(stats.total_agents)} tone="accent"
              hint={`${stats.agents_evaled} evaled · ${stats.agents_redteamed} red-teamed`} />
            <Kpi label="Avg groundedness" value={pct(stats.avg_groundedness)} tone="ok"
              hint={`across ${stats.agents_evaled} agent${stats.agents_evaled !== 1 ? "s" : ""}`} />
            <Kpi label="Avg attack success" value={pct(stats.avg_asr)}
              tone={stats.avg_asr != null && stats.avg_asr > 0 ? "bad" : "ok"}
              hint={`${stats.vulnerable_agents} vulnerable`} />
            <Kpi label="Pending evals" value={String(stats.total_agents - stats.agents_evaled)} tone="warn"
              hint="agents not yet evaluated" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Recent activity */}
            <Panel title="Recent runs" code="↻">
              {stats.recent_runs.length === 0 ? (
                <Empty>No runs yet. Open <Link href="/agents" style={{ color: "var(--accent)" }}>Playground</Link> to evaluate an agent.</Empty>
              ) : (
                stats.recent_runs.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Link href={`/agents/${r.agent_id}`} className="mono" style={{ fontSize: 13, color: "var(--text-bright)" }}>
                          {r.agent_name}
                        </Link>
                        <span className={`badge ${r.kind === "eval" ? "accent" : "bad"}`}>{r.kind}</span>
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.summary}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textAlign: "right" }}>
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      <br />{new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </Panel>

            {/* Agent health at a glance */}
            <Panel title="Agent health" code="◈" right={<Link href="/compare" className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>full leaderboard →</Link>}>
              {stats.total_agents === 0 ? (
                <Empty>No agents yet. <Link href="/agents" style={{ color: "var(--accent)" }}>Create one →</Link></Empty>
              ) : (
                <AgentHealth stats={stats} />
              )}
            </Panel>

            {/* Quick actions */}
            <Panel title="Get started" code="→">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Action href="/agents" label="Configure a new agent" desc="Set a system prompt, paste a knowledge base, toggle guardrails." color="var(--accent)" />
                <Action href="/compare" label="View leaderboard" desc="Compare all agents by eval quality and attack-success-rate side by side." color="var(--ok)" />
                <Action href="/traces" label="Browse traces" desc="Step through retrieval → LLM → tool spans for any agent run." color="var(--warn)" />
              </div>
            </Panel>

            {/* Coverage summary */}
            <Panel title="Eval coverage" code="▦">
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span className="mono">agents evaluated</span>
                  <span className="mono" style={{ color: "var(--muted)" }}>{stats.agents_evaled}/{stats.total_agents}</span>
                </div>
                <Bar value={stats.agents_evaled} max={Math.max(stats.total_agents, 1)} color="var(--ok)" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span className="mono">agents red-teamed</span>
                  <span className="mono" style={{ color: "var(--muted)" }}>{stats.agents_redteamed}/{stats.total_agents}</span>
                </div>
                <Bar value={stats.agents_redteamed} max={Math.max(stats.total_agents, 1)} color={asrColor(stats.avg_asr ?? 0)} />
              </div>
              {stats.total_agents > 0 && stats.agents_evaled < stats.total_agents && (
                <p className="mono" style={{ fontSize: 11, color: "var(--warn)", margin: 0 }}>
                  {stats.total_agents - stats.agents_evaled} agent(s) have never been evaluated — open the <Link href="/compare" style={{ color: "var(--accent)" }}>Leaderboard</Link> and run evals.
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function AgentHealth({ stats }: { stats: Stats }) {
  const robust = stats.agents_redteamed - stats.vulnerable_agents;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <MiniStat label="secure" value={robust} color="var(--ok)" />
        <MiniStat label="vulnerable" value={stats.vulnerable_agents} color="var(--bad)" />
        <MiniStat label="untested" value={stats.total_agents - stats.agents_redteamed} color="var(--muted)" />
      </div>
      <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
        Vulnerability = canary injection success rate &gt; 0%.<br />
        Enable <b style={{ color: "var(--text)" }}>spotlighting</b> on vulnerable agents to reduce ASR.
      </p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0", border: "1px solid var(--border)", borderRadius: 8 }}>
      <div className="kpi" style={{ fontSize: 26, color }}>{value}</div>
      <div className="label" style={{ fontSize: 9.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Action({ href, label, desc, color }: { href: string; label: string; desc: string; color: string }) {
  return (
    <Link href={href} style={{ display: "block", padding: 12, borderRadius: 8, border: `1px solid var(--border)`, background: "var(--panel-2)" }}>
      <div className="mono" style={{ fontSize: 13, color, marginBottom: 4 }}>{label} →</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
    </Link>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone: "ok" | "bad" | "accent" | "warn"; hint: string }) {
  const c = { ok: "var(--ok)", bad: "var(--bad)", accent: "var(--accent)", warn: "var(--warn)" }[tone];
  return (
    <div className="panel rise" style={{ padding: 16 }}>
      <div className="label" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="kpi" style={{ fontSize: 30, color: c, margin: "6px 0 2px" }}>{value}</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{hint}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.7 }}>{children}</p>;
}
