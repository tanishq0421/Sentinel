import React from "react";

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div className="label" style={{ marginBottom: 8 }}>{sub}</div>
      <h1
        className="mono"
        style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}
      >
        {title}
      </h1>
    </div>
  );
}

export function Panel({
  title,
  code,
  right,
  children,
  style,
}: {
  title?: string;
  code?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section className="panel rise" style={{ padding: 18, ...style }}>
      {(title || right) && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {code && <span className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>{code}</span>}
            <span className="label" style={{ color: "var(--text)" }}>{title}</span>
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Bar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: 8, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
}

export function asrColor(asr: number): string {
  if (asr <= 0) return "var(--ok)";
  if (asr < 0.25) return "var(--warn)";
  return "var(--bad)";
}
