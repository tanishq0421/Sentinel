"use client";

import { useState, type CSSProperties } from "react";
import { api } from "@/lib/api";
import { Panel } from "@/components/ui";

type Job = { type: string; status: string; result?: unknown };

export function RunControls({ onDone }: { onDone?: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(type: string, model?: string) {
    setBusy(true);
    setJob({ type, status: "queued" });
    try {
      const { job_id } = await api.createRun(type, model);
      for (let i = 0; i < 120; i++) {
        const s = await api.runStatus(job_id);
        setJob({ type, status: s.status, result: s.result });
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
    <Panel
      title="Run a job"
      code="▶"
      right={busy ? <span className="badge accent">running…</span> : null}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => run("eval")} style={btn("var(--accent)")} className="mono">
          run eval suite
        </button>
        <button disabled={busy} onClick={() => run("redteam", "openai/gpt-4o-mini")} style={btn("var(--bad)")} className="mono">
          run red-team · gpt-4o-mini
        </button>
        <button disabled={busy} onClick={() => run("redteam", "anthropic/claude-haiku-4-5-20251001")} style={btn("var(--ok)")} className="mono">
          run red-team · claude
        </button>
      </div>
      {job && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 12 }}>{job.type}</span>
            <span className={`badge ${job.status === "finished" ? "ok" : job.status === "failed" ? "bad" : "accent"}`}>{job.status}</span>
          </div>
          {job.result != null && (
            <pre className="mono" style={{ margin: "10px 0 0", fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
              {JSON.stringify(job.result, null, 2)}
            </pre>
          )}
        </div>
      )}
      <p className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        jobs run async on the RQ worker (real LLM calls). eval regenerates traces + scores them; red-team runs the injection campaign.
      </p>
    </Panel>
  );
}

function btn(color: string): CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    borderRadius: 7,
    padding: "9px 13px",
    fontSize: 12,
    cursor: "pointer",
  };
}
