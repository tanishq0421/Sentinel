"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, TraceDetail, Annotation, Span } from "@/lib/api";
import { Panel, PageHeader } from "@/components/ui";

const LABELS = ["hallucination", "policy_violation", "tool_misuse", "refusal_miss", "ungrounded", "other"];

export default function TraceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [annos, setAnnos] = useState<Annotation[]>([]);
  const [label, setLabel] = useState(LABELS[0]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!id) return;
    api.trace(id).then(setTrace).catch(() => {});
    api.annotations(id).then(setAnnos).catch(() => {});
  }, [id]);

  async function submit() {
    const created = await api.addAnnotation(id, label, note || undefined);
    setAnnos((a) => [...a, created]);
    setNote("");
  }

  if (!trace) return <div style={{ padding: 40 }} className="mono">loading…</div>;

  return (
    <div style={{ padding: "34px 40px", maxWidth: 1000 }}>
      <Link href="/traces" className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>← traces</Link>
      <div style={{ height: 14 }} />
      <PageHeader title={str(trace.input)} sub={`trace ${trace.id.slice(0, 12)}`} />

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
        <Panel title="Execution timeline" code="▸">
          {trace.spans.map((s) => <SpanRow key={s.id} span={s} />)}
          <div style={{ marginTop: 14, padding: 14, borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-2)" }}>
            <div className="label" style={{ marginBottom: 8 }}>final answer</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{str(trace.output)}</div>
          </div>
        </Panel>

        <Panel title="Annotate failure" code="✎">
          <div className="label" style={{ marginBottom: 6 }}>taxonomy label</div>
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mono"
            style={inputStyle}
          >
            {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className="label" style={{ margin: "12px 0 6px" }}>note</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="what failed…" />
          <button onClick={submit} className="mono" style={btnStyle}>+ add annotation</button>

          <div className="label" style={{ margin: "18px 0 8px" }}>annotations · {annos.length}</div>
          {annos.length === 0 && <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>none yet</span>}
          {annos.map((a) => (
            <div key={a.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <span className="badge bad">{a.label}</span>
              {a.note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>{a.note}</div>}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function SpanRow({ span }: { span: Span }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span className={`span-dot t-${span.type}`} style={{ marginTop: 6 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 13, color: "var(--text-bright)" }}>{span.name}</span>
          <span className="badge accent">{span.type}</span>
        </div>
        <pre
          className="mono"
          style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflow: "auto" }}
        >
          {trunc(str(span.output), 360)}
        </pre>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--border-bright)",
  borderRadius: 6,
  color: "var(--text)",
  padding: "8px 10px",
  fontSize: 13,
};
const btnStyle: CSSProperties = {
  marginTop: 12,
  width: "100%",
  background: "var(--accent-dim)",
  border: "1px solid var(--accent)",
  color: "var(--accent)",
  borderRadius: 6,
  padding: "9px",
  fontSize: 12,
  cursor: "pointer",
};

const str = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
