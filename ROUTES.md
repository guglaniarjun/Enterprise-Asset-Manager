# API Routes — Springfield AI Command Center

All routes are served under the `/api` prefix by `artifacts/api-server`.
Unless noted, every route requires a valid JWT (`authenticate` middleware) and
a resolved tenant (`requireTenant` middleware). RBAC groups are defined in
`artifacts/api-server/src/lib/rbac.ts`.

Legend
- 🔓 unauthenticated
- 👤 authenticated, any role
- 🧑‍🏫 ALL_STAFF (Teacher + Coordinator + Principal + Director + Admins)
- 🧭 LEADERSHIP_AND_COORDINATOR (Coordinator + Principal + Director + Admins)
- 🎓 LEADERSHIP (Principal + Director + Admins)
- 🛠 ADMIN_AND_PRINCIPAL
- 🏛 TENANT_ADMIN (+ Super Admin)
- ⚠️ DEPRECATED — use the linked successor

---

## Auth (`auth.ts`)
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/login` | 🔓 | Email + password → JWT + refresh |
| POST | `/auth/refresh` | 🔓 (refresh cookie) | Rotate access token |
| POST | `/auth/logout` | 🔓 | Clears refresh cookie |
| GET | `/auth/me` | 👤 | Current user + roles |

## Health (`health.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/healthz` | 🔓 |

## Users (`users.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/users` | 🎓 |
| POST | `/users` | 🏛 |
| GET | `/users/:id` | 🎓 |
| PATCH | `/users/:id` | 🏛 |
| POST | `/users/:id/roles` | 🏛 |

## Branches (`branches.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/branches` | 🧑‍🏫 |
| POST | `/branches` | 🏛 |

## Houses (`houses.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/houses` | 🧑‍🏫 |
| POST | `/houses` | 🏛 |

---

## Academic structure

### Classes (`classes.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/classes` | 🧑‍🏫 |
| POST | `/classes` | 🛠 |
| PATCH | `/classes/:id` | 🛠 |

### Sections (`sections.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/sections` | 🧑‍🏫 |
| POST | `/sections` | 🛠 |
| PATCH | `/sections/:id` | 🛠 |

### Subjects (`subjects.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/subjects` | 🧑‍🏫 |
| POST | `/subjects` | 🛠 |
| PATCH | `/subjects/:id` | 🛠 |

### Teacher assignments (`teacherAssignments.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/teacher-assignments` | 🧑‍🏫 |
| POST | `/teacher-assignments` | 🛠 |
| PATCH | `/teacher-assignments/:id` | 🛠 |
| DELETE | `/teacher-assignments/:id` | 🛠 |

### Students (`students.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/students` | 🧑‍🏫 |
| GET | `/students/import/preview` | 🛠 |
| POST | `/students/import/preview` | 🛠 |
| POST | `/students/import/confirm` | 🛠 |
| GET | `/students/:id` | 🧑‍🏫 |
| PATCH | `/students/:id` | 🧭 |
| GET | `/students/:id/events` | 🧑‍🏫 |

---

## Academic monitoring

### Syllabus (`syllabus.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/syllabus/summary` | 🧭 |
| GET | `/syllabus` | 🧑‍🏫 |
| POST | `/syllabus` | 🧑‍🏫 |
| GET | `/syllabus/:id` | 🧑‍🏫 |
| PATCH | `/syllabus/:id` | 🧑‍🏫 |
| PATCH | `/syllabus/:id/verify` | 🧭 |

### Daily class logs (`logs.ts`)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/logs/missing` | 🧭 | per date |
| GET | `/logs/compliance` | 🧭 | per date range |
| GET | `/logs` | 🧑‍🏫 | paginated; teachers see only their own |
| POST | `/logs` | 🧑‍🏫 | enforces teacher-assignment match |
| GET | `/logs/:id` | 🧑‍🏫 | teachers limited to own logs |
| PATCH | `/logs/:id` | 🧑‍🏫 | Draft/Rejected only for teachers |
| POST | `/logs/:id/submit` | 🧑‍🏫 | atomic state transition Draft/Rejected → Pending |
| POST | `/logs/:id/verify` | 🧭 | atomic Pending → Verified |
| POST | `/logs/:id/reject` | 🧭 | atomic Pending → Rejected |

### Student events (`events.ts`)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/events` | 🧑‍🏫 | filters: studentId, eventType, status, date range |
| POST | `/events` | 🧑‍🏫 | **transactional** (event + audit committed together); enforces log ownership + class/section match |
| PATCH | `/events/:id/resolve` | 🧭 | |

---

## OCR (`ocr.ts`)
| Method | Path | Access |
|---|---|---|
| POST | `/ocr/upload` | 🧑‍🏫 |
| GET | `/ocr/:id` | 🧑‍🏫 |

