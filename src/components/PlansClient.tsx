"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Plan = {
  id: string;
  title: string;
  deadline: string;
  studyDays: string[];
  hoursPerDay: number;
};

type FormState = {
  title: string;
  deadline: string;
  studyDays: string[];
  hoursPerDay: string;
};

const emptyForm: FormState = {
  title: "",
  deadline: "",
  studyDays: ["Mon", "Wed", "Fri"],
  hoursPerDay: "2",
};

export default function PlansClient({ email }: { email: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPlans() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      setPlans(await res.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      studyDays: f.studyDays.includes(day)
        ? f.studyDays.filter((d) => d !== day)
        : [...f.studyDays, day],
    }));
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setFormError("");
    setForm({
      title: plan.title,
      deadline: plan.deadline.slice(0, 10),
      studyDays: plan.studyDays,
      hoursPerDay: String(plan.hoursPerDay),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/plans/${editingId}` : "/api/plans",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            deadline: form.deadline,
            studyDays: form.studyDays,
            hoursPerDay: Number(form.hoursPerDay),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Could not save the plan");
        return;
      }
      cancelEdit();
      await loadPlans();
    } catch {
      setFormError("Network error, please try again");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(plan: Plan) {
    if (
      !confirm(
        `Delete "${plan.title}"? This also deletes its subjects and tasks.`,
      )
    )
      return;
    const res = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Could not delete the plan");
      return;
    }
    await loadPlans();
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">My plans</h1>
          <p className="text-sm text-gray-600">Logged in as {email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded border px-3 py-1 text-sm"
        >
          Log out
        </button>
      </header>

      <form onSubmit={onSubmit} className="mb-8 space-y-3 rounded border p-4">
        <h2 className="font-semibold">
          {editingId ? "Edit plan" : "New plan"}
        </h2>

        <input
          className="w-full rounded border p-2"
          placeholder="Plan title (e.g. Full-stack skills, 8 weeks)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        <label className="block text-sm">
          Deadline
          <input
            type="date"
            className="mt-1 w-full rounded border p-2"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            required
          />
        </label>

        <div>
          <p className="mb-1 text-sm">Preferred study days</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <label
                key={d}
                className="flex items-center gap-1 rounded border px-2 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.studyDays.includes(d)}
                  onChange={() => toggleDay(d)}
                />
                {d}
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          Hours available per study day
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="16"
            className="mt-1 w-full rounded border p-2"
            value={form.hoursPerDay}
            onChange={(e) => setForm({ ...form, hoursPerDay: e.target.value })}
            required
          />
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex gap-2">
          <button
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Create plan"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded border px-4 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading && <p className="text-gray-600">Loading plans...</p>}

      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {loadError}{" "}
          <button onClick={loadPlans} className="underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && plans.length === 0 && (
        <p className="rounded border border-dashed p-6 text-center text-gray-600">
          No plans yet. Create your first plan above.
        </p>
      )}

      <ul className="space-y-3">
        {plans.map((plan) => (
          <li key={plan.id} className="rounded border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{plan.title}</h3>
                <p className="text-sm text-gray-600">
                  Deadline: {plan.deadline.slice(0, 10)} · {plan.hoursPerDay}{" "}
                  h/day
                </p>
                <p className="text-sm text-gray-600">
                  Study days: {plan.studyDays.join(", ")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(plan)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(plan)}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
