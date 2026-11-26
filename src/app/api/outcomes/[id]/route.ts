import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { outcomeSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = outcomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const result = await prisma.outcome.updateMany({
    where: { id, subject: { plan: { userId } } }, // 目标 → 科目 → 计划 → 用户
    data: { description: parsed.data.description },
  });
  if (result.count === 0)
    return NextResponse.json({ error: "Outcome not found" }, { status: 404 });

  const outcome = await prisma.outcome.findFirst({
    where: { id, subject: { plan: { userId } } },
  });
  return NextResponse.json(outcome);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.outcome.deleteMany({
    where: { id, subject: { plan: { userId } } },
  });
  if (result.count === 0)
    return NextResponse.json({ error: "Outcome not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
