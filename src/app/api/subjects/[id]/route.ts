import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { subjectUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = subjectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { name, deadline } = parsed.data;
  const result = await prisma.subject.updateMany({
    where: { id, plan: { userId } }, // 通过所属计划确认是你的
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(deadline !== undefined
        ? { deadline: deadline ? new Date(deadline) : null }
        : {}),
    },
  });
  if (result.count === 0)
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const subject = await prisma.subject.findFirst({
    where: { id, plan: { userId } },
    include: { outcomes: true },
  });
  return NextResponse.json(subject);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.subject.deleteMany({
    where: { id, plan: { userId } },
  });
  if (result.count === 0)
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
