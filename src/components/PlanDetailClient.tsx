"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Outcome = { id: string; description: string };
type Subject = {
  id: string;
  name: string;
  deadline: string | null;
  outcomes: Outcome[];
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
    if (!confirm(`Delete subject "${s.name}" and its outcomes?`)) return;
    const { ok, data } = await api(`/api/subjects/${s.id}`, "DELETE");
    if (!ok) return alert(data.error ?? "Could not delete subject");
    await load();
  }

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
        {subjects.map((s) => (
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

            <div className="mt-3">
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
          </li>
        ))}
      </ul>
    </main>
  );
}
