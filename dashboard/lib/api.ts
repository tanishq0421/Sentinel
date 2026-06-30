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
export type RunStatus = { id: string; status: string; result?: unknown };
export type Agent = {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  guardrails: { spotlight: boolean; pii_egress: boolean };
  is_example?: boolean;
};

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
  createRun: async (type: string, model?: string, agent_id?: string) => {
    const res = await fetch(`${BASE}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, model, agent_id }),
    });
    if (!res.ok) throw new Error("run failed to enqueue");
    return res.json() as Promise<{ job_id: string }>;
  },
  runStatus: (id: string) => get<RunStatus>(`/api/runs/${id}`),
  agents: () => get<Agent[]>("/api/agents"),
  agent: (id: string) => get<Agent>(`/api/agents/${id}`),
  createAgent: async (body: {
    name: string;
    system_prompt: string;
    model?: string;
    guardrails?: { spotlight: boolean; pii_egress: boolean };
  }) => {
    const res = await fetch(`${BASE}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("create agent failed");
    return res.json() as Promise<Agent>;
  },
  get: <T>(path: string) => get<T>(path),
  agentRuns: (agentId: string) => get<unknown[]>(`/api/agents/${agentId}/runs`),
  latestRun: (agentId: string, kind: string) =>
    get<{ result: unknown }>(`/api/agents/${agentId}/runs/latest?kind=${kind}`),
  compare: (kind = "eval") => get<{ agents: Agent[]; results: Record<string, unknown> }>(`/api/compare?kind=${kind}`),
  ingestKb: async (agentId: string, text: string) => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/kb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("kb ingest failed");
    return res.json() as Promise<{ chunks: number }>;
  },
};
