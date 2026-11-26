import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { taskSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const subject = await prisma.subject.findFirst({
    where: { id, plan: { userId } },
  });
  if (!subject)
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  if (parsed.data.outcomeId) {
    const outcome = await prisma.outcome.findFirst({
      where: { id: parsed.data.outcomeId, subjectId: id },
    });
    if (!outcome) {
      return NextResponse.json(
        { error: "Outcome does not belong to this subject" },
        { status: 400 },
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      subjectId: id,
      title: parsed.data.title,
      estimatedHours: parsed.data.estimatedHours,
      outcomeId: parsed.data.outcomeId || null,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
