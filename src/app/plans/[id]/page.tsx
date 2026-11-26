import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlanDetailClient from "@/components/PlanDetailClient";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const { id } = await params;
  const plan = await prisma.studyPlan.findFirst({ where: { id, userId } });
  if (!plan) notFound();

  return <PlanDetailClient planId={plan.id} planTitle={plan.title} />;
}
