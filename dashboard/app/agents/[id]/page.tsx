"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  Agent,
  AttackCatalog,
  AttackInfo,
  EvalProfileData,
  RedTeamProfileData,
  ModelsResponse,
  ModelInfo,
  ProgressStep,
  TraceSummary,
  RunStatus,
} from "@/lib/api";
import { Panel, PageHeader, Bar } from "@/components/ui";

type EvalResult = {
  groundedness: { pass: number; total: number };
  checks: Record<string, { pass: number; total: number }>;
  cases: { question: string; answer?: string; passed: boolean; checks: Record<string, { passed: boolean; reason: string }> }[];
};
type RedResult = {
  asr: number;
  vulnerable: boolean;
  vulnerable_count: number;
  total_attacks: number;
  recommendation: string;
  trials_per_attack: number;
  attacks: { attack_id: string; attack_name: string; category: string; succeeded: number; trials: number; asr: number }[];
};
type RunRecord = { id: string; kind: string; created_at: string; result: unknown };
type KbChunk = { id: string; content: string };

const CAT_LABELS: Record<string, string> = {
  prompt_injection: "Prompt Injection",
  jailbreak: "Jailbreak",
  pii_exfiltration: "PII Exfiltration",
  system_prompt_leak: "System Prompt Leak",
  instruction_override: "Instruction Override",
};

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [evalRes, setEvalRes] = useState<EvalResult | null>(null);
  const [rtRes, setRtRes] = useState<RedResult | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [catalog, setCatalog] = useState<AttackCatalog | null>(null);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [kbChunks, setKbChunks] = useState<KbChunk[]>([]);
  const [kbText, setKbText] = useState("");

  // run state
  const [busy, setBusy] = useState(false);
  const [runKind, setRunKind] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  // attack selection
  const [selectedAttacks, setSelectedAttacks] = useState<Set<string>>(new Set());

  async function loadAgent(agentId: string) {
    try { setAgent(await api.agent(agentId)); } catch {}
  }

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

  async function loadKb(agentId: string) {
    try {
      const res = await api.listKb(agentId);
      setKbChunks(res.chunks);
    } catch {}
  }

  useEffect(() => {
    if (!id) return;
    loadAgent(id);
    loadRuns(id);
    loadKb(id);
    api.agentTraces(id).then(setTraces).catch(() => {});
    api.attacks().then(setCatalog).catch(() => {});
    api.models().then(setModels).catch(() => {});
  }, [id]);

  async function pollJob(jobId: string) {
    for (let i = 0; i < 200; i++) {
      const s: RunStatus = await api.runStatus(jobId);
      setStatus(s.status);
      if (s.steps) setSteps(s.steps);
      if (s.status === "finished" || s.status === "failed") {
        if (s.status === "failed") {
          setRunError(s.error || "Job failed — check worker logs.");
        }
        await loadRuns(id);
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setBusy(false);
  }

  async function runJob(type: string) {
    setBusy(true);
    setRunKind(type);
    setStatus("queued");
    setSteps([]);
    setRunError(null);
    try {
      const { job_id } = await api.createRun(type, undefined, id);
      await pollJob(job_id);
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : "Failed to enqueue");
      setBusy(false);
    }
  }

  async function runSelectedAttacks() {
    if (selectedAttacks.size === 0) return;
    setBusy(true);
    setRunKind("redteam");
    setStatus("queued");
    setSteps([]);
    setRunError(null);
    try {
      const { job_id } = await api.runAttack(id, [...selectedAttacks]);
      await pollJob(job_id);
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : "Failed to enqueue");
      setBusy(false);
    }
  }

  async function handleModelChange(field: "model", value: string) {
    try {
      const updated = await api.updateAgent(id, { [field]: value });
      setAgent(updated);
    } catch {}
  }

  async function handleGuardrailToggle(key: "spotlight" | "pii_egress") {
    if (!agent) return;
    const updated = await api.updateAgent(id, {
      guardrails: { ...agent.guardrails, [key]: !agent.guardrails[key] },
    });
    setAgent(updated);
  }

  async function handleEvalProfileChange(patch: Partial<EvalProfileData>) {
    try {
      const updated = await api.updateProfiles(id, { eval_profile: patch });
      setAgent(updated);
    } catch {}
  }

  async function handleRedTeamProfileChange(patch: Partial<RedTeamProfileData>) {
    try {
      const updated = await api.updateProfiles(id, { redteam_profile: patch });
      setAgent(updated);
    } catch {}
  }

  async function handleIngestKb() {
    if (!kbText.trim()) return;
    try {
      await api.ingestKb(id, kbText);
      setKbText("");
      await loadKb(id);
    } catch {}
  }

  async function handleDeleteKbChunk(chunkId: string) {
    try {
      await api.deleteKbChunk(id, chunkId);
      await loadKb(id);
    } catch {}
  }

  function toggleAttack(attackId: string) {
    setSelectedAttacks((prev) => {
      const next = new Set(prev);
      next.has(attackId) ? next.delete(attackId) : next.add(attackId);
      return next;
    });
  }

  if (!agent) return <div style={{ padding: 40 }} className="mono">loading…</div>;

  const evalProfile = agent.eval_profile;
  const rtProfile = agent.redteam_profile;

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg)", paddingBottom: 10, borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Link href="/agents" className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>← playground</Link>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)" }}>{agent.name}</span>
              {agent.is_example && <span className="badge accent" style={{ fontSize: 8 }}>example</span>}
              <span className={`badge ${agent.guardrails?.spotlight ? "ok" : ""}`} style={{ fontSize: 8 }}>spotlight {agent.guardrails?.spotlight ? "on" : "off"}</span>
              <span className={`badge ${agent.guardrails?.pii_egress ? "ok" : ""}`} style={{ fontSize: 8 }}>pii {agent.guardrails?.pii_egress ? "on" : "off"}</span>
              {busy && <span className="badge accent" style={{ fontSize: 9 }}>processing · {runKind}</span>}
              {!busy && runError && <span className="badge bad" style={{ fontSize: 9 }}>failed</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <ActionBtn disabled={busy} onClick={() => runJob("pg_eval")} color="var(--accent)" label="Run eval" />
            <ActionBtn disabled={busy} onClick={() => runJob("pg_redteam")} color="var(--bad)" label="Run red-team" />
          </div>
        </div>
      </div>

      {/* Error panel */}
      {runError && !busy && (
        <div style={{ padding: "10px 14px", marginBottom: 14, background: "var(--bad-dim)", border: "1px solid var(--bad)", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--bad)" }}>{runError}</span>
          <button onClick={() => setRunError(null)} className="mono" style={{ fontSize: 10, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>dismiss</button>
        </div>
      )}

      {/* Progress panel */}
      {(busy || steps.length > 0) && (
        <Panel title={`Progress · ${runKind}`} code="▶">
          {steps.length === 0 && <Muted>Waiting for worker…</Muted>}
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 10, width: 14, textAlign: "center" }}>
                {s.status === "done" ? "✓" : s.status === "failed" ? "✗" : s.status === "running" ? "⟳" : "·"}
              </span>
              <span className="mono" style={{ fontSize: 11, color: s.status === "done" ? "var(--ok)" : s.status === "failed" ? "var(--bad)" : s.status === "running" ? "var(--accent)" : "var(--muted)", flex: 1 }}>
                {s.label}
              </span>
              {s.detail && <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{s.detail}</span>}
            </div>
          ))}
        </Panel>
      )}

      {/* Main 3-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "start" }}>

        {/* Column 1: Configuration */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="System prompt" code="⚙">
            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text)", whiteSpace: "pre-wrap" }}>{agent.system_prompt}</div>
          </Panel>

          <Panel title="Models" code="◆">
            {models ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ModelSelect label="Agent model" value={agent.model} options={models.models} onChange={(v) => handleModelChange("model", v)} />
                {evalProfile && (
                  <ModelSelect label="Judge model" value={evalProfile.judge_model || models.defaults.judge} options={models.models}
                    onChange={(v) => handleEvalProfileChange({ judge_model: v })} />
                )}
                {rtProfile && (
                  <ModelSelect label="Attacker model" value={rtProfile.attacker_model || models.defaults.attacker} options={models.models}
                    onChange={(v) => handleRedTeamProfileChange({ attacker_model: v })} />
                )}
              </div>
            ) : <Muted>loading models…</Muted>}
          </Panel>

          <Panel title="Guardrails" code="🛡">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Toggle label="Spotlight / data-marking" checked={agent.guardrails?.spotlight} onChange={() => handleGuardrailToggle("spotlight")} />
              <Toggle label="PII egress filter" checked={agent.guardrails?.pii_egress} onChange={() => handleGuardrailToggle("pii_egress")} />
            </div>
          </Panel>

          {evalProfile && (
            <Panel title="Eval profile" code="✓">
              <div className="label" style={{ marginBottom: 6 }}>Checks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(evalProfile.checks).map(([k, v]) => (
                  <Toggle key={k} label={k} checked={v} onChange={() => handleEvalProfileChange({ checks: { ...evalProfile.checks, [k]: !v } })} />
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="label" style={{ marginBottom: 4 }}>Questions per eval</div>
                <input type="number" className="mono" value={evalProfile.questions_per_eval} min={1} max={20}
                  style={{ width: 60, padding: "4px 8px", fontSize: 11, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text)" }}
                  onChange={(e) => handleEvalProfileChange({ questions_per_eval: Number(e.target.value) })}
                />
              </div>
            </Panel>
          )}

          {rtProfile && (
            <Panel title="Red-team profile" code="⚔">
              <div className="label" style={{ marginBottom: 6 }}>Categories</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(rtProfile.categories).map(([k, v]) => (
                  <Toggle key={k} label={CAT_LABELS[k] || k} checked={v} onChange={() => handleRedTeamProfileChange({ categories: { ...rtProfile.categories, [k]: !v } })} />
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="label" style={{ marginBottom: 4 }}>Trials per attack</div>
                <input type="number" className="mono" value={rtProfile.trials_per_attack} min={1} max={10}
                  style={{ width: 60, padding: "4px 8px", fontSize: 11, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text)" }}
                  onChange={(e) => handleRedTeamProfileChange({ trials_per_attack: Number(e.target.value) })}
                />
              </div>
            </Panel>
          )}
        </div>

        {/* Column 2: Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {evalRes && (
            <Panel title="Eval results" code="A">
              <Bar value={evalRes.groundedness?.pass ?? 0} max={evalRes.groundedness?.total ?? 1} color="var(--ok)" />
              <div className="mono" style={{ fontSize: 13, margin: "8px 0" }}>
                {evalRes.groundedness?.pass}/{evalRes.groundedness?.total} grounded
              </div>
              {Object.entries(evalRes.checks || {}).map(([name, v]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="mono" style={{ fontSize: 11 }}>{name}</span>
                  <span className="mono" style={{ fontSize: 11, color: v.pass === v.total ? "var(--ok)" : "var(--warn)" }}>{v.pass}/{v.total}</span>
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                {evalRes.cases.map((c, i) => (
                  <div key={i} style={{ padding: "7px 0", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, flex: 1 }}>{c.question}</span>
                      <span className={`badge ${c.passed ? "ok" : "bad"}`}>{c.passed ? "pass" : "fail"}</span>
                    </div>
                    {c.checks && Object.entries(c.checks).map(([ck, v]) => (
                      !v.passed && <div key={ck} className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{ck}: {v.reason}</div>
                    ))}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {rtRes && (
            <Panel title="Red-team results" code="B">
              <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                <Metric label="ASR" value={pct(rtRes.asr)} color={rtRes.asr > 0 ? "var(--bad)" : "var(--ok)"} />
                <Metric label="vulnerable" value={`${rtRes.vulnerable_count}/${rtRes.total_attacks}`} color="var(--warn)" />
                <Metric label="trials/attack" value={String(rtRes.trials_per_attack)} color="var(--muted)" />
              </div>
              <div style={{ padding: 10, borderRadius: 6, border: `1px solid ${rtRes.vulnerable ? "var(--bad)" : "var(--ok)"}`, background: "var(--panel-2)", marginBottom: 12 }}>
                <span className={`badge ${rtRes.vulnerable ? "bad" : "ok"}`}>{rtRes.vulnerable ? "vulnerable" : "robust"}</span>
                <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{rtRes.recommendation}</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="label" style={{ padding: "6px 4px", textAlign: "left", fontSize: 8 }}>Attack</th>
                    <th className="label" style={{ padding: "6px 4px", textAlign: "left", fontSize: 8 }}>Category</th>
                    <th className="label" style={{ padding: "6px 4px", textAlign: "center", fontSize: 8 }}>ASR</th>
                    <th className="label" style={{ padding: "6px 4px", textAlign: "center", fontSize: 8 }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rtRes.attacks.map((a) => (
                    <tr key={a.attack_id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="mono" style={{ padding: "6px 4px", fontSize: 10, color: "var(--text-bright)" }}>{a.attack_name}</td>
                      <td className="mono" style={{ padding: "6px 4px", fontSize: 9, color: "var(--muted)" }}>{CAT_LABELS[a.category] || a.category}</td>
                      <td className="mono" style={{ padding: "6px 4px", fontSize: 10, textAlign: "center", color: a.asr > 0 ? "var(--bad)" : "var(--ok)" }}>{Math.round(a.asr * 100)}%</td>
                      <td style={{ padding: "6px 4px", textAlign: "center" }}>
                        <span className={`badge ${a.asr > 0 ? "bad" : "ok"}`} style={{ fontSize: 8 }}>{a.succeeded}/{a.trials}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {!evalRes && !rtRes && (
            <Panel title="Results" code="—">
              <Muted>No results yet — run an eval or red-team assessment.</Muted>
            </Panel>
          )}
        </div>

        {/* Column 3: KB, Traces, Catalog, History */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title={`Knowledge base · ${kbChunks.length}`} code="📄">
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <textarea className="mono" placeholder="Paste KB text to ingest…" value={kbText} onChange={(e) => setKbText(e.target.value)}
                style={{ flex: 1, fontSize: 11, padding: "6px 8px", minHeight: 60, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text)", resize: "vertical" }}
              />
            </div>
            <button onClick={handleIngestKb} className="mono" disabled={!kbText.trim()}
              style={{ fontSize: 10, padding: "4px 12px", background: kbText.trim() ? "var(--accent-dim)" : "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 3, color: kbText.trim() ? "var(--accent)" : "var(--muted)", cursor: kbText.trim() ? "pointer" : "default", marginBottom: 10 }}>
              Ingest text
            </button>
            {kbChunks.length === 0 && <Muted>No KB documents — ingest text above.</Muted>}
            {kbChunks.map((c) => (
              <div key={c.id} style={{ padding: "6px 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--text)", flex: 1 }}>{c.content.slice(0, 120)}{c.content.length > 120 ? "…" : ""}</span>
                <button onClick={() => handleDeleteKbChunk(c.id)} className="mono" style={{ fontSize: 9, color: "var(--bad)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>✗</button>
              </div>
            ))}
          </Panel>

          <Panel title={`Traces · ${traces.length}`} code="⟡">
            {traces.length === 0 && <Muted>No traces — run an assessment to generate traces.</Muted>}
            {traces.slice(0, 10).map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {t.kind && <span className={`badge ${t.kind === "eval" ? "accent" : "bad"}`} style={{ fontSize: 8 }}>{t.kind}</span>}
                  <span className="mono" style={{ fontSize: 10, color: "var(--text)" }}>{String(t.input).slice(0, 60)}</span>
                </div>
                <span className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>{t.span_count}sp</span>
              </div>
            ))}
          </Panel>

          {catalog && (
            <Panel title={`Attack catalog · ${catalog.attacks.length}`} code="⚔"
              right={selectedAttacks.size > 0 ? (
                <button onClick={runSelectedAttacks} disabled={busy} className="mono"
                  style={{ fontSize: 9, padding: "3px 10px", background: "var(--bad-dim)", border: "1px solid var(--bad)", borderRadius: 3, color: "var(--bad)", cursor: busy ? "default" : "pointer" }}>
                  Run {selectedAttacks.size} selected →
                </button>
              ) : null}>
              {Object.entries(catalog.categories).map(([cat, attackIds]) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div className="label" style={{ fontSize: 9, marginBottom: 4 }}>{CAT_LABELS[cat] || cat}</div>
                  {catalog.attacks.filter((a) => attackIds.includes(a.id)).map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                      <input type="checkbox" checked={selectedAttacks.has(a.id)} onChange={() => toggleAttack(a.id)}
                        style={{ accentColor: "var(--bad)" }} />
                      <div style={{ flex: 1 }}>
                        <span className="mono" style={{ fontSize: 10, color: "var(--text-bright)" }}>{a.name}</span>
                        <div className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>{a.description.slice(0, 80)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </Panel>
          )}

          <Panel title={`Run history · ${history.length}`} code="⟳">
            {history.length === 0 && <Muted>No runs yet.</Muted>}
            {history.slice(0, 15).map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${r.kind === "eval" ? "accent" : "bad"}`} style={{ fontSize: 9 }}>{r.kind}</span>
                  <span className="mono" style={{ fontSize: 11 }}>{runSummary(r)}</span>
                </div>
                <span className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>
                  {new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---- helpers ---- */

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

function ModelSelect({ label, value, options, onChange }: { label: string; value: string; options: ModelInfo[]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="label" style={{ fontSize: 9, marginBottom: 3 }}>{label}</div>
      <select className="mono" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", fontSize: 11, padding: "5px 8px", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text)" }}>
        {options.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: "var(--accent)" }} />
      <span className="mono" style={{ fontSize: 11, color: checked ? "var(--text-bright)" : "var(--muted)" }}>{label}</span>
    </label>
  );
}

function ActionBtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="mono"
      style={{ fontSize: 10, padding: "6px 14px", background: disabled ? "var(--panel-2)" : "transparent", border: `1px solid ${color}`, borderRadius: 4, color: disabled ? "var(--muted)" : color, cursor: disabled ? "default" : "pointer" }}>
      {label}
    </button>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="label" style={{ fontSize: 9 }}>{label}</div>
      <div className="kpi" style={{ fontSize: 24, color }}>{value}</div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{children}</p>
);
