"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { api } from "@/lib/api";
import { Panel, PageHeader, Bar, asrColor } from "@/components/ui";

type EvalData = {
  pass_rates: Record<string, { pass: number; total: number }>;
  taxonomy: Record<string, { ticket_id: string; reason: string }[]>;
};
type CrossModel = { by_model: Record<string, { success: number; total: number; asr: number }> };
type Guardrails = {
  before: { overall_asr: number; by_category: Record<string, { success: number; total: number }> };
  after: { overall_asr: number; by_category: Record<string, { success: number; total: number }> };
};
type Mart = Record<string, { round: number; asr: number }[]>;

export default function Overview() {
  const [evals, setEvals] = useState<EvalData | null>(null);
  const [cross, setCross] = useState<CrossModel | null>(null);
  const [guard, setGuard] = useState<Guardrails | null>(null);
  const [mart, setMart] = useState<Mart | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.results<EvalData>("half_a_eval"),
      api.results<CrossModel>("half_b_crossmodel"),
      api.results<Guardrails>("half_b_guardrails"),
      api.results<Mart>("half_b_mart"),
    ])
      .then(([e, c, g, m]) => {
        setEvals(e);
        setCross(c);
        setGuard(g);
        setMart(m);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1180 }}>
      <PageHeader title="Operations Overview" sub="sentinel // agent assurance" />
      {err && <ErrBox msg={err} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
        <Kpi label="Claude ASR" value={cross ? pct(cross.by_model["claude-haiku"]?.asr) : "—"} tone="ok" hint="robust" />
        <Kpi label="GPT-4o-mini ASR" value={cross ? pct(cross.by_model["gpt-4o-mini"]?.asr) : "—"} tone="bad" hint="baseline" />
        <Kpi label="ASR w/ guardrails" value={guard ? pct(guard.after.overall_asr) : "—"} tone="ok" hint="GPT-4o-mini" />
        <Kpi label="Eval pass" value={evals ? evalPass(evals) : "—"} tone="accent" hint="15 tickets" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {evals && (
          <Panel title="Eval pass rates" code="A">
            {Object.entries(evals.pass_rates).map(([name, r]) => (
              <Row key={name} label={name} value={`${r.pass}/${r.total}`} ratio={r.pass / r.total} color="var(--ok)" />
            ))}
            <div className="label" style={{ marginTop: 16, marginBottom: 8 }}>failure taxonomy</div>
            {Object.entries(evals.taxonomy).length === 0 && <Muted>no failures</Muted>}
            {Object.entries(evals.taxonomy).map(([cat, items]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                <span className="mono" style={{ color: "var(--bad)" }}>{cat}</span>
                <span className="badge bad">{items.length}</span>
              </div>
            ))}
          </Panel>
        )}

        {cross && (
          <Panel title="Cross-model attack success" code="B">
            {Object.entries(cross.by_model).map(([model, r]) => (
              <Row key={model} label={model} value={`${r.success}/${r.total} · ${pct(r.asr)}`} ratio={r.asr} color={asrColor(r.asr)} />
            ))}
            <Muted style={{ marginTop: 14 }}>
              same 8 injection attacks (rag + tool surfaces). robustness is model-dependent.
            </Muted>
          </Panel>
        )}

        {guard && (
          <Panel title="Guardrails — before / after" code="C">
            {Object.keys(guard.before.by_category).map((cat) => {
              const b = guard.before.by_category[cat];
              const a = guard.after.by_category[cat];
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span className="mono">{cat}</span>
                    <span className="mono" style={{ color: "var(--muted)" }}>
                      <span style={{ color: "var(--bad)" }}>{b.success}/{b.total}</span> → <span style={{ color: "var(--ok)" }}>{a.success}/{a.total}</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ flex: 1 }}><Bar value={b.success} max={b.total} color="var(--bad)" /></div>
                    <div style={{ flex: 1 }}><Bar value={a.success} max={a.total} color="var(--ok)" /></div>
                  </div>
                </div>
              );
            })}
            <Muted>spotlighting + refund confirmation + PII egress filter</Muted>
          </Panel>
        )}

        {mart && <MartPanel mart={mart} />}
      </div>
    </div>
  );
}

function MartPanel({ mart }: { mart: Mart }) {
  const W = 460, H = 150, pad = 28;
  const rounds = Math.max(...Object.values(mart).map((s) => s.length), 1);
  const x = (r: number) => pad + (r / Math.max(rounds - 1, 1)) * (W - pad * 2);
  const y = (asr: number) => H - pad - asr * (H - pad * 2);
  const colors: Record<string, string> = { "gpt-4o-mini": "var(--bad)", "claude-haiku": "var(--ok)" };
  return (
    <Panel title="MART adaptive red-team" code="D">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={6} y={y(g) + 3} fill="var(--muted)" fontSize="9" fontFamily="monospace">{g * 100}%</text>
          </g>
        ))}
        {Object.entries(mart).map(([model, series]) => (
          <g key={model}>
            <polyline
              fill="none"
              stroke={colors[model] ?? "var(--accent)"}
              strokeWidth="2"
              points={series.map((p) => `${x(p.round)},${y(p.asr)}`).join(" ")}
            />
            {series.map((p) => (
              <circle key={p.round} cx={x(p.round)} cy={y(p.asr)} r="3.5" fill={colors[model] ?? "var(--accent)"} />
            ))}
          </g>
        ))}
        {Array.from({ length: rounds }).map((_, r) => (
          <text key={r} x={x(r)} y={H - 8} fill="var(--muted)" fontSize="9" textAnchor="middle" fontFamily="monospace">R{r}</text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {Object.keys(mart).map((m) => (
          <span key={m} className="mono" style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="span-dot" style={{ background: colors[m] ?? "var(--accent)" }} />
            {m}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone: "ok" | "bad" | "accent"; hint: string }) {
  const c = tone === "ok" ? "var(--ok)" : tone === "bad" ? "var(--bad)" : "var(--accent)";
  return (
    <div className="panel rise" style={{ padding: 16 }}>
      <div className="label" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="kpi" style={{ fontSize: 30, color: c, margin: "6px 0 2px" }}>{value}</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{hint}</div>
    </div>
  );
}

function Row({ label, value, ratio, color }: { label: string; value: string; ratio: number; color: string }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
        <span className="mono">{label}</span>
        <span className="mono" style={{ color: "var(--muted)" }}>{value}</span>
      </div>
      <Bar value={ratio} color={color} />
    </div>
  );
}

const Muted = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p className="mono" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, margin: 0, ...style }}>{children}</p>
);

const ErrBox = ({ msg }: { msg: string }) => (
  <div className="panel" style={{ padding: 14, marginBottom: 14, borderColor: "var(--bad)" }}>
    <span className="mono" style={{ color: "var(--bad)", fontSize: 12 }}>API unreachable — run: uvicorn sentinel.api.main:app ({msg})</span>
  </div>
);

const pct = (v?: number) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const evalPass = (e: EvalData) => {
  const vals = Object.values(e.pass_rates);
  const p = vals.reduce((s, r) => s + r.pass, 0);
  const t = vals.reduce((s, r) => s + r.total, 0);
  return `${Math.round((p / t) * 100)}%`;
};
