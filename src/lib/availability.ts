const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type AvailabilityInput = {
  deadline: string;
  studyDays: string[];
  hoursPerDay: number;
  subjects: {
    id: string;
    name: string;
    deadline: string | null;
    tasks: { estimatedHours: number; status: string }[];
  }[];
};

export type AnalysisWarning = {
  level: "error" | "warning" | "info";
  message: string;
};

export type AnalysisResult = {
  availableHours: number;
  requiredHours: number;
  studyDaysLeft: number;
  warnings: AnalysisWarning[];
  ok: boolean;
};

function toLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export class AvailabilityAnalyzer {
  private input: AvailabilityInput;
  private today: Date;

  constructor(input: AvailabilityInput, today: Date = new Date()) {
    this.input = input;
    this.today = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
  }

  /** Number of preferred study days from today through `until` (inclusive). */
  studyDaysUntil(until: string): number {
    const end = toLocalDate(until);
    const allowed = new Set(this.input.studyDays.map((d) => DAY_INDEX[d]));
    let count = 0;
    for (let d = new Date(this.today); d <= end; d.setDate(d.getDate() + 1)) {
      if (allowed.has(d.getDay())) count++;
    }
    return count;
  }

  availableHoursUntil(until: string): number {
    return this.studyDaysUntil(until) * this.input.hoursPerDay;
  }

  private remainingHours(
    tasks: { estimatedHours: number; status: string }[],
  ): number {
    return tasks
      .filter((t) => t.status !== "COMPLETE")
      .reduce((sum, t) => sum + t.estimatedHours, 0);
  }

  analyze(): AnalysisResult {
    const { deadline, subjects, hoursPerDay } = this.input;
    const warnings: AnalysisWarning[] = [];

    const daysLeft = this.studyDaysUntil(deadline);
    const availableHours = daysLeft * hoursPerDay;
    const requiredHours = subjects.reduce(
      (s, sub) => s + this.remainingHours(sub.tasks),
      0,
    );

    const deadlinePassed = toLocalDate(deadline) < this.today;
    if (deadlinePassed) {
      warnings.push({
        level: "error",
        message: "The plan deadline has already passed.",
      });
    } else if (daysLeft === 0) {
      warnings.push({
        level: "error",
        message:
          "None of your preferred study days fall before the deadline. Add study days or move the deadline.",
      });
    }

    if (requiredHours === 0) {
      warnings.push({
        level: "info",
        message:
          "No remaining task hours yet. Add tasks with estimated hours to check your schedule.",
      });
    } else if (!deadlinePassed && daysLeft > 0) {
      if (requiredHours > availableHours) {
        const missing = requiredHours - availableHours;
        const extraPerDay = Math.ceil((missing / daysLeft) * 2) / 2;
        warnings.push({
          level: "error",
          message: `You need ${requiredHours.toFixed(1)} h but only have ${availableHours.toFixed(1)} h available. Options: add about ${extraPerDay} h per study day, add more study days, extend the deadline, or remove ${missing.toFixed(1)} h of tasks.`,
        });
      } else if (requiredHours > availableHours * 0.85) {
        warnings.push({
          level: "warning",
          message:
            "Your schedule is very tight (over 85% of available time). Consider adding buffer or review time.",
        });
      }
    }

    // Subject deadlines: check cumulative workload in deadline order
    const withDeadline = subjects
      .filter((s) => s.deadline)
      .sort(
        (a, b) =>
          toLocalDate(a.deadline!).getTime() -
          toLocalDate(b.deadline!).getTime(),
      );

    let cumulative = 0;
    for (const s of withDeadline) {
      cumulative += this.remainingHours(s.tasks);
      if (toLocalDate(s.deadline!) > toLocalDate(deadline)) {
        warnings.push({
          level: "warning",
          message: `"${s.name}" has a deadline after the plan deadline.`,
        });
      }
      const cutoff =
        toLocalDate(s.deadline!) < toLocalDate(deadline)
          ? s.deadline!
          : deadline;
      const avail = this.availableHoursUntil(cutoff);
      if (cumulative > avail) {
        warnings.push({
          level: "error",
          message: `Deadline conflict: by ${cutoff.slice(0, 10)} you must finish ${cumulative.toFixed(1)} h of work (up to "${s.name}") but only have ${avail.toFixed(1)} h.`,
        });
      }
    }

    return {
      availableHours,
      requiredHours,
      studyDaysLeft: daysLeft,
      warnings,
      ok: !warnings.some((w) => w.level === "error"),
    };
  }
}
