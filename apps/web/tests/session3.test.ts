import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@smart-school/db';
import { computeDefaulterScore } from '@smart-school/rules';
import { syncOfflinePayment, getSyncConflicts } from '@/app/actions/offlineSync';
import { getDefaulters } from '@/app/actions/defaulters';
import { getStudentProfile } from '@/app/actions/students';
import { recordPayment } from '@/app/actions/ledger';
import * as push from '@/app/actions/push';
import { enqueueOfflinePayment, getPendingEntries } from '@/lib/offlineQueue';

// Mock DB
vi.mock('@smart-school/db', () => ({
  prisma: {
    student: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    feeAssignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    offlineSyncConflict: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    defaulterScore: {
      create: vi.fn(),
    },
    pushSubscription: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb({
      ...prisma,
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'fee-1', amount: 1000 }]),
      waiver: { findMany: vi.fn().mockResolvedValue([]) },
      feeAssignment: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'fee-1', amount: { toNumber: () => 1000 }, student: { id: 'student-1', schoolId: 'school-1' } })
      },
      transaction: { 
        findMany: vi.fn((args) => {
          if (args?.where?.feeAssignmentId === 'fee-conflict') {
            return Promise.resolve([{ amount: 1000, reconciliationStatus: "posted" }]);
          }
          return Promise.resolve([]);
        }),
        create: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 500, reconciliationStatus: "posted" }),
        update: vi.fn().mockResolvedValue({ id: 'tx-1', amount: 500, reconciliationStatus: "posted" })
      },
      auditLog: { create: vi.fn() },
      anomalyFlag: { create: vi.fn() }
    })),
  },
  PaymentChannel: { cash: "cash", cheque: "cheque", upi: "upi" }
}));

// Mock Push
vi.mock('@/app/actions/push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/actions/push')>();
  return {
    ...actual,
    sendPushNotification: vi.fn(),
    notifySchoolAdmins: vi.fn()
  };
});

describe('Session 3 Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeDefaulterScore', () => {
    it('should assign higher risk for higher days overdue', () => {
      const scoreHigh = computeDefaulterScore(45, 0, 1000, 0, 0);
      const scoreLow = computeDefaulterScore(15, 0, 1000, 0, 0);
      
      // The exact riskLevel classification depends on the thresholds (e.g. >30 = medium, >60 = high)
      // but the numeric score should be strictly higher
      expect(scoreHigh.riskScore).toBeGreaterThan(scoreLow.riskScore);
    });

    it('partially-paid student scores strictly lower than identical student paying nothing', () => {
      // "a deliberate design requirement"
      const scoreNothing = computeDefaulterScore(30, 0, 1000, 0, 0);
      const scorePartial = computeDefaulterScore(30, 0, 1000, 500, 0);
      
      expect(scorePartial.riskScore).toBeLessThan(scoreNothing.riskScore);
    });
  });

  describe('sendPushNotification non-blocking guarantee', () => {
    it('recordPayment succeeds even if push notification fails', async () => {
      // Mock recordPayment's internal DB calls to succeed
      vi.mocked(prisma.feeAssignment.findUnique).mockResolvedValue({
        id: 'fee-1',
        studentId: 'student-1',
        amount: { toNumber: () => 1000 } as any,
        dueDate: new Date(),
        student: { schoolId: 'school-1' }
      } as any);
      
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({ _sum: { amount: null } } as any);
      vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'tx-1', amount: { toNumber: () => 500 } } as any);

      // Force push to fail
      vi.mocked(push.notifySchoolAdmins).mockRejectedValueOnce(new Error('Push failed'));

      // Should not throw
      const result = await recordPayment('admin-1', 'school-1', {
        feeAssignmentId: 'fee-1',
        amount: 500,
        channel: 'cash'
      });

      console.log("recordPayment result:", JSON.stringify(result, null, 2));

      expect(result.transaction).toBeDefined();
    });
  });

  describe('Offline sync', () => {
    it('offline queue rejects UPI', async () => {
      await expect(enqueueOfflinePayment({
        fee_assignment_id: 'fee-1',
        channel: 'upi' as any,
        amount: 500
      })).rejects.toThrow(/UPI payments cannot be queued offline/);
    });

    it('offline sync conflict creation when overpaying', async () => {
      // Mock recordPayment to throw (simulating overpayment)
      vi.mocked(prisma.feeAssignment.findUnique).mockResolvedValue({
        id: 'fee-1', amount: { toNumber: () => 1000 }
      } as any);
      
      // aggregate returns 1000 paid already
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({ _sum: { amount: { toNumber: () => 1000 } } } as any);
      
      const res = await syncOfflinePayment('local-1', 'fee-conflict', 'cash', 500, new Date().toISOString(), 'admin-1', 'school-1');
      
      expect(res.success).toBe(false);
      expect((res as any).conflictReason).toMatch(/Payment amount \(500\) exceeds remaining balance \(0\)/);
    });
  });

  describe('getStudentProfile school scoping', () => {
    it('returns nothing if student belongs to another school', async () => {
      vi.mocked(prisma.student.findFirst).mockResolvedValue(null);
      
      await expect(getStudentProfile('school-A', 'student-from-school-B'))
        .rejects.toThrow(/Student not found/);
    });
  });

  describe('computeDefaulterScore status exclusion', () => {
    it('active defaulters query only returns active students', async () => {
      // Mock findMany to return empty because the withdrawn student is filtered out
      vi.mocked(prisma.student.findMany).mockResolvedValue([]);
      
      const defaulters = await getDefaulters('school-1');
      expect(defaulters).toHaveLength(0);
      
      expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: "active" })
      }));
    });
  });
});
