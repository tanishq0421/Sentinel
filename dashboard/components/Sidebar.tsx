"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", code: "01" },
  { href: "/compare", label: "Leaderboard", code: "02" },
  { href: "/agents", label: "Playground", code: "03" },
  { href: "/runs", label: "Runs", code: "04" },
  { href: "/traces", label: "Traces", code: "05" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside
      style={{
        width: 232,
        flex: "none",
        borderRight: "1px solid var(--border)",
        background: "linear-gradient(180deg, var(--panel), var(--bg))",
        padding: "22px 16px",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: "var(--accent)",
            boxShadow: "0 0 12px var(--accent)",
          }}
        />
        <span className="mono" style={{ fontWeight: 700, letterSpacing: "0.18em", color: "var(--text-bright)" }}>
          SENTINEL
        </span>
      </div>
      <div className="label" style={{ marginLeft: 22, marginBottom: 28, fontSize: 9 }}>
        eval · red-team console
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                gap: 10,
                padding: "9px 11px",
                borderRadius: 7,
                fontSize: 13,
                color: active ? "var(--text-bright)" : "var(--muted)",
                background: active ? "var(--panel-2)" : "transparent",
                border: `1px solid ${active ? "var(--border-bright)" : "transparent"}`,
                borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              }}
            >
              <span style={{ fontSize: 10, color: active ? "var(--accent)" : "var(--muted)" }}>{n.code}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="mono"
        style={{ position: "absolute", bottom: 18, left: 16, right: 16, fontSize: 10, color: "var(--muted)", lineHeight: 1.7 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>agent</span>
          <span style={{ color: "var(--accent)" }}>claude-haiku</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>rag</span>
          <span style={{ color: "var(--text)" }}>pgvector+bm25</span>
        </div>
      </div>
    </aside>
  );
}
