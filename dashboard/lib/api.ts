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
  kind?: string;
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
export type ProgressStep = { label: string; status: "pending" | "running" | "done" | "failed"; detail?: string };
export type RunStatus = { id: string; status: string; result?: unknown; steps?: ProgressStep[]; error?: string };
export type Agent = {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  guardrails: { spotlight: boolean; pii_egress: boolean };
  is_example?: boolean;
  eval_profile?: EvalProfileData;
  redteam_profile?: RedTeamProfileData;
};

export type AttackInfo = {
  id: string;
  name: string;
  category: string;
  success_type: string;
  description: string;
};
export type AttackCatalog = {
  attacks: AttackInfo[];
  categories: Record<string, string[]>;
};

export type EvalProfileData = {
  checks: Record<string, boolean>;
  questions_per_eval: number;
  judge_model: string | null;
};
export type RedTeamProfileData = {
  categories: Record<string, boolean>;
  attack_ids: string[] | null;
  trials_per_attack: number;
  attacker_model: string | null;
};
export type ModelInfo = {
  id: string;
  provider: string;
  label: string;
};
export type ModelsResponse = {
  models: ModelInfo[];
  defaults: { agent: string; judge: string; attacker: string };
};
export type RunDetail = {
  id: string;
  agent_id: string;
  kind: string;
  result: Record<string, unknown>;
  created_at: string;
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
  agentTraces: (agentId: string) => get<TraceSummary[]>(`/api/agents/${agentId}/traces`),
  agentRuns: (agentId: string) => get<unknown[]>(`/api/agents/${agentId}/runs`),
  latestRun: (agentId: string, kind: string) =>
    get<{ result: unknown }>(`/api/agents/${agentId}/runs/latest?kind=${kind}`),
  compare: (kind = "eval") => get<{ agents: Agent[]; results: Record<string, unknown> }>(`/api/compare?kind=${kind}`),
  attacks: () => get<AttackCatalog>("/api/attacks"),
  runAttack: async (agentId: string, attackIds?: string[]) => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/attack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attack_ids: attackIds ?? null }),
    });
    if (!res.ok) throw new Error("attack run failed");
    return res.json() as Promise<{ job_id: string }>;
  },
  updateProfiles: async (agentId: string, body: {
    eval_profile?: Partial<EvalProfileData>;
    redteam_profile?: Partial<RedTeamProfileData>;
  }) => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/profiles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("profile update failed");
    return res.json() as Promise<Agent>;
  },
  models: () => get<ModelsResponse>("/api/models"),
  updateAgent: async (agentId: string, body: {
    name?: string;
    system_prompt?: string;
    model?: string;
    guardrails?: { spotlight: boolean; pii_egress: boolean };
  }) => {
    const res = await fetch(`${BASE}/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("agent update failed");
    return res.json() as Promise<Agent>;
  },
  listKb: async (agentId: string) => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/kb`, { cache: "no-store" });
    if (!res.ok) throw new Error("kb list failed");
    return res.json() as Promise<{ chunks: { id: string; content: string }[] }>;
  },
  deleteKbChunk: async (agentId: string, chunkId: string) => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/kb/${chunkId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("kb chunk delete failed");
    return res.json() as Promise<{ deleted: boolean }>;
  },
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
