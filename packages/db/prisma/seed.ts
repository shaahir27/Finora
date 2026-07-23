/**
 * Prisma database seed
 * Creates a single SCHOOL + admin USER for local development and testing.
 * No real secrets here — all credentials sourced from env vars.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Idempotent: upsert so re-running the seed is safe
  const school = await prisma.school.upsert({
    where: { id: "demo-school-id" },
    update: { name: "Demo School" },
    create: {
      id: "demo-school-id",
      name: "Demo School",
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { id: "seed-admin-01" },
    update: {},
    create: {
      id: "seed-admin-01",
      role: "admin",
      email: "admin@school.edu",
      phone: null,
      schoolId: school.id,
    },
  });

  console.log("Seed complete:", { school, adminUser });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
