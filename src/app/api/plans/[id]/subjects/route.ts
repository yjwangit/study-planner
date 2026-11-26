import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { subjectSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const plan = await prisma.studyPlan.findFirst({ where: { id, userId } });
  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const subjects = await prisma.subject.findMany({
    where: { planId: id },
    include: {
      outcomes: { orderBy: { id: "asc" } },
      tasks: { orderBy: { id: "asc" } },
      resources: { orderBy: { id: "asc" } },
    },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(subjects);
}

export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const plan = await prisma.studyPlan.findFirst({ where: { id, userId } });
  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = subjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const subject = await prisma.subject.create({
    data: {
      planId: id,
      name: parsed.data.name,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
    },
    include: { outcomes: true, tasks: true, resources: true },
  });
  return NextResponse.json(subject, { status: 201 });
}
