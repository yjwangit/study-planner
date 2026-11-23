import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">My plans</h1>
      <p className="mt-2 text-sm text-gray-600">
        Logged in as {session.user?.email}
      </p>
    </main>
  );
}
