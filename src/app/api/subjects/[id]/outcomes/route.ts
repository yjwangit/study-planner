import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { outcomeSchema } from "@/lib/validators";

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
  const parsed = outcomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const outcome = await prisma.outcome.create({
    data: { subjectId: id, description: parsed.data.description },
  });
  return NextResponse.json(outcome, { status: 201 });
}