## Notifications (`notifications.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/notifications` | 👤 |
| POST | `/notifications/:id/read` | 👤 |
| POST | `/notifications/read-all` | 👤 |

## Audit logs (`auditLogs.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/audit-logs` | 👤 (filtered by tenant) |

## Exports (`exports.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/export/logs` | 🧭 |
| GET | `/export/events` | 🧭 |

---

## Dashboards & analytics (`dashboard.ts`)
| Method | Path | Access |
|---|---|---|
| GET | `/dashboard/director` | 🎓 |
| GET | `/dashboard/principal` | 🎓 |
| GET | `/dashboard/teacher` | 🧑‍🏫 |
| GET | `/dashboard/coordinator` | 🧭 |
| GET | `/analytics/compliance` | 🧭 |
| GET | `/analytics/discipline` | 🧭 |

---

## KPI (`kpi.ts`)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/kpi/keys` | 🧑‍🏫 | metadata catalog |
| GET | `/kpi/summary` | 🧭 | role-scoped KPI cards |
| GET | `/kpi/:kpiKey/detail` | 🧭 | drill-down for a single KPI |
| GET | `/alerts/:id/source` | 🧭 | resolve alert → source entity href |
| GET | `/tasks/:id/source` | 🧑‍🏫 | resolve task → source entity href |
| GET | `/profiles/student/:id` | 🧑‍🏫 | student 360 |
| GET | `/profiles/teacher/:id` | 🧭 | teacher 360 |
| GET | `/profiles/class/:classId/section/:sectionId` | 🧭 | class/section 360 |

---

## Operations — Action Layer (`operations.ts`)

The canonical home for task & alert lifecycle, follow-ups, SLAs, and accountability.

### Tasks
| Method | Path | Access |
|---|---|---|
| GET | `/operations/tasks` | 🧑‍🏫 |
| GET | `/operations/tasks/:id` | 🧑‍🏫 |
| GET | `/operations/tasks/:id/activity` | 🧑‍🏫 |
| PATCH | `/operations/tasks/:id/status` | 🧑‍🏫 |
| POST | `/operations/tasks/:id/reassign` | 🧑‍🏫 |
| POST | `/operations/tasks/:id/comment` | 🧑‍🏫 |
| POST | `/operations/tasks/:id/escalate` | 🧭 |

### Alerts
| Method | Path | Access |
|---|---|---|
| GET | `/operations/alerts` | 🧭 |
| GET | `/operations/alerts/:id/activity` | 🧭 |
| PATCH | `/operations/alerts/:id/status` | 🧭 |
| POST | `/operations/alerts/:id/assign` | 🧭 |
| POST | `/operations/alerts/:id/escalate` | 🧭 |
| POST | `/operations/alerts/:id/comment` | 🧭 |

### Follow-ups
| Method | Path | Access |
|---|---|---|
| GET | `/operations/follow-ups` | 🧑‍🏫 |
| POST | `/operations/follow-ups` | 🧑‍🏫 |
| PATCH | `/operations/follow-ups/:id` | 🧑‍🏫 |
| DELETE | `/operations/follow-ups/:id` | 🧑‍🏫 |

### SLA & accountability
| Method | Path | Access |
|---|---|---|
| GET | `/operations/sla/status` | 🧭 |
| GET | `/operations/sla/policies` | 🧭 |
| POST | `/operations/sla/policies` | 🎓 |
| GET | `/operations/accountability` | 🧭 |

---

## ⚠️ Deprecated routes

These are kept mounted for OpenAPI-client backward compatibility only. The
frontend does not call them. Every response carries `Deprecation: true` and a
`Sunset` header.

| Method | Path | Successor | File |
|---|---|---|---|
| GET | `/tasks` | `/operations/tasks` | `tasks.ts` |
| POST | `/tasks` | `/operations/tasks` (created by automation; no public create yet) | `tasks.ts` |
| PATCH | `/tasks/:id` | `/operations/tasks/:id/status` + `/reassign` | `tasks.ts` |
| GET | `/alerts` | `/operations/alerts` | `alerts.ts` |
| POST | `/alerts` | `/operations/alerts` (created by automation) | `alerts.ts` |
| PATCH | `/alerts/:id/acknowledge` | `/operations/alerts/:id/status` (`Acknowledged`) | `alerts.ts` |
| PATCH | `/alerts/:id/resolve` | `/operations/alerts/:id/status` (`Resolved`) | `alerts.ts` |

**Sunset target:** 2026-12-31. After that date, delete `tasks.ts`/`alerts.ts`,
remove the OpenAPI paths, regenerate `lib/api-client-react`, and unmount in
`routes/index.ts`.

Note: `kpi.ts` also exposes `/alerts/:id/source` and `/tasks/:id/source` —
those are KPI helpers, not legacy CRUD, and are **not** deprecated.
