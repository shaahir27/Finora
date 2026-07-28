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
  Receipt,
  UserRole,
  StudentStatus,
  BalanceDisposition,
  GstTreatment,
  PaymentChannel,
  ReconciliationStatus,
  ReminderChannel,
  ReminderStatus,
  ReceiptFormat,
} from "@prisma/client";

// Singleton client for server-side use only.
// Never import this in a client component or expose it to the browser.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  // Pre-warm TCP/TLS connection pool to Supabase so initial Server Action requests pay zero cold-start penalty
  prisma.$connect().catch((e) => console.warn("[Prisma Eager Connect Notice]", e?.message || e));

  // Keepalive: Supabase Supavisor (transaction-mode pooler) evicts idle connections
  // after ~60s on the free tier. Prisma doesn't know they're dead, so the next
  // request after a few idle minutes fails with "Can't reach database server".
  // This lightweight ping every 30s keeps the connection alive in Supavisor's eyes.
  const KEEPALIVE_MS = 30_000;
  const keepaliveRef = (globalThis as any).__prismaKeepalive;
  if (!keepaliveRef) {
    (globalThis as any).__prismaKeepalive = setInterval(() => {
      prisma.$queryRaw`SELECT 1`.catch(() => {
        // Connection is dead — force Prisma to drop it and open a fresh one on the next real query
        prisma.$disconnect().catch(() => {});
      });
    }, KEEPALIVE_MS);
    // Don't let the keepalive timer prevent Node from exiting
    (globalThis as any).__prismaKeepalive?.unref?.();
  }
}
