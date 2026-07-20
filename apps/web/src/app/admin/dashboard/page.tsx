import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  // Hardcoded for demo - in reality this comes from auth context/session
  const schoolId = "demo-school-id";

  return <DashboardClient schoolId={schoolId} />;
}
