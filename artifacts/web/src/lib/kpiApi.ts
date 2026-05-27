// Thin fetch wrapper for the Phase C KPI / drill-down endpoints.
// These endpoints are intentionally not part of the generated OpenAPI client —
// they're frontend-shaped aggregations and we keep the surface area small.

const TOKEN_KEY = "springfield_token";

function authHeader(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function get<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const url = `${base}/api${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...authHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`);
  }
  return res.json() as Promise<T>;
}

export type KpiSummaryValue = {
  value: number;
  label?: string;
  suffix?: string;
  trend?: "ok" | "warning" | "danger";
};

export type KpiSummaryResponse = {
  date: string;
  kpis: Record<string, KpiSummaryValue>;
};

export type KpiDetailRow = Record<string, unknown> & { href?: string };

export type KpiDetailResponse = {
  kpiKey: string;
  title: string;
  summary: Record<string, number>;
  rows: KpiDetailRow[];
};

export type KpiKeyMeta = { key: string; title: string; group: string };

export const KPI_LABELS: Record<
  string,
  { title: string; description?: string }
> = {
  "expected-logs-today": {
    title: "Expected logs",
    description: "Active assignments for the day",
  },
  "submitted-logs-today": {
    title: "Submitted logs",
    description: "Logs filed today",
  },
  "missing-logs": {
    title: "Missing logs",
    description: "Assignments without a log today",
  },
  "teacher-compliance": {
    title: "Teacher compliance",
    description: "Logs submitted vs expected",
  },
  "syllabus-completion": {
    title: "Syllabus completion",
    description: "Topics completed vs total",
  },
  "classes-behind-syllabus": {
    title: "Classes behind",
    description: "Classes with delayed syllabus",
  },
  "subjects-behind-syllabus": {
    title: "Subjects behind",
    description: "Subjects with delayed syllabus",
  },
  "discipline-cases-today": {
    title: "Discipline cases",
    description: "Discipline events recorded today",
  },
  "repeated-discipline-students": {
    title: "Repeated discipline",
    description: "Students with >1 discipline event",
  },
  "repeated-inattentive-students": {
    title: "Repeated inattentive",
    description: "Students flagged inattentive >1×",
  },
  "achievements-recorded": {
    title: "Achievements",
    description: "Achievement events recorded",
  },
  "coordinator-verification-pending": {
    title: "Pending verification",
    description: "Logs awaiting coordinator review",
  },
  "rejected-logs-pending": {
    title: "Rejected logs",
    description: "Need teacher to resubmit",
  },
  "open-tasks": { title: "Open tasks", description: "Tasks still open" },
  "critical-alerts": {
    title: "Critical alerts",
    description: "High-severity, open",
  },
};

export function getKpiSummary(date?: string): Promise<KpiSummaryResponse> {
  const q = date ? `?date=${date}` : "";
  return get<KpiSummaryResponse>(`/kpi/summary${q}`);
}

export function getKpiDetail(
  kpiKey: string,
  params: Record<string, string | number | undefined>,
): Promise<KpiDetailResponse> {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) usp.set(k, String(v));
  }
  const q = usp.toString();
  return get<KpiDetailResponse>(`/kpi/${kpiKey}/detail${q ? `?${q}` : ""}`);
}

export type StudentProfile = {
  student: {
    id: number;
    name: string;
    admissionNo: string;
    rollNo: string | null;
    status: string;
    fatherName: string | null;
    motherName: string | null;
    parentContact: string | null;
    classId: number | null;
    sectionId: number | null;
    className: string;
    sectionName: string;
  };
  counts: Record<string, number>;
  events: Array<{
    id: number;
    eventType: string;
    severity: string;
    status: string;
    remarks: string | null;
    followUpRequired: boolean;
    createdAt: string;
    dailyLogId: number;
    date: string | null;
    subjectName: string;
    teacherName: string;
    href: string;
  }>;
  alerts: Array<{
    id: number;
    title: string;
    message: string;
    severity: string;
    status: string;
  }>;
  tasks: Array<{ id: number; title: string; status: string; priority: string }>;
};

export type TeacherProfile = {
  teacher: { id: number; name: string; email: string };
  counts: Record<string, number>;
  assignments: Array<{
    id: number;
    classId: number;
    sectionId: number;
    subjectId: number;
    className: string;
    sectionName: string;
    subjectName: string;
    href: string;
  }>;
  recentLogs: Array<{
    id: number;
    date: string;
    className: string;
    sectionName: string;
    subjectName: string;
    verificationStatus: string;
    href: string;
  }>;
};

export type ClassSectionProfile = {
  class: { id: number; name: string };
  section: { id: number; name: string };
  counts: Record<string, number>;
  students: Array<{
    id: number;
    name: string;
    admissionNo: string;
    rollNo: string | null;
    status: string;
    href: string;
  }>;
  assignments: Array<{
    id: number;
    teacherId: number;
    teacherName: string;
    subjectId: number;
    subjectName: string;
    href: string;
  }>;
  recentLogs: Array<{
    id: number;
    date: string;
    subjectName: string;
    teacherName: string;
    verificationStatus: string;
    href: string;
  }>;
  syllabusProgress: Array<{
    subjectId: number;
    subjectName: string;
    total: number;
    completed: number;
    delayed: number;
    percent: number;
  }>;
};

export function getStudentProfile(id: number) {
  return get<StudentProfile>(`/profiles/student/${id}`);
}
export function getTeacherProfile(id: number) {
  return get<TeacherProfile>(`/profiles/teacher/${id}`);
}
export function getClassSectionProfile(classId: number, sectionId: number) {
  return get<ClassSectionProfile>(
    `/profiles/class/${classId}/section/${sectionId}`,
  );
}
