import { DashboardClient } from "./DashboardClient";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";

export default function DashboardPage() {
  // Hardcoded for demo - in reality this comes from auth context/session
  const schoolId = DEMO_SCHOOL_ID;

  return <DashboardClient schoolId={schoolId} />;
}
