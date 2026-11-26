import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { taskUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const existing = await prisma.task.findFirst({
    where: { id, subject: { plan: { userId } } },
  });
  if (!existing)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { title, estimatedHours, outcomeId, status } = parsed.data;

  if (outcomeId) {
    const outcome = await prisma.outcome.findFirst({
      where: { id: outcomeId, subjectId: existing.subjectId },
    });
    if (!outcome) {
      return NextResponse.json(
        { error: "Outcome does not belong to this subject" },
        { status: 400 },
      );
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(estimatedHours !== undefined ? { estimatedHours } : {}),
      ...(outcomeId !== undefined ? { outcomeId: outcomeId || null } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.task.deleteMany({
    where: { id, subject: { plan: { userId } } },
  });
  if (result.count === 0)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
