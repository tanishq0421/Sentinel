"use client";

import { useState, type CSSProperties } from "react";
import { api } from "@/lib/api";
import { Panel, Bar } from "@/components/ui";

type Job = { type: string; status: string; result?: Result | null };
type Result = {
  pass_rates?: Record<string, { pass: number; total: number }>;
  failure_categories?: string[];
  model?: string;
  asr?: number;
  success?: number;
  total?: number;
  by_surface?: Record<string, { success: number; total: number; asr: number }>;
  cross_model?: Record<string, { success: number; total: number; asr: number }>;
  guardrails?: { before: number; after: number };
};

export function RunControls({ onDone }: { onDone?: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(type: string, model?: string) {
    setBusy(true);
    setJob({ type, status: "queued" });
    try {
      const { job_id } = await api.createRun(type, model);
      for (let i = 0; i < 150; i++) {
        const s = await api.runStatus(job_id);
        setJob({ type, status: s.status, result: s.result as Result });
        if (s.status === "finished" || s.status === "failed") {
          onDone?.();
          break;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
    } catch (e) {
      setJob({ type, status: "error: " + String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Run a job" code="▶" right={busy ? <span className="badge accent">running…</span> : null}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => run("eval")} style={btn("var(--accent)")} className="mono">run eval suite</button>
        <button disabled={busy} onClick={() => run("redteam", "openai/gpt-4o-mini")} style={btn("var(--bad)")} className="mono">run red-team · gpt-4o-mini</button>
        <button disabled={busy} onClick={() => run("redteam", "anthropic/claude-haiku-4-5-20251001")} style={btn("var(--ok)")} className="mono">run red-team · claude</button>
        <button disabled={busy} onClick={() => run("redteam_suite")} style={btn("var(--warn)")} className="mono">run full red-team suite</button>
      </div>

      {job && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: job.result ? 12 : 0 }}>
            <span className="mono" style={{ fontSize: 12 }}>{job.type}</span>
            <span className={`badge ${job.status === "finished" ? "ok" : job.status === "failed" ? "bad" : "accent"}`}>{job.status}</span>
          </div>
          {job.result && <RunResult result={job.result} />}
        </div>
      )}

      <p className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        jobs run async on the RQ worker (real LLM calls). results below feed the Overview charts.
      </p>
    </Panel>
  );
}

function RunResult({ result }: { result: Result }) {
  if (result.pass_rates) {
    return (
      <div>
        {Object.entries(result.pass_rates).map(([name, r]) => (
          <div key={name} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
              <span className="mono">{name}</span>
              <span className="mono" style={{ color: "var(--muted)" }}>{r.pass}/{r.total}</span>
            </div>
            <Bar value={r.pass} max={r.total} color="var(--ok)" />
          </div>
        ))}
      </div>
    );
  }
  if (result.cross_model) {
    return (
      <div>
        {Object.entries(result.cross_model).map(([m, r]) => (
          <Line key={m} label={m} value={`${r.success}/${r.total} · ${pct(r.asr)}`} />
        ))}
        {result.guardrails && <Line label="guardrails (ASR)" value={`${pct(result.guardrails.before)} → ${pct(result.guardrails.after)}`} />}
      </div>
    );
  }
  if (result.asr !== undefined) {
    return (
      <div>
        <Line label={result.model ?? "model"} value={`ASR ${pct(result.asr)} (${result.success}/${result.total})`} />
        {result.by_surface &&
          Object.entries(result.by_surface).map(([s, r]) => <Line key={s} label={`· ${s}`} value={`${r.success}/${r.total}`} />)}
      </div>
    );
  }
  return <pre className="mono" style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
      <span className="mono">{label}</span>
      <span className="mono" style={{ color: "var(--muted)" }}>{value}</span>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
function btn(color: string): CSSProperties {
  return { background: "transparent", border: `1px solid ${color}`, color, borderRadius: 7, padding: "9px 13px", fontSize: 12, cursor: "pointer" };
}
