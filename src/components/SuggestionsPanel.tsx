"use client";

import { useEffect, useState } from "react";

type SBlock = { date: string; taskId: string; hours: number; note: string };
type Suggestion = {
  id: string;
  content: { source: "AI" | "RULES"; blocks: SBlock[] };
  assumptions: string | null;
  status: "PENDING" | "ACCEPTED" | "DISMISSED";
  rating: number | null;
  correction: string | null;
  createdAt: string;
};
type DBBlock = {
  id: string;
  date: string;
  hours: number;
  status: string;
  task: { title: string } | null;
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

function localToday() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
};

export default function SuggestionsPanel({ planId }: { planId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [blocks, setBlocks] = useState<DBBlock[]>([]);
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [excluded, setExcluded] = useState<Record<string, number[]>>({});
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError("");
    const { ok, data } = await api(`/api/plans/${planId}/suggestions`, "GET");
    if (!ok) {
      setLoadError(data.error ?? "Failed to load suggestions");
    } else {
      setSuggestions(data.suggestions);
      setBlocks(data.blocks);
      setTaskTitles(
        Object.fromEntries(
          (data.tasks as { id: string; title: string }[]).map((t) => [
            t.id,
            t.title,
          ]),
        ),
      );
      setCorrections(
        Object.fromEntries(
          (data.suggestions as Suggestion[]).map((s) => [
            s.id,
            s.correction ?? "",
          ]),
        ),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setGenerating(true);
    setGenError("");
    const { ok, data } = await api(`/api/plans/${planId}/suggestions`, "POST", {
      today: localToday(),
    });
    setGenerating(false);
    if (!ok) return setGenError(data.error ?? "Could not generate a schedule");
    await load();
  }

  async function patch(id: string, body: unknown) {
    setBusyId(id);
    const { ok, data } = await api(`/api/suggestions/${id}`, "PATCH", body);
    setBusyId(null);
    if (!ok) {
      alert(data.error ?? "Could not update suggestion");
      return;
    }
    await load();
  }

  function toggleBlock(id: string, index: number) {
    setExcluded((e) => {
      const cur = e[id] ?? [];
      return {
        ...e,
        [id]: cur.includes(index)
          ? cur.filter((i) => i !== index)
          : [...cur, index],
      };
    });
  }

  return (
    <section className="mb-6 rounded border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Study schedule suggestions</h2>
        <button
          onClick={generate}
          disabled={generating}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate schedule suggestion"}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Suggestions are not applied until you accept them. Review the
        assumptions, untick sessions you do not want, then accept.
      </p>
      {genError && <p className="mt-2 text-sm text-red-600">{genError}</p>}

      {loading && (
        <p className="mt-3 text-sm text-gray-600">Loading suggestions...</p>
      )}
      {loadError && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {loadError}{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}
      {!loading && !loadError && suggestions.length === 0 && (
        <p className="mt-3 rounded border border-dashed p-4 text-center text-sm text-gray-600">
          No suggestions yet. Add tasks, then generate a schedule.
        </p>
      )}

      <ul className="mt-3 space-y-4">
        {suggestions.map((s) => {
          const ex = excluded[s.id] ?? [];
          const pending = s.status === "PENDING";
          return (
            <li key={s.id} className="rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                  {s.content.source === "AI"
                    ? "AI suggestion"
                    : "Rule-based suggestion"}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(s.createdAt).toLocaleString()} ·{" "}
                  {s.status.toLowerCase()}
                </span>
              </div>

              {s.assumptions && (
                <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
                  <p className="font-medium">Assumptions</p>
                  <ul className="list-disc pl-4">
                    {s.assumptions.split("\n").map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <ul className="mt-2 space-y-1 text-sm">
                {s.content.blocks.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {pending && (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!ex.includes(i)}
                        onChange={() => toggleBlock(s.id, i)}
                      />
                    )}
                    <span
                      className={
                        ex.includes(i) ? "text-gray-400 line-through" : ""
                      }
                    >
                      <strong>{b.date}</strong> · {b.hours} h ·{" "}
                      {taskTitles[b.taskId] ?? "(deleted task)"}
                      <span className="block text-xs text-gray-600">
                        {b.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {pending && (
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busyId === s.id}
                    onClick={() =>
                      patch(s.id, { status: "ACCEPTED", excludedIndexes: ex })
                    }
                    className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    Accept selected sessions
                  </button>
                  <button
                    disabled={busyId === s.id}
                    onClick={() => patch(s.id, { status: "DISMISSED" })}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="mt-3 border-t pt-2 text-sm">
                <p className="mb-1">Rate this suggestion</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => patch(s.id, { rating: n })}
                      className={`h-8 w-8 rounded border ${
                        s.rating !== null && n <= s.rating
                          ? "bg-yellow-200"
                          : ""
                      }`}
                      aria-label={`Rate ${n} out of 5`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <textarea
                  className="mt-2 w-full rounded border p-2 text-sm"
                  rows={2}
                  placeholder="Correction or comment (e.g. sessions too long, wrong order)"
                  value={corrections[s.id] ?? ""}
                  onChange={(e) =>
                    setCorrections((c) => ({ ...c, [s.id]: e.target.value }))
                  }
                />
                <button
                  onClick={() =>
                    patch(s.id, { correction: corrections[s.id] ?? "" })
                  }
                  className="mt-1 rounded border px-3 py-1 text-sm"
                >
                  Save correction
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t pt-3">
        <h3 className="text-sm font-medium">Current schedule</h3>
        {blocks.length === 0 ? (
          <p className="text-sm text-gray-500">No accepted sessions yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {blocks.map((b) => (
              <li key={b.id}>
                <strong>{b.date.slice(0, 10)}</strong> · {b.hours} h ·{" "}
                {b.task?.title ?? "(no task)"} ·{" "}
                <span className="text-gray-600">
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
