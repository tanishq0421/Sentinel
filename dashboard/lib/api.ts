const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export type TraceSummary = {
  id: string;
  name: string;
  input: unknown;
  output: unknown;
  duration_ms: number | null;
  span_count: number;
};

export type Span = {
  id: string;
  name: string;
  type: "retrieval" | "llm" | "tool";
  input: unknown;
  output: unknown;
  duration_ms: number | null;
};

export type TraceDetail = TraceSummary & { spans: Span[] };
export type Annotation = { id: number; trace_id: string; label: string; note: string | null };

export const api = {
  traces: () => get<TraceSummary[]>("/api/traces"),
  trace: (id: string) => get<TraceDetail>(`/api/traces/${id}`),
  results: <T>(name: string) => get<T>(`/api/results/${name}`),
  annotations: (traceId: string) => get<Annotation[]>(`/api/annotations?trace_id=${traceId}`),
  addAnnotation: async (trace_id: string, label: string, note?: string) => {
    const res = await fetch(`${BASE}/api/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trace_id, label, note }),
    });
    if (!res.ok) throw new Error("annotation failed");
    return res.json() as Promise<Annotation>;
  },
};
