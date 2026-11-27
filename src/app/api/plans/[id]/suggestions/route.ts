import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  PlanGenerator,
  listStudyDates,
  type GenInput,
} from "@/lib/planGenerator";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const plan = await prisma.studyPlan.findFirst({ where: { id, userId } });
  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const [suggestions, blocks, tasks] = await Promise.all([
    prisma.aISuggestion.findMany({
      where: { planId: id, type: "SCHEDULE" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.scheduleBlock.findMany({
      where: { planId: id },
      orderBy: { date: "asc" },
      include: { task: { select: { title: true } } },
    }),
    prisma.task.findMany({
      where: { subject: { planId: id } },
      select: { id: true, title: true },
    }),
  ]);

  return NextResponse.json({ suggestions, blocks, tasks });
}

const bodySchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Missing or invalid date" },
      { status: 400 },
    );
  }

  const plan = await prisma.studyPlan.findFirst({
    where: { id, userId },
    include: {
      subjects: {
        include: {
          outcomes: true,
          resources: true,
          tasks: { where: { status: { not: "COMPLETE" } } },
        },
      },
    },
  });
  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const tasks: GenInput["tasks"] = plan.subjects.flatMap((s) =>
    s.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      subject: s.name,
      subjectDeadline: s.deadline
        ? s.deadline.toISOString().slice(0, 10)
        : null,
      outcome:
        s.outcomes.find((o) => o.id === t.outcomeId)?.description ?? null,
      hours: t.estimatedHours,
      resources: s.resources
        .filter((r) => !r.outcomeId || r.outcomeId === t.outcomeId)
        .map((r) => r.title),
    })),
  );

  if (tasks.length === 0) {
    return NextResponse.json(
      {
        error: "Add at least one unfinished task before generating a schedule.",
      },
      { status: 400 },
    );
  }

  const input: GenInput = {
    today: parsedBody.data.today,
    deadline: plan.deadline.toISOString().slice(0, 10),
    studyDays: plan.studyDays,
    hoursPerDay: plan.hoursPerDay,
    tasks,
  };

  if (
    listStudyDates(input.today, input.deadline, input.studyDays).length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "No study days remain before the deadline. Edit the plan's deadline or study days.",
      },
      { status: 400 },
    );
  }

  const proposal = await new PlanGenerator().generate(input);

  const suggestion = await prisma.aISuggestion.create({
    data: {
      planId: id,
      type: "SCHEDULE",
      content: {
        source: proposal.source,
        blocks: proposal.blocks,
      } as Prisma.InputJsonValue,
      assumptions: proposal.assumptions.join("\n"),
    },
  });
  return NextResponse.json(suggestion, { status: 201 });
}
