"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Outcome = { id: string; description: string };
type Task = {
  id: string;
  title: string;
  estimatedHours: number;
  outcomeId: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
};
type Resource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  outcomeId: string | null;
};
type Subject = {
  id: string;
  name: string;
  deadline: string | null;
  outcomes: Outcome[];
  tasks: Task[];
  resources: Resource[];
};

const RESOURCE_TYPES = ["Reading", "Video", "Notes", "Exercise", "Other"];
const STATUS_LABEL: Record<Task["status"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
};

async function api(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Network error, please try again" } };
  }
}

export default function PlanDetailClient({
  planId,
  planTitle,
}: {
  planId: string;
  planTitle: string;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [newOutcome, setNewOutcome] = useState<Record<string, string>>({});
  const [outcomeError, setOutcomeError] = useState<Record<string, string>>({});

  const [taskForm, setTaskForm] = useState<
    Record<string, { title: string; hours: string; outcomeId: string }>
  >({});
  const [taskError, setTaskError] = useState<Record<string, string>>({});

  const [resForm, setResForm] = useState<
    Record<
      string,
      { title: string; type: string; url: string; outcomeId: string }
    >
  >({});
  const [resError, setResError] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setLoadError("");
    const { ok, data } = await api(`/api/plans/${planId}/subjects`, "GET");
    if (!ok) setLoadError(data.error ?? "Failed to load subjects");
    else setSubjects(data);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    const { ok, data } = await api(`/api/plans/${planId}/subjects`, "POST", {
      name,
      deadline: deadline || null,
    });
    setSaving(false);
    if (!ok) return setFormError(data.error ?? "Could not add subject");
    setName("");
    setDeadline("");
    await load();
  }

  async function editSubject(s: Subject) {
    const newName = prompt("Subject name:", s.name);
    if (newName === null) return;
    const newDeadline = prompt(
      "Subject deadline (YYYY-MM-DD, leave empty for none):",
      s.deadline ? s.deadline.slice(0, 10) : "",
    );
    if (newDeadline === null) return;
    const { ok, data } = await api(`/api/subjects/${s.id}`, "PATCH", {
      name: newName,
      deadline: newDeadline || null,
    });
    if (!ok) return alert(data.error ?? "Could not update subject");
    await load();
  }

  async function deleteSubject(s: Subject) {
    if (!confirm(`Delete subject "${s.name}" and everything in it?`)) return;
    const { ok, data } = await api(`/api/subjects/${s.id}`, "DELETE");
    if (!ok) return alert(data.error ?? "Could not delete subject");
    await load();
  }

  // ---------- outcomes ----------
  async function addOutcome(subjectId: string) {
    setOutcomeError((e) => ({ ...e, [subjectId]: "" }));
    const { ok, data } = await api(
      `/api/subjects/${subjectId}/outcomes`,
      "POST",
      {
        description: newOutcome[subjectId] ?? "",
      },
    );
    if (!ok) {
      setOutcomeError((e) => ({
        ...e,
        [subjectId]: data.error ?? "Could not add outcome",
      }));
      return;
    }
    setNewOutcome((n) => ({ ...n, [subjectId]: "" }));
    await load();
  }

  async function editOutcome(o: Outcome) {
    const text = prompt("Learning outcome:", o.description);
    if (text === null) return;
    const { ok, data } = await api(`/api/outcomes/${o.id}`, "PATCH", {
      description: text,
    });
    if (!ok) return alert(data.error ?? "Could not update outcome");
    await load();
  }

  async function deleteOutcome(o: Outcome) {
    if (!confirm("Delete this outcome?")) return;
    const { ok, data } = await api(`/api/outcomes/${o.id}`, "DELETE");
    if (!ok) return alert(data.error ?? "Could not delete outcome");
    await load();
  }

  // ---------- tasks ----------
  async function addTask(subjectId: string) {
    const f = taskForm[subjectId] ?? { title: "", hours: "1", outcomeId: "" };
    setTaskError((e) => ({ ...e, [subjectId]: "" }));
    const { ok, data } = await api(`/api/subjects/${subjectId}/tasks`, "POST", {
      title: f.title,
      estimatedHours: Number(f.hours || 0),
      outcomeId: f.outcomeId || null,
    });
    if (!ok) {
      setTaskError((e) => ({
        ...e,
        [subjectId]: data.error ?? "Could not add task",
      }));
      return;
    }
    setTaskForm((t) => ({
      ...t,
      [subjectId]: { title: "", hours: "1", outcomeId: "" },
    }));
    await load();
  }

  async function editTask(t: Task) {
    const title = prompt("Task title:", t.title);
    if (title === null) return;
    const hours = prompt("Estimated hours:", String(t.estimatedHours));
    if (hours === null) return;
    const { ok, data } = await api(`/api/tasks/${t.id}`, "PATCH", {
      title,
      estimatedHours: Number(hours),
    });
    if (!ok) return alert(data.error ?? "Could not update task");
    await load();
  }

  async function setTaskStatus(t: Task, status: string) {
    const { ok, data } = await api(`/api/tasks/${t.id}`, "PATCH", { status });
    if (!ok) return alert(data.error ?? "Could not update status");
    await load();
  }

  async function deleteTask(t: Task) {
    if (!confirm("Delete this task?")) return;
    const { ok, data } = await api(`/api/tasks/${t.id}`, "DELETE");
    if (!ok) return alert(data.error ?? "Could not delete task");
    await load();
  }

  // ---------- resources ----------
  async function addResource(subjectId: string) {
    const f = resForm[subjectId] ?? {
      title: "",
      type: "Reading",
      url: "",
      outcomeId: "",
    };
    setResError((e) => ({ ...e, [subjectId]: "" }));
    const { ok, data } = await api(
      `/api/subjects/${subjectId}/resources`,
      "POST",
      {
        title: f.title,
        type: f.type,
        url: f.url || null,
        outcomeId: f.outcomeId || null,
      },
    );
    if (!ok) {
      setResError((e) => ({
        ...e,
        [subjectId]: data.error ?? "Could not add resource",
      }));
      return;
    }
    setResForm((r) => ({
      ...r,
      [subjectId]: { title: "", type: "Reading", url: "", outcomeId: "" },
    }));
    await load();
  }

  async function editResource(r: Resource) {
    const title = prompt("Resource title:", r.title);
    if (title === null) return;
    const url = prompt("URL (leave empty for none):", r.url ?? "");
    if (url === null) return;
    const { ok, data } = await api(`/api/resources/${r.id}`, "PATCH", {
      title,
      url: url || null,
    });
    if (!ok) return alert(data.error ?? "Could not update resource");
    await load();
  }

  async function deleteResource(r: Resource) {
    if (!confirm("Delete this resource?")) return;
    const { ok, data } = await api(`/api/resources/${r.id}`, "DELETE");
    if (!ok) return alert(data.error ?? "Could not delete resource");
    await load();
  }

  function outcomeName(s: Subject, outcomeId: string | null) {
    if (!outcomeId) return null;
    return s.outcomes.find((o) => o.id === outcomeId)?.description ?? null;
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/plans" className="text-sm underline">
        ← Back to plans
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold">{planTitle}</h1>

      <form onSubmit={addSubject} className="mb-8 space-y-3 rounded border p-4">
        <h2 className="font-semibold">Add a subject</h2>
        <input
          className="w-full rounded border p-2"
          placeholder="Subject name (e.g. TypeScript)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <label className="block text-sm">
          Subject deadline (optional)
          <input
            type="date"
            className="mt-1 w-full rounded border p-2"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button
          disabled={saving}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add subject"}
        </button>
      </form>

      {loading && <p className="text-gray-600">Loading subjects...</p>}

      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {loadError}{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && subjects.length === 0 && (
        <p className="rounded border border-dashed p-6 text-center text-gray-600">
          No subjects yet. Add your first subject above.
        </p>
      )}

      <ul className="space-y-4">
        {subjects.map((s) => {
          const tf = taskForm[s.id] ?? { title: "", hours: "1", outcomeId: "" };
          const rf = resForm[s.id] ?? {
            title: "",
            type: "Reading",
            url: "",
            outcomeId: "",
          };
          return (
            <li key={s.id} className="rounded border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="text-sm text-gray-600">
                    {s.deadline
                      ? `Deadline: ${s.deadline.slice(0, 10)}`
                      : "No subject deadline"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => editSubject(s)}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteSubject(s)}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Outcomes */}
              <div className="mt-4">
                <p className="text-sm font-medium">Learning outcomes</p>
                {s.outcomes.length === 0 && (
                  <p className="text-sm text-gray-500">No outcomes yet.</p>
                )}
                <ul className="mt-1 space-y-1">
                  {s.outcomes.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <span>• {o.description}</span>
                      <span className="flex shrink-0 gap-2">
                        <button
                          onClick={() => editOutcome(o)}
                          className="underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteOutcome(o)}
                          className="text-red-700 underline"
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border p-2 text-sm"
                    placeholder="New outcome (e.g. Write typed functions)"
                    value={newOutcome[s.id] ?? ""}
                    onChange={(e) =>
                      setNewOutcome((n) => ({ ...n, [s.id]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => addOutcome(s.id)}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    Add
                  </button>
                </div>
                {outcomeError[s.id] && (
                  <p className="mt-1 text-sm text-red-600">
                    {outcomeError[s.id]}
                  </p>
                )}
              </div>

              {/* Tasks */}
              <div className="mt-5 border-t pt-4">
                <p className="text-sm font-medium">Tasks</p>
                {s.tasks.length === 0 && (
                  <p className="text-sm text-gray-500">No tasks yet.</p>
                )}
                <ul className="mt-1 space-y-2">
                  {s.tasks.map((t) => (
                    <li key={t.id} className="rounded border p-2 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{t.title}</p>
                          <p className="text-gray-600">
                            {t.estimatedHours} h
                            {outcomeName(s, t.outcomeId) &&
                              ` · Outcome: ${outcomeName(s, t.outcomeId)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded border p-1"
                            value={t.status}
                            onChange={(e) => setTaskStatus(t, e.target.value)}
                          >
                            {Object.entries(STATUS_LABEL).map(([v, label]) => (
                              <option key={v} value={v}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => editTask(t)}
                            className="underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteTask(t)}
                            className="text-red-700 underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded border p-2 text-sm sm:col-span-2"
                    placeholder="New task (e.g. Finish 20 type exercises)"
                    value={tf.title}
                    onChange={(e) =>
                      setTaskForm((t) => ({
                        ...t,
                        [s.id]: { ...tf, title: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    className="rounded border p-2 text-sm"
                    placeholder="Hours"
                    value={tf.hours}
                    onChange={(e) =>
                      setTaskForm((t) => ({
                        ...t,
                        [s.id]: { ...tf, hours: e.target.value },
                      }))
                    }
                  />
                  <select
                    className="rounded border p-2 text-sm"
                    value={tf.outcomeId}
                    onChange={(e) =>
                      setTaskForm((t) => ({
                        ...t,
                        [s.id]: { ...tf, outcomeId: e.target.value },
                      }))
                    }
                  >
                    <option value="">No linked outcome</option>
                    {s.outcomes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.description}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => addTask(s.id)}
                    className="rounded border px-3 py-2 text-sm sm:col-span-2"
                  >
                    Add task
                  </button>
                </div>
                {taskError[s.id] && (
                  <p className="mt-1 text-sm text-red-600">{taskError[s.id]}</p>
                )}
              </div>

              {/* Resources */}
              <div className="mt-5 border-t pt-4">
                <p className="text-sm font-medium">Resources</p>
                {s.resources.length === 0 && (
                  <p className="text-sm text-gray-500">No resources yet.</p>
                )}
                <ul className="mt-1 space-y-2">
                  {s.resources.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start justify-between gap-2 text-sm"
                    >
                      <div>
                        <p>
                          <span className="rounded bg-gray-100 px-1 text-xs">
                            {r.type}
                          </span>{" "}
                          {r.url ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {r.title}
                            </a>
                          ) : (
                            r.title
                          )}
                        </p>
                        {outcomeName(s, r.outcomeId) && (
                          <p className="text-gray-600">
                            Outcome: {outcomeName(s, r.outcomeId)}
                          </p>
                        )}
                      </div>
                      <span className="flex gap-2">
                        <button
                          onClick={() => editResource(r)}
                          className="underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteResource(r)}
                          className="text-red-700 underline"
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded border p-2 text-sm sm:col-span-2"
                    placeholder="Resource title (e.g. TypeScript Handbook)"
                    value={rf.title}
                    onChange={(e) =>
                      setResForm((r) => ({
                        ...r,
                        [s.id]: { ...rf, title: e.target.value },
                      }))
                    }
                  />
                  <select
                    className="rounded border p-2 text-sm"
                    value={rf.type}
                    onChange={(e) =>
                      setResForm((r) => ({
                        ...r,
                        [s.id]: { ...rf, type: e.target.value },
                      }))
                    }
                  >
                    {RESOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded border p-2 text-sm"
                    value={rf.outcomeId}
                    onChange={(e) =>
                      setResForm((r) => ({
                        ...r,
                        [s.id]: { ...rf, outcomeId: e.target.value },
                      }))
                    }
                  >
                    <option value="">No linked outcome</option>
                    {s.outcomes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.description}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded border p-2 text-sm sm:col-span-2"
                    placeholder="URL (optional, https://...)"
                    value={rf.url}
                    onChange={(e) =>
                      setResForm((r) => ({
                        ...r,
                        [s.id]: { ...rf, url: e.target.value },
                      }))
                    }
                  />
                  <button
                    onClick={() => addResource(s.id)}
                    className="rounded border px-3 py-2 text-sm sm:col-span-2"
                  >
                    Add resource
                  </button>
                </div>
                {resError[s.id] && (
                  <p className="mt-1 text-sm text-red-600">{resError[s.id]}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
