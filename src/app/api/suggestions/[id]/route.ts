import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { Block } from "@/lib/planGenerator";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["ACCEPTED", "DISMISSED"]).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  correction: z.string().trim().max(1000).optional(),
  excludedIndexes: z.array(z.number().int().min(0)).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const { status, rating, correction, excludedIndexes } = parsed.data;

  const suggestion = await prisma.aISuggestion.findFirst({
    where: { id, plan: { userId } }, // data isolation through the plan
  });
  if (!suggestion)
    return NextResponse.json(
      { error: "Suggestion not found" },
      { status: 404 },
    );

  const feedback = {
    ...(rating !== undefined ? { rating } : {}),
    ...(correction !== undefined ? { correction } : {}),
  };

  if (status && suggestion.status !== "PENDING") {
    return NextResponse.json(
      { error: "This suggestion was already decided." },
      { status: 400 },
    );
  }

  if (status === "ACCEPTED") {
    const content = suggestion.content as { blocks?: Block[] } | null;
    const excluded = new Set(excludedIndexes ?? []);
    const chosen = (content?.blocks ?? []).filter((_, i) => !excluded.has(i));

    // Only link tasks that still exist and belong to this user
    const existing = await prisma.task.findMany({
      where: {
        id: { in: chosen.map((b) => b.taskId) },
        subject: { plan: { userId } },
      },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((t) => t.id));

    await prisma.$transaction([
      // Replace old untouched blocks, but keep anything the learner edited or started
      prisma.scheduleBlock.deleteMany({
        where: {
          planId: suggestion.planId,
          isEditedByUser: false,
          status: "NOT_STARTED",
        },
      }),
      prisma.scheduleBlock.createMany({
        data: chosen.map((b) => ({
          planId: suggestion.planId,
          taskId: existingIds.has(b.taskId) ? b.taskId : null,
          date: new Date(`${b.date}T00:00:00.000Z`),
          hours: b.hours,
        })),
      }),
      prisma.aISuggestion.update({
        where: { id },
        data: { status: "ACCEPTED", ...feedback },
      }),
    ]);
  } else {
    await prisma.aISuggestion.update({
      where: { id },
      data: { ...(status ? { status } : {}), ...feedback },
    });
  }

  const updated = await prisma.aISuggestion.findFirst({
    where: { id, plan: { userId } },
  });
  return NextResponse.json(updated);
}
