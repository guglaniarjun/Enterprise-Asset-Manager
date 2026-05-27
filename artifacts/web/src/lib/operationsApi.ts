const TOKEN_KEY = "springfield_token";

function authHeader(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/api${path}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url(path), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`);
  }
  // Some endpoints return 201 with body, some 204
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("application/json")) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const opsGet = <T>(path: string) => request<T>("GET", path);
export const opsPost = <T>(path: string, body?: unknown) =>
  request<T>("POST", path, body);
export const opsPatch = <T>(path: string, body?: unknown) =>
  request<T>("PATCH", path, body);

// ─── Types ─────────────────────────────────────────────────────────────────

export type SlaInfo = {
  breached: boolean;
  hoursOver: number;
  dueAt: string | null;
};

export type OpsTask = {
  id: number;
  tenantId: number;
  title: string;
  description: string | null;
  module: string | null;
  priority: string;
  assignedTo: number | null;
  dueDate: string | null;
  status: string;
  createdBy: number | null;
  sourceType: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  resolutionNotes: string | null;
  slaHours: number | null;
  slaBreachedAt: string | null;
  escalationLevel: number;
  escalatedAt: string | null;
  escalatedToUserId: number | null;
  createdAt: string;
  updatedAt: string;
  assignedToName: string | null;
  createdByName: string | null;
  escalatedToName: string | null;
  sla: SlaInfo;
  allowedTransitions?: string[];
};

export type OpsAlert = {
  id: number;
  tenantId: number;
  alertType: string;
  severity: string;
  message: string;
  module: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: string;
  assignedTo: number | null;
  createdAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: number | null;
  resolvedBy: number | null;
  resolutionNotes: string | null;
  slaHours: number | null;
  slaBreachedAt: string | null;
  escalationLevel: number;
  escalatedAt: string | null;
  escalatedToUserId: number | null;
  assignedToName: string | null;
  acknowledgedByName: string | null;
  resolvedByName: string | null;
  escalatedToName: string | null;
  sla: SlaInfo;
  allowedTransitions?: string[];
};

export type Activity = {
  id: number;
  tenantId: number;
  userId: number | null;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  notes: string | null;
  createdAt: string;
  userName: string | null;
};

export type FollowUp = {
  id: number;
  tenantId: number;
  title: string;
  notes: string | null;
  sourceType: string | null;
  sourceId: string | null;
  studentId: number | null;
  studentName: string | null;
  studentAdmissionNo: string | null;
  scheduledFor: string;
  assignedTo: number | null;
  assignedToName: string | null;
  createdBy: number | null;
  createdByName: string | null;
  status: string;
  completedAt: string | null;
  completedBy: number | null;
  completedByName: string | null;
  outcome: string | null;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
};

export type SlaPolicy = {
  id: number;
  tenantId: number;
  scope: string;
  matchKey: string;
  hoursToResolve: number;
  hoursToEscalate: number | null;
  escalateToRole: string | null;
  isActive: boolean;
};

export type SlaStatus = {
  summary: {
    openTasks: number;
    openAlerts: number;
    breachedTasks: number;
    breachedAlerts: number;
    atRiskTasks: number;
    atRiskAlerts: number;
    newlyFlagged: number;
  };
  breached: Array<{
    scope: "task" | "alert";
    id: number;
    title: string;
    severity?: string;
    priority?: string;
    status: string;
    hoursOver: number;
    dueAt: string | null;
    assignedTo: number | null;
  }>;
};

export type AccountabilityRow = {
  userId: number;
  userName: string;
  openTasks: number;
  doneTasks: number;
  breachedTasks: number;
  avgResolutionHours: number;
  openAlerts: number;
  resolvedAlerts: number;
  breachedAlerts: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
};

export type AccountabilityResponse = {
  global: {
    totalTasks: number;
    totalAlerts: number;
    totalFollowUps: number;
    mttrHours: number;
    unassignedTasks: number;
    unassignedAlerts: number;
  };
  owners: AccountabilityRow[];
};

// ─── Endpoints ─────────────────────────────────────────────────────────────

export const listOpsTasks = (
  q: Record<string, string | number | boolean | undefined> = {},
) => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(q))
    if (v !== undefined && v !== "" && v !== null) usp.set(k, String(v));
  const s = usp.toString();
  return opsGet<{ data: OpsTask[]; total: number }>(
    `/operations/tasks${s ? `?${s}` : ""}`,
  );
};
export const getOpsTask = (id: number) =>
  opsGet<OpsTask>(`/operations/tasks/${id}`);
export const getOpsTaskActivity = (id: number) =>
  opsGet<{ data: Activity[] }>(`/operations/tasks/${id}/activity`);
export const setOpsTaskStatus = (id: number, status: string, notes?: string) =>
  opsPatch<OpsTask>(`/operations/tasks/${id}/status`, { status, notes });
export const reassignOpsTask = (
  id: number,
  assignedTo: number,
  notes?: string,
) =>
  opsPost<OpsTask>(`/operations/tasks/${id}/reassign`, { assignedTo, notes });
export const commentOpsTask = (id: number, notes: string) =>
  opsPost<{ ok: true }>(`/operations/tasks/${id}/comment`, { notes });
export const escalateOpsTask = (
  id: number,
  escalateTo?: number,
  notes?: string,
) =>
  opsPost<OpsTask>(`/operations/tasks/${id}/escalate`, { escalateTo, notes });

export const listOpsAlerts = (q: Record<string, string | undefined> = {}) => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) usp.set(k, v);
  const s = usp.toString();
  return opsGet<{ data: OpsAlert[]; total: number }>(
    `/operations/alerts${s ? `?${s}` : ""}`,
  );
};
export const getOpsAlertActivity = (id: number) =>
  opsGet<{ data: Activity[] }>(`/operations/alerts/${id}/activity`);
export const setOpsAlertStatus = (id: number, status: string, notes?: string) =>
  opsPatch<OpsAlert>(`/operations/alerts/${id}/status`, { status, notes });
export const assignOpsAlert = (
  id: number,
  assignedTo: number,
  notes?: string,
) =>
  opsPost<OpsAlert>(`/operations/alerts/${id}/assign`, { assignedTo, notes });
export const escalateOpsAlert = (
  id: number,
  escalateTo?: number,
  notes?: string,
) =>
  opsPost<OpsAlert>(`/operations/alerts/${id}/escalate`, { escalateTo, notes });
export const commentOpsAlert = (id: number, notes: string) =>
  opsPost<{ ok: true }>(`/operations/alerts/${id}/comment`, { notes });

export const listFollowUps = (
  q: Record<string, string | number | boolean | undefined> = {},
) => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(q))
    if (v !== undefined && v !== "" && v !== null) usp.set(k, String(v));
  const s = usp.toString();
  return opsGet<{ data: FollowUp[]; total: number }>(
    `/operations/follow-ups${s ? `?${s}` : ""}`,
  );
};
export const createFollowUp = (data: {
  title: string;
  notes?: string;
  sourceType?: string;
  sourceId?: string;
  studentId?: number;
  scheduledFor: string;
  assignedTo?: number;
}) => opsPost<FollowUp>(`/operations/follow-ups`, data);
export const updateFollowUp = (
  id: number,
  data: Partial<{
    title: string;
    notes: string;
    assignedTo: number;
    status: string;
    outcome: string;
    scheduledFor: string;
  }>,
) => opsPatch<FollowUp>(`/operations/follow-ups/${id}`, data);

export const listSlaPolicies = () =>
  opsGet<{
    data: SlaPolicy[];
    defaults: { task: Record<string, number>; alert: Record<string, number> };
  }>(`/operations/sla/policies`);
export const upsertSlaPolicy = (data: {
  scope: "task" | "alert";
  matchKey: string;
  hoursToResolve: number;
  hoursToEscalate?: number;
  escalateToRole?: string;
  isActive?: boolean;
}) => opsPost<SlaPolicy>(`/operations/sla/policies`, data);
export const getSlaStatus = () => opsGet<SlaStatus>(`/operations/sla/status`);

export const getAccountability = () =>
  opsGet<AccountabilityResponse>(`/operations/accountability`);

// Helpers for use in tables
export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round((h / 24) * 10) / 10}d`;
}
