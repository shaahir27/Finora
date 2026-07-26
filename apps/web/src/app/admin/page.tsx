import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminIndex() {
  const session = await auth();
  if (session?.user && (session.user as any).role === "admin") {
    redirect("/admin/dashboard");
  }
  redirect("/admin/login");
}
