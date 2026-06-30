import React from "react";

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {sub && <div className="label" style={{ marginBottom: 6, fontSize: 9 }}>{sub}</div>}
      <h1
        className="mono"
        style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-bright)", letterSpacing: "-0.02em" }}
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
  dense,
}: {
  title?: string;
  code?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  dense?: boolean;
}) {
  return (
    <section className="panel rise" style={{ padding: dense ? 12 : 16, ...style }}>
      {(title || right) && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: dense ? 10 : 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {code && <span className="mono" style={{ fontSize: 9, color: "var(--accent)", opacity: 0.7 }}>{code}</span>}
            <span className="label" style={{ color: "var(--text)", fontSize: 10 }}>{title}</span>
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
    <div style={{ height: 5, background: "var(--panel-3)", borderRadius: 1, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

export function asrColor(asr: number): string {
  if (asr <= 0) return "var(--ok)";
  if (asr < 0.25) return "var(--warn)";
  return "var(--bad)";
}
