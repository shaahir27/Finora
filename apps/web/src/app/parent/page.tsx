import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ParentIndex() {
  const session = await auth();
  if (session?.user && (session.user as any).role === "parent") {
    redirect("/parent/dues");
  }
  redirect("/parent/login");
}
