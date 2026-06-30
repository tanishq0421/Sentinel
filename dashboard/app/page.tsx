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
    api.get<Stats>("/api/stats").then(setStats).catch((e) => setErr(String(e)));
  }, []);

  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div style={{ padding: "24px 28px" }}>
      <PageHeader title="Platform Overview" sub="sentinel // live stats across all agents" />

      {err && (
        <div className="panel" style={{ padding: 12, marginBottom: 12, borderColor: "var(--bad)" }}>
          <span className="mono" style={{ color: "var(--bad)", fontSize: 11 }}>API unreachable — is the stack running?</span>
        </div>
      )}
      {!stats && !err && <p className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>loading…</p>}

      {stats && (
        <>
          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
            <Kpi label="Agents" value={String(stats.total_agents)} color="var(--accent)" sub={`${stats.agents_evaled} eval · ${stats.agents_redteamed} rt`} />
            <Kpi label="Groundedness" value={pct(stats.avg_groundedness)} color="var(--ok)" sub={`${stats.agents_evaled} agents`} />
            <Kpi label="Avg ASR" value={pct(stats.avg_asr)} color={stats.avg_asr && stats.avg_asr > 0 ? "var(--bad)" : "var(--ok)"} sub={`${stats.vulnerable_agents} vulnerable`} />
            <Kpi label="Secure" value={String(stats.agents_redteamed - stats.vulnerable_agents)} color="var(--ok)" sub="agents clean" />
            <Kpi label="Pending" value={String(stats.total_agents - stats.agents_evaled)} color="var(--warn)" sub="not evaluated" />
          </div>

          {/* Main grid: 3 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>

            {/* Recent runs — spans 2 rows */}
            <Panel title="Activity feed" code="↻" style={{ gridRow: "1 / 3" }} dense>
              {stats.recent_runs.length === 0 ? (
                <Muted>No runs yet. <Link href="/agents" style={{ color: "var(--accent)" }}>Create an agent →</Link></Muted>
              ) : (
                stats.recent_runs.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className={`status-dot ${r.kind === "eval" ? "live" : "threat"}`} />
                        <Link href={`/agents/${r.agent_id}`} className="mono" style={{ fontSize: 11, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.agent_name}
                        </Link>
                        <span className={`badge ${r.kind === "eval" ? "accent" : "bad"}`}>{r.kind}</span>
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, paddingLeft: 14 }}>{r.summary}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 9, color: "var(--muted)", flexShrink: 0, marginLeft: 8 }}>
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </Panel>

            {/* Agent health */}
            <Panel title="Security posture" code="◈" dense right={<Link href="/compare" className="mono" style={{ fontSize: 9, color: "var(--accent)" }}>leaderboard →</Link>}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                <StatusBlock label="secure" value={stats.agents_redteamed - stats.vulnerable_agents} color="var(--ok)" />
                <StatusBlock label="at risk" value={stats.vulnerable_agents} color="var(--bad)" />
                <StatusBlock label="untested" value={stats.total_agents - stats.agents_redteamed} color="var(--muted)" />
              </div>
              <div className="mono" style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.5 }}>
                Threat = ASR &gt; 0% across {stats.agents_redteamed} tested agent{stats.agents_redteamed !== 1 ? "s" : ""}.
              </div>
            </Panel>

            {/* Coverage bars */}
            <Panel title="Coverage" code="▦" dense>
              <CoverageRow label="evaluated" done={stats.agents_evaled} total={stats.total_agents} color="var(--ok)" />
              <div style={{ height: 8 }} />
              <CoverageRow label="red-teamed" done={stats.agents_redteamed} total={stats.total_agents} color={asrColor(stats.avg_asr ?? 0)} />
              {stats.agents_evaled < stats.total_agents && (
                <div className="mono" style={{ fontSize: 9, color: "var(--warn)", marginTop: 8 }}>
                  {stats.total_agents - stats.agents_evaled} agent(s) pending eval
                </div>
              )}
            </Panel>

            {/* Quick nav — spans 2 cols */}
            <Panel title="Quick actions" code="→" dense style={{ gridColumn: "2 / 4" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <NavCard href="/agents" label="New agent" desc="Prompt + KB + guardrails" color="var(--accent)" />
                <NavCard href="/compare" label="Leaderboard" desc="Cross-agent comparison" color="var(--ok)" />
                <NavCard href="/runs" label="Run history" desc="All eval & red-team runs" color="var(--warn)" />
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div className="panel rise" style={{ padding: "12px 14px" }}>
      <div className="label" style={{ fontSize: 8.5, marginBottom: 4 }}>{label}</div>
      <div className="kpi" style={{ fontSize: 26, color, lineHeight: 1 }}>{value}</div>
      <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function StatusBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0", background: "var(--panel-2)", borderRadius: 2 }}>
      <div className="kpi" style={{ fontSize: 20, color }}>{value}</div>
      <div className="label" style={{ fontSize: 8, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CoverageRow({ label, done, total, color }: { label: string; done: number; total: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span className="mono" style={{ fontSize: 10 }}>{label}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{done}/{total}</span>
      </div>
      <Bar value={done} max={Math.max(total, 1)} color={color} />
    </div>
  );
}

function NavCard({ href, label, desc, color }: { href: string; label: string; desc: string; color: string }) {
  return (
    <Link href={href} style={{ display: "block", padding: "8px 10px", borderRadius: 2, border: "1px solid var(--border)", background: "var(--panel-2)" }}>
      <div className="mono" style={{ fontSize: 11, color, marginBottom: 2 }}>{label} →</div>
      <div className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>{desc}</div>
    </Link>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="mono" style={{ fontSize: 10, color: "var(--muted)", margin: 0 }}>{children}</p>
);
