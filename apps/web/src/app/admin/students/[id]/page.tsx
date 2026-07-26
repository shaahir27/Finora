import { StudentProfileClient } from "./StudentProfileClient";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";

// Next.js 15 requires params to be a promise (or handled accordingly if it is a promise)
export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = DEMO_SCHOOL_ID;

  return <StudentProfileClient schoolId={schoolId} studentId={id} />;
}
