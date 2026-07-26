/**
 * Single source of truth for the demo school ID.
 * MUST match packages/db/prisma/seed.ts's schoolId exactly.
 * Every page/action that needs "the current school" should import this,
 * not hardcode its own string.
 */
export const DEMO_SCHOOL_ID =
  process.env.NEXT_PUBLIC_DEMO_SCHOOL_ID ?? "demo-school-id";
