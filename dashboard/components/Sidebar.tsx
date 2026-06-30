"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", code: "01" },
  { href: "/compare", label: "Leaderboard", code: "02" },
  { href: "/agents", label: "Playground", code: "03" },
  { href: "/runs", label: "Runs", code: "04" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside
      style={{
        width: 200,
        flex: "none",
        borderRight: "1px solid var(--border)",
        background: "var(--panel)",
        padding: "16px 10px",
        position: "sticky",
        top: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px", marginBottom: 2 }}>
        <div style={{ position: "relative" }}>
          <span
            style={{
              width: 8,
              height: 8,
              display: "block",
              borderRadius: 1,
              background: "var(--accent)",
              boxShadow: "0 0 10px var(--accent), 0 0 20px rgba(0,212,255,0.2)",
            }}
          />
        </div>
        <span className="mono" style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.2em", color: "var(--text-bright)" }}>
          SENTINEL
        </span>
      </div>
      <div className="mono" style={{ padding: "0 6px", marginBottom: 20, fontSize: 8, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>
        agent security · analysis
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className="mono"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 2,
                fontSize: 12,
                color: active ? "var(--text-bright)" : "var(--muted)",
                background: active ? "var(--panel-3)" : "transparent",
                borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 9, color: active ? "var(--accent)" : "var(--muted)", opacity: 0.7, minWidth: 14 }}>{n.code}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mono" style={{ padding: "8px 6px", fontSize: 9, color: "var(--muted)", borderTop: "1px solid var(--border)", lineHeight: 1.8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>model</span>
          <span style={{ color: "var(--accent)" }}>haiku</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>rag</span>
          <span style={{ color: "var(--text)" }}>hybrid</span>
        </div>
      </div>
    </aside>
  );
}
