/**
 * @smart-school/db — public exports
 * Re-exports the Prisma client and all generated types.
 * Import from "@smart-school/db" throughout the project — never import from @prisma/client directly.
 */
import { Prisma, PrismaClient } from "@prisma/client";
export { Prisma, PrismaClient };
export type {
  School,
  User,
  ParentLink,
  GuardianOf,
  Student,
  AuditLog,
  FeeType,
  FeeAssignment,
  Transaction,
  Waiver,
  Penalty,
  DefaulterScore,
  AnomalyFlag,
  OfflineSyncConflict,
  OcrStaging,
  ReminderLog,
  UserRole,
  StudentStatus,
  BalanceDisposition,
  GstTreatment,
  PaymentChannel,
  ReconciliationStatus,
  ReminderChannel,
  ReminderStatus,
} from "@prisma/client";

// Singleton client for server-side use only.
// Never import this in a client component or expose it to the browser.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
