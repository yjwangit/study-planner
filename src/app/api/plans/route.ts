import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { planSchema } from "@/lib/validators";

export async function GET() {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await prisma.studyPlan.findMany({
    where: { userId }, // 数据隔离：只查自己的
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(plans);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const plan = await prisma.studyPlan.create({
    data: {
      userId,
      title: parsed.data.title,
      deadline: new Date(parsed.data.deadline),
      studyDays: parsed.data.studyDays,
      hoursPerDay: parsed.data.hoursPerDay,
    },
  });
  return NextResponse.json(plan, { status: 201 });
}
