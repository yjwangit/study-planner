import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PlansClient from "@/components/PlansClient";

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <PlansClient email={session.user?.email ?? ""} />;
}
