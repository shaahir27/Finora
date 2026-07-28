/**
 * Demo Data — Hardcoded realistic datasets for every major page
 *
 * Used when isDemoMode() returns true (no DATABASE_URL configured).
 * Every dataset matches the exact return type of the server action it replaces.
 *
 * Data mirrors the seed file demographics for consistency:
 * Indian school context, INR currency, realistic fee amounts.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

// ─── Ledger Snapshot (Dashboard + Ledger pages) ──────────────────────────────
export function getDemoLedgerSnapshot() {
  const transactions = [
    {
      id: "tx-demo-101",
      schoolId: "demo-school-id",
      studentId: "stu-demo-1",
      studentName: "Aarav Sharma",
      student: { id: "stu-demo-1", name: "Aarav Sharma", admissionNumber: "ADM-2026-001" },
      feeAssignmentId: "fa-demo-101",
      feeAssignment: { id: "fa-demo-101", feeType: { name: "Tuition Fee", category: "tuition", gstTreatment: "taxable", gstRate: 18 } },
      amount: 14000,
      channel: "upi" as const,
      refNumber: "UPI891024819",
      reconciliationStatus: "posted" as const,
      postedAt: daysAgo(2),
      createdAt: daysAgo(2),
    },
    {
      id: "tx-demo-102",
      schoolId: "demo-school-id",
      studentId: "stu-demo-2",
      studentName: "Kabir Sharma",
      student: { id: "stu-demo-2", name: "Kabir Sharma", admissionNumber: "ADM-2026-002" },
      feeAssignmentId: "fa-demo-102",
      feeAssignment: { id: "fa-demo-102", feeType: { name: "Transport Fee", category: "transport", gstTreatment: "taxable", gstRate: 5 } },
      amount: 3500,
      channel: "cash" as const,
      refNumber: null,
      reconciliationStatus: "posted" as const,
      postedAt: daysAgo(3),
      createdAt: daysAgo(3),
    },
    {
      id: "tx-demo-103",
      schoolId: "demo-school-id",
      studentId: "stu-demo-3",
      studentName: "Neha Patel",
      student: { id: "stu-demo-3", name: "Neha Patel", admissionNumber: "ADM-2026-003" },
      feeAssignmentId: "fa-demo-103",
      feeAssignment: { id: "fa-demo-103", feeType: { name: "Tuition Fee", category: "tuition", gstTreatment: "taxable", gstRate: 18 } },
      amount: 18000,
      channel: "cheque" as const,
      refNumber: "CHQ-20260101",
      reconciliationStatus: "cheque_pending" as const,
      postedAt: daysAgo(5),
      createdAt: daysAgo(5),
    },
    {
      id: "tx-demo-104",
      schoolId: "demo-school-id",
      studentId: "stu-demo-4",
      studentName: "Ananya Iyer",
      student: { id: "stu-demo-4", name: "Ananya Iyer", admissionNumber: "ADM-2026-005" },
      feeAssignmentId: "fa-demo-104",
      feeAssignment: { id: "fa-demo-104", feeType: { name: "Activity Fee", category: "other", gstTreatment: "exempt", gstRate: 0 } },
      amount: 15000,
      channel: "upi" as const,
      refNumber: "UPI0000005001",
      reconciliationStatus: "flagged" as const,
      postedAt: daysAgo(7),
      createdAt: daysAgo(7),
    },
    {
      id: "tx-demo-105",
      schoolId: "demo-school-id",
      studentId: "stu-demo-5",
      studentName: "Rohan Das",
      student: { id: "stu-demo-5", name: "Rohan Das", admissionNumber: "ADM-2026-004" },
      feeAssignmentId: "fa-demo-105",
      feeAssignment: { id: "fa-demo-105", feeType: { name: "Tuition Fee", category: "tuition", gstTreatment: "taxable", gstRate: 18 } },
      amount: 10000,
      channel: "cash" as const,
      refNumber: null,
      reconciliationStatus: "posted" as const,
      postedAt: daysAgo(10),
      createdAt: daysAgo(10),
    },
    {
      id: "tx-demo-106",
      schoolId: "demo-school-id",
      studentId: "stu-demo-6",
      studentName: "Meera Sen",
      student: { id: "stu-demo-6", name: "Meera Sen", admissionNumber: "ADM-2026-007" },
      feeAssignmentId: "fa-demo-106",
      feeAssignment: { id: "fa-demo-106", feeType: { name: "Exam Fee", category: "other", gstTreatment: "exempt", gstRate: 0 } },
      amount: 2500,
      channel: "upi" as const,
      refNumber: "UPI9002001",
      reconciliationStatus: "posted" as const,
      postedAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
  ];

  return {
    transactions,
    nextCursor: undefined,
    totalCollected: 148500,
    pendingChequeTotal: 18000,
    pendingChequeCount: 1,
    flaggedTotal: 15000,
    flaggedCount: 1,
    reversedTotal: 4000,
    reversedCount: 1,
    outstandingDuesTotal: 52700,
    reconciliationStats: {
      matchPercentage: 94,
      flaggedCount: 1,
    },
    revenueByChannel: [
      { channel: "upi", amount: 95000 },
      { channel: "cash", amount: 33500 },
      { channel: "cheque", amount: 20000 },
    ],
  };
}

// ─── Students (Student Directory page) ───────────────────────────────────────
export function getDemoStudents() {
  return {
    students: [
      { id: "stu-demo-1", name: "Aarav Sharma", class: "10-A", admissionNumber: "ADM-2026-001", status: "active", schoolId: "demo-school-id", createdAt: daysAgo(180), statusChangedAt: null, balanceDisposition: null, totalBalance: 7000 },
      { id: "stu-demo-2", name: "Kabir Sharma", class: "8-B", admissionNumber: "ADM-2026-002", status: "active", schoolId: "demo-school-id", createdAt: daysAgo(180), statusChangedAt: null, balanceDisposition: null, totalBalance: 0 },
      { id: "stu-demo-3", name: "Neha Patel", class: "9-A", admissionNumber: "ADM-2026-003", status: "active", schoolId: "demo-school-id", createdAt: daysAgo(180), statusChangedAt: null, balanceDisposition: null, totalBalance: 24700 },
      { id: "stu-demo-4", name: "Rohan Das", class: "10-B", admissionNumber: "ADM-2026-004", status: "active", schoolId: "demo-school-id", createdAt: daysAgo(180), statusChangedAt: null, balanceDisposition: null, totalBalance: 0 },
      { id: "stu-demo-5", name: "Ananya Iyer", class: "11-A", admissionNumber: "ADM-2026-005", status: "active", schoolId: "demo-school-id", createdAt: daysAgo(180), statusChangedAt: null, balanceDisposition: null, totalBalance: 0 },
      { id: "stu-demo-6", name: "Dev Malhotra", class: "6-A", admissionNumber: "ADM-2026-006", status: "active", schoolId: "demo-school-id", createdAt: daysAgo(180), statusChangedAt: null, balanceDisposition: null, totalBalance: 4200 },
      { id: "stu-demo-7", name: "Meera Sen", class: "12-C", admissionNumber: "ADM-2026-007", status: "active", schoolId: "demo-school-id", createdAt: daysAgo(180), statusChangedAt: null, balanceDisposition: null, totalBalance: 32300 },
      { id: "stu-demo-8", name: "Priya Nair", class: "Graduated-2025", admissionNumber: "ADM-2025-008", status: "graduated", schoolId: "demo-school-id", createdAt: daysAgo(400), statusChangedAt: daysAgo(90), balanceDisposition: "carry_forward", totalBalance: 0 },
    ],
    nextCursor: undefined,
  };
}

// ─── Student Profile (Student detail page) ───────────────────────────────────
export function getDemoStudentProfile(studentId: string) {
  const students: Record<string, any> = {
    "stu-demo-1": {
      id: "stu-demo-1", name: "Aarav Sharma", class: "10-A", admissionNumber: "ADM-2026-001", status: "active", schoolId: "demo-school-id",
      feeAssignments: [
        { id: "fa-demo-101", feeType: { name: "Tuition Fee" }, amount: 14000, dueDate: daysAgo(45), paid: 7000, waived: 0, balance: 7000 },
        { id: "fa-demo-102", feeType: { name: "Transport Fee" }, amount: 3500, dueDate: daysAgo(45), paid: 3500, waived: 0, balance: 0 },
      ],
      totalBalance: 7000, totalPaid: 10500,
    },
  };
  return students[studentId] || students["stu-demo-1"];
}

// ─── Defaulters (Defaulter Tracking page) ────────────────────────────────────
export function getDemoDefaulters() {
  return [
    { studentId: "stu-demo-3", schoolId: "demo-school-id", riskLevel: 3, computedReason: "Total ₹24,700 overdue 75 days across 3 fee types. No payment recorded.", remainingBalance: 24700, maxDaysOverdue: 75, studentName: "Neha Patel", admissionNumber: "ADM-2026-003" },
    { studentId: "stu-demo-6", schoolId: "demo-school-id", riskLevel: 2, computedReason: "UPI reversal of ₹4,000. Bank chargeback received. Penalty ₹200 applied.", remainingBalance: 4200, maxDaysOverdue: 50, studentName: "Dev Malhotra", admissionNumber: "ADM-2026-006" },
    { studentId: "stu-demo-1", schoolId: "demo-school-id", riskLevel: 2, computedReason: "₹7,000 tuition overdue 45 days. Cheque ₹4,000 pending clearance.", remainingBalance: 7000, maxDaysOverdue: 45, studentName: "Aarav Sharma", admissionNumber: "ADM-2026-001" },
    { studentId: "stu-demo-7", schoolId: "demo-school-id", riskLevel: 1, computedReason: "₹32,300 upcoming dues across 5 fee types. Not yet overdue.", remainingBalance: 32300, maxDaysOverdue: 0, studentName: "Meera Sen", admissionNumber: "ADM-2026-007" },
  ];
}

// ─── Reminders Queue (Reminders page) ────────────────────────────────────────
export function getDemoReminders() {
  return {
    reminders: [
      {
        id: "rem-demo-1", feeAssignmentId: "fa-demo-103", studentName: "Neha Patel", studentId: "stu-demo-3", studentClass: "9-A",
        guardianPhone: "+919888888801", feeTypeName: "Tuition Fee", remainingBalance: 18000, dueDate: daysAgo(75).split("T")[0]!,
        daysOverdue: 75, draftedText: "Dear Parent, Neha's tuition fee of ₹18,000 remains overdue for 75 days. Immediate payment is required to avoid academic hold.",
        tier: 3, channel: "whatsapp", status: "logged" as const, createdAt: daysAgo(10), sentAt: null, dispatchError: null, isStale: false,
      },
      {
        id: "rem-demo-2", feeAssignmentId: "fa-demo-101", studentName: "Aarav Sharma", studentId: "stu-demo-1", studentClass: "10-A",
        guardianPhone: "+919999999999", feeTypeName: "Tuition Fee", remainingBalance: 7000, dueDate: daysAgo(45).split("T")[0]!,
        daysOverdue: 45, draftedText: "Dear Parent, Aarav's tuition fee of ₹7,000 remains overdue. Please clear at the earliest.",
        tier: 1, channel: "email", status: "sent" as const, createdAt: daysAgo(30), sentAt: daysAgo(30), dispatchError: null, isStale: false,
      },
      {
        id: "rem-demo-3", feeAssignmentId: "fa-demo-101", studentName: "Aarav Sharma", studentId: "stu-demo-1", studentClass: "10-A",
        guardianPhone: "+919999999999", feeTypeName: "Tuition Fee", remainingBalance: 7000, dueDate: daysAgo(45).split("T")[0]!,
        daysOverdue: 45, draftedText: "Urgent: ₹7,000 tuition overdue 45 days. Academic hold may be applied.",
        tier: 2, channel: "whatsapp", status: "logged" as const, createdAt: daysAgo(5), sentAt: null, dispatchError: null, isStale: false,
      },
    ],
    nextCursor: undefined,
  };
}

// ─── Parent Portal: Children ─────────────────────────────────────────────────
export function getDemoChildren() {
  return [
    { id: "stu-demo-1", name: "Aarav Sharma", class: "10-A", admissionNumber: "ADM-2026-001", status: "active" },
    { id: "stu-demo-2", name: "Kabir Sharma", class: "8-B", admissionNumber: "ADM-2026-002", status: "active" },
  ];
}

// ─── Parent Portal: Dues ─────────────────────────────────────────────────────
export function getDemoChildrenDues() {
  return [
    { id: "fa-demo-101", studentId: "stu-demo-1", studentName: "Aarav Sharma", studentClass: "10-A", feeType: "Tuition Fee", gstRate: 18, amount: 14000, amountPaid: 7000, remainingBalance: 7000, paymentStatus: "overdue", dueDate: daysAgo(45).split("T")[0]! },
    { id: "fa-demo-102", studentId: "stu-demo-1", studentName: "Aarav Sharma", studentClass: "10-A", feeType: "Transport Fee", gstRate: 5, amount: 3500, amountPaid: 3500, remainingBalance: 0, paymentStatus: "paid", dueDate: daysAgo(45).split("T")[0]! },
    { id: "fa-demo-103", studentId: "stu-demo-1", studentName: "Aarav Sharma", studentClass: "10-A", feeType: "Activity Fee", gstRate: 0, amount: 2000, amountPaid: 0, remainingBalance: 2000, paymentStatus: "unpaid", dueDate: daysAhead(15).split("T")[0]! },
    { id: "fa-demo-201", studentId: "stu-demo-2", studentName: "Kabir Sharma", studentClass: "8-B", feeType: "Tuition Fee", gstRate: 18, amount: 12000, amountPaid: 12000, remainingBalance: 0, paymentStatus: "paid", dueDate: daysAgo(60).split("T")[0]! },
    { id: "fa-demo-202", studentId: "stu-demo-2", studentName: "Kabir Sharma", studentClass: "8-B", feeType: "Transport Fee", gstRate: 5, amount: 2800, amountPaid: 2800, remainingBalance: 0, paymentStatus: "paid", dueDate: daysAgo(60).split("T")[0]! },
  ];
}

// ─── Parent Portal: Init Data (consolidated) ────────────────────────────────
export function getDemoParentInitData() {
  return {
    parentLinkId: "demo-parent-link",
    schoolId: "demo-school-id",
    children: getDemoChildren(),
    dues: getDemoChildrenDues(),
  };
}

// ─── Parent Portal: Payment History ──────────────────────────────────────────
export function getDemoPaymentHistory() {
  return {
    students: [
      { id: "stu-demo-1", name: "Aarav Sharma" },
      { id: "stu-demo-2", name: "Kabir Sharma" },
    ],
    transactions: [
      { id: "tx-demo-p1", studentName: "Aarav Sharma", feeType: "Tuition Fee", amount: 7000, channel: "cash", status: "posted", postedAt: daysAgo(40) },
      { id: "tx-demo-p2", studentName: "Aarav Sharma", feeType: "Transport Fee", amount: 3500, channel: "upi", status: "posted", postedAt: daysAgo(42) },
      { id: "tx-demo-p3", studentName: "Kabir Sharma", feeType: "Tuition Fee", amount: 12000, channel: "upi", status: "posted", postedAt: daysAgo(58) },
      { id: "tx-demo-p4", studentName: "Kabir Sharma", feeType: "Transport Fee", amount: 2800, channel: "cash", status: "posted", postedAt: daysAgo(58) },
    ],
    nextCursor: undefined,
  };
}

// ─── Offline Sync Conflicts ──────────────────────────────────────────────────
export function getDemoSyncConflicts() {
  return [];
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export function getDemoReportResult() {
  return { url: "#demo-mode", count: 0 };
}
