import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { resourceUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = resourceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const existing = await prisma.resource.findFirst({
    where: { id, subject: { plan: { userId } } },
  });
  if (!existing)
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });

  const { title, type, url, outcomeId } = parsed.data;

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

  const resource = await prisma.resource.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(url !== undefined ? { url: url || null } : {}),
      ...(outcomeId !== undefined ? { outcomeId: outcomeId || null } : {}),
    },
  });
  return NextResponse.json(resource);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.resource.deleteMany({
    where: { id, subject: { plan: { userId } } },
  });
  if (result.count === 0)
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
