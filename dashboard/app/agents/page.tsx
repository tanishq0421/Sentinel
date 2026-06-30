"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { api, Agent } from "@/lib/api";
import { PageHeader, Panel } from "@/components/ui";

const MODELS = ["openai/gpt-4o-mini", "anthropic/claude-haiku-4-5-20251001"];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("You are a helpful support assistant. Answer ONLY from the knowledge base.");
  const [model, setModel] = useState(MODELS[0]);
  const [kb, setKb] = useState("");
  const [spotlight, setSpotlight] = useState(false);
  const [pii, setPii] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => api.agents().then(setAgents).catch(() => {}).finally(() => setLoaded(true));
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const agent = await api.createAgent({
        name, system_prompt: prompt, model,
        guardrails: { spotlight, pii_egress: pii },
      });
      if (kb.trim()) {
        const { chunks } = await api.ingestKb(agent.id, kb);
        setMsg(`Created "${agent.name}" + indexed ${chunks} KB chunk(s).`);
      } else {
        setMsg(`Created "${agent.name}" (no KB yet).`);
      }
      setName(""); setKb("");
      load();
    } catch (e) {
      setMsg("Error: " + String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1100 }}>
      <PageHeader title="Agent Playground" sub="sentinel // configure · evaluate · red-team" />

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
        <Panel title="New agent" code="+">
          <Field label="name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FitGym Support Bot" style={input} className="mono" />
          </Field>
          <Field label="system prompt">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} />
          </Field>
          <Field label="model">
            <select value={model} onChange={(e) => setModel(e.target.value)} style={input} className="mono">
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="knowledge base (paste docs)">
            <textarea value={kb} onChange={(e) => setKb(e.target.value)} rows={5} placeholder="Paste the agent's policies / docs here…" style={{ ...input, resize: "vertical" }} />
          </Field>
          <div style={{ display: "flex", gap: 18, margin: "4px 0 12px" }}>
            <Toggle on={spotlight} set={setSpotlight} label="spotlighting" />
            <Toggle on={pii} set={setPii} label="PII egress filter" />
          </div>
          <button onClick={create} disabled={busy} className="mono" style={btn}>
            {busy ? "creating…" : "+ create agent"}
          </button>
          {msg && <p className="mono" style={{ fontSize: 11, color: "var(--accent)", marginTop: 10 }}>{msg}</p>}
        </Panel>

        <Panel title={`Agents · ${agents.length}`} code="//">
          {!loaded && <Muted>loading…</Muted>}
          {loaded && agents.length === 0 && <Muted>no agents yet — create one to evaluate + red-team it.</Muted>}
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`} style={row}>
              <div>
                <div className="mono" style={{ fontSize: 14, color: "var(--text-bright)" }}>{a.name}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.model}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {a.guardrails?.spotlight && <span className="badge ok">spotlight</span>}
                {a.guardrails?.pii_egress && <span className="badge ok">pii</span>}
                <span className="badge accent">open →</span>
              </div>
            </Link>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div className="label" style={{ marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label className="mono" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 7, cursor: "pointer", color: on ? "var(--ok)" : "var(--muted)" }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{children}</p>
);

const input: CSSProperties = {
  width: "100%", background: "var(--bg)", border: "1px solid var(--border-bright)",
  borderRadius: 6, color: "var(--text)", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-body)",
};
const btn: CSSProperties = {
  width: "100%", background: "var(--accent-dim)", border: "1px solid var(--accent)",
  color: "var(--accent)", borderRadius: 6, padding: "10px", fontSize: 12, cursor: "pointer",
};
const row: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "11px 0", borderBottom: "1px solid var(--border)",
};
