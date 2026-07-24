import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const schoolId = "demo-school-id";

  // Check if any student exists
  let student = await prisma.student.findFirst({ where: { schoolId } });
  
  if (!student) {
    student = await prisma.student.create({
      data: {
        id: "demo-student-1",
        schoolId,
        name: "Demo Student",
        class: "10A",
        admissionNumber: "ADM-999"
      }
    });
  }

  // Create demo parent user
  const user = await prisma.user.upsert({
    where: { id: "demo-parent-id" },
    update: {},
    create: {
      id: "demo-parent-id",
      role: "parent",
      email: "parent@demo.com",
      phone: "+919999999999",
      schoolId
    }
  });

  // Create parent link
  const parentLink = await prisma.parentLink.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      id: "demo-parent-link",
      userId: user.id,
    }
  });

  // Link to student
  await prisma.guardianOf.upsert({
    where: {
      parentLinkId_studentId: {
        parentLinkId: parentLink.id,
        studentId: student.id,
      }
    },
    update: {},
    create: {
      parentLinkId: parentLink.id,
      studentId: student.id
    }
  });

  console.log("Demo parent created and linked to student:", student.name);
  console.log("Email: parent@demo.com");
  console.log("Phone: +919999999999");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
