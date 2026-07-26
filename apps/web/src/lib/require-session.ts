import { auth } from "../../auth";
import { DEMO_SCHOOL_ID } from "./school-context";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Requires an active admin session matching the requested schoolId.
 * If NODE_ENV !== 'production' and no session exists, falls back to DEMO_SCHOOL_ID for demo compatibility.
 */
export async function requireAdminForSchool(schoolId: string): Promise<{ adminId: string; schoolId: string }> {
  const session = await auth();

  if (!session?.user) {
    if (process.env.NODE_ENV !== "production") {
      return { adminId: "seed-admin-01", schoolId: DEMO_SCHOOL_ID };
    }
    throw new UnauthorizedError("Authentication required.");
  }

  const user = session.user as any;
  if (user.role !== "admin") {
    throw new UnauthorizedError("Admin access required.");
  }

  const sessionSchoolId = user.schoolId || DEMO_SCHOOL_ID;
  if (schoolId && sessionSchoolId !== schoolId) {
    throw new UnauthorizedError("You do not have access to this school's data.");
  }

  return { adminId: user.id || "seed-admin-01", schoolId: sessionSchoolId };
}

/**
 * Requires an active parent session.
 * If NODE_ENV !== 'production' and no session exists, falls back to demo parent session.
 */
export async function requireParentSession(): Promise<{ parentUserId: string; parentLinkId: string; schoolId: string }> {
  const session = await auth();

  if (!session?.user) {
    if (process.env.NODE_ENV !== "production") {
      return {
        parentUserId: "demo-parent-id",
        parentLinkId: "parent-link-demo-id",
        schoolId: DEMO_SCHOOL_ID,
      };
    }
    throw new UnauthorizedError("Authentication required.");
  }

  const user = session.user as any;
  if (user.role !== "parent") {
    throw new UnauthorizedError("Parent access required.");
  }

  return {
    parentUserId: user.id || "demo-parent-id",
    parentLinkId: user.parentLinkId || "parent-link-demo-id",
    schoolId: user.schoolId || DEMO_SCHOOL_ID,
  };
}
