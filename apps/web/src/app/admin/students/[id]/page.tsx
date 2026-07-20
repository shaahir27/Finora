import { StudentProfileClient } from "./StudentProfileClient";

// Next.js 15 requires params to be a promise (or handled accordingly if it is a promise)
export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = "demo-school-id"; // Mocked

  return <StudentProfileClient schoolId={schoolId} studentId={id} />;
}
