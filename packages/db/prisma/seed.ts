import {
  PrismaClient,
  UserRole,
  StudentStatus,
  GstTreatment,
  PaymentChannel,
  ReconciliationStatus,
  ReminderChannel,
  ReminderStatus,
  ReceiptFormat,
  BalanceDisposition,
} from "@prisma/client";

const prisma = new PrismaClient();

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const daysAgo   = (d: number) => new Date(Date.now() - d * 864e5);
const daysAhead = (d: number) => new Date(Date.now() + d * 864e5);
const upiRef    = (n: number) => `UPI${String(n).padStart(10, "0")}`;
const chqRef    = (n: number) => `CHQ-20260${String(n).padStart(4, "0")}`;
const rcpNum    = (n: number) => `RCP-2026-${String(n).padStart(4, "0")}`;

async function main() {
  const schoolId = "demo-school-id";
  console.log("ðŸŒ± Starting rich demo seed for school:", schoolId);

  // â”€â”€ 1. School â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.school.upsert({
    where:  { id: schoolId },
    update: { name: "Finora International School" },
    create: { id: schoolId, name: "Finora International School" },
  });

  // â”€â”€ 2. Admin user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const admin = await prisma.user.upsert({
    where:  { id: "seed-admin-01" },
    update: { email: "admin@school.edu", role: UserRole.admin, schoolId },
    create: { id: "seed-admin-01", role: UserRole.admin, email: "admin@school.edu", phone: null, schoolId },
  });

  await prisma.user.upsert({
    where:  { id: "razorpay-webhook-system" },
    update: { email: "webhook@razorpay.system", role: UserRole.admin, schoolId },
    create: { id: "razorpay-webhook-system", role: UserRole.admin, email: "webhook@razorpay.system", phone: null, schoolId },
  });

  // â”€â”€ 3. Demo parent (linked to 2 students â€” portal demo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const demoParent = await prisma.user.upsert({
    where:  { id: "demo-parent-id" },
    update: { email: "parent@demo.com", phone: "+919999999999", role: UserRole.parent, schoolId },
    create: { id: "demo-parent-id", role: UserRole.parent, email: "parent@demo.com", phone: "+919999999999", schoolId },
  });
  const demoParentLink = await prisma.parentLink.upsert({
    where:  { userId: demoParent.id },
    update: {},
    create: { id: "demo-parent-link", userId: demoParent.id },
  });

  // â”€â”€ 4. Wipe stale data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("ðŸ§¹ Cleaning existing demo dataâ€¦");
  await prisma.receipt.deleteMany({ where: { transaction: { schoolId } } });
  await prisma.anomalyFlag.deleteMany({ where: { transaction: { schoolId } } });
  await prisma.penalty.deleteMany({ where: { transaction: { schoolId } } });
  await prisma.waiver.deleteMany({ where: { feeAssignment: { schoolId } } });
  await prisma.reminderLog.deleteMany({ where: { feeAssignment: { schoolId } } });
  await prisma.transaction.deleteMany({ where: { schoolId } });
  await prisma.feeAssignment.deleteMany({ where: { schoolId } });
  await prisma.feeType.deleteMany({ where: { schoolId } });
  await prisma.defaulterScore.deleteMany({ where: { schoolId } });
  await prisma.offlineSyncConflict.deleteMany({ where: { schoolId } });
  await prisma.ocrStaging.deleteMany({ where: { schoolId } });
  await prisma.pushSubscription.deleteMany({ where: { user: { schoolId } } });
  await prisma.guardianOf.deleteMany({ where: { student: { schoolId } } });
  await prisma.student.deleteMany({ where: { schoolId } });
  // Delete parentLinks for non-demo parents BEFORE deleting those user records
  await prisma.parentLink.deleteMany({
    where: { user: { schoolId, role: UserRole.parent, id: { not: demoParent.id } } },
  });
  await prisma.user.deleteMany({
    where: { schoolId, role: UserRole.parent, id: { not: demoParent.id } },
  });


  // â”€â”€ 5. Fee types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("ðŸ“‹ Creating fee typesâ€¦");
  const ftTuition   = await prisma.feeType.create({ data: { schoolId, name: "Tuition Fee",   category: "tuition",   isActive: true, gstTreatment: GstTreatment.taxable, gstRate: 0.18 } });
  const ftTransport = await prisma.feeType.create({ data: { schoolId, name: "Transport Fee", category: "transport", isActive: true, gstTreatment: GstTreatment.taxable, gstRate: 0.05 } });
  const ftActivity  = await prisma.feeType.create({ data: { schoolId, name: "Activity Fee",  category: "other",     isActive: true, gstTreatment: GstTreatment.exempt } });
  const ftExam      = await prisma.feeType.create({ data: { schoolId, name: "Exam Fee",       category: "other",     isActive: true, gstTreatment: GstTreatment.exempt } });
  const ftLab       = await prisma.feeType.create({ data: { schoolId, name: "Lab Fee",        category: "other",     isActive: true, gstTreatment: GstTreatment.exempt } });

  // â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let rcpCounter = 1;

  async function makeParent(email: string, phone: string) {
    const u  = await prisma.user.create({ data: { role: UserRole.parent, email, phone, schoolId } });
    const pl = await prisma.parentLink.create({ data: { userId: u.id } });
    return pl;
  }

  async function mkReceipt(txId: string, amount: number, gstRate: number) {
    const gstAmt = amount * gstRate / (1 + gstRate);
    await prisma.receipt.create({
      data: {
        transactionId: txId,
        schoolId,
        receiptNumber: rcpNum(rcpCounter++),
        format:        ReceiptFormat.a4,
        gstAmount:     Math.round(gstAmt * 100) / 100,
        gstDetails:    { gstTreatment: "taxable", gstRate },
        pdfUrl:        `https://storage.supabase.co/receipts/rcp-${rcpCounter}.pdf`,
      },
    });
  }




  console.log("ðŸ‘¨â€ðŸŽ“ Seeding studentsâ€¦");

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 1 â€” Aarav Sharma  [Demo parent child 1]
  // Overdue tuition (partial cash) + pending cheque + transport fully paid
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const s1 = await prisma.student.create({ data: { id: "demo-student-1", name: "Aarav Sharma", class: "10-A", schoolId, admissionNumber: "ADM-2026-001", status: StudentStatus.active } });
  await prisma.guardianOf.create({ data: { parentLinkId: demoParentLink.id, studentId: s1.id } });

  const fa1a = await prisma.feeAssignment.create({ data: { studentId: s1.id, feeTypeId: ftTuition.id,   schoolId, amount: 14000, dueDate: daysAgo(45) } });
  const fa1b = await prisma.feeAssignment.create({ data: { studentId: s1.id, feeTypeId: ftTransport.id, schoolId, amount: 3500,  dueDate: daysAgo(45) } });
  const fa1c = await prisma.feeAssignment.create({ data: { studentId: s1.id, feeTypeId: ftActivity.id,  schoolId, amount: 2000,  dueDate: daysAhead(15) } });

  await prisma.transaction.create({ data: { feeAssignmentId: fa1a.id, studentId: s1.id, schoolId, channel: PaymentChannel.cash,   amount: 7000, reconciliationStatus: ReconciliationStatus.posted,        postedAt: daysAgo(40) } });
  const tx1chq = await prisma.transaction.create({ data: { feeAssignmentId: fa1a.id, studentId: s1.id, schoolId, channel: PaymentChannel.cheque, amount: 4000, refNumber: chqRef(1), reconciliationStatus: ReconciliationStatus.cheque_pending, postedAt: daysAgo(5) } });
  const tx1t   = await prisma.transaction.create({ data: { feeAssignmentId: fa1b.id, studentId: s1.id, schoolId, channel: PaymentChannel.upi,    amount: 3500, refNumber: upiRef(1001), reconciliationStatus: ReconciliationStatus.posted,        postedAt: daysAgo(42) } });
  await mkReceipt(tx1t.id, 3500, 0.05);

  await prisma.reminderLog.create({ data: { feeAssignmentId: fa1a.id, draftedText: "Dear Parent, Aarav's tuition fee of â‚¹7,000 remains overdue. Please clear at the earliest.", tier: 1, channel: ReminderChannel.email,     status: ReminderStatus.sent,   sentAt: daysAgo(30) } });
  await prisma.reminderLog.create({ data: { feeAssignmentId: fa1a.id, draftedText: "Urgent: â‚¹7,000 tuition overdue 45 days. Academic hold may be applied.",                       tier: 2, channel: ReminderChannel.whatsapp, status: ReminderStatus.logged } });
  await prisma.defaulterScore.create({ data: { studentId: s1.id, schoolId, riskLevel: 55, computedReason: "â‚¹7,000 tuition overdue 45 days. Cheque â‚¹4,000 pending clearance.", computedAt: daysAgo(1) } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 2 â€” Kabir Sharma  [Demo parent child 2]
  // All fees fully paid â€” clean record
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const s2 = await prisma.student.create({ data: { id: "demo-student-2", name: "Kabir Sharma", class: "8-B", schoolId, admissionNumber: "ADM-2026-002", status: StudentStatus.active } });
  await prisma.guardianOf.create({ data: { parentLinkId: demoParentLink.id, studentId: s2.id } });

  const fa2a = await prisma.feeAssignment.create({ data: { studentId: s2.id, feeTypeId: ftTuition.id,   schoolId, amount: 12000, dueDate: daysAgo(60) } });
  const fa2b = await prisma.feeAssignment.create({ data: { studentId: s2.id, feeTypeId: ftTransport.id, schoolId, amount: 2800,  dueDate: daysAgo(60) } });
  const fa2c = await prisma.feeAssignment.create({ data: { studentId: s2.id, feeTypeId: ftExam.id,      schoolId, amount: 1500,  dueDate: daysAgo(30) } });

  const tx2a = await prisma.transaction.create({ data: { feeAssignmentId: fa2a.id, studentId: s2.id, schoolId, channel: PaymentChannel.upi,  amount: 12000, refNumber: upiRef(1002), reconciliationStatus: ReconciliationStatus.posted, postedAt: daysAgo(58) } });
  await mkReceipt(tx2a.id, 12000, 0.18);
  await prisma.transaction.create({ data: { feeAssignmentId: fa2b.id, studentId: s2.id, schoolId, channel: PaymentChannel.cash, amount: 2800,  reconciliationStatus: ReconciliationStatus.posted, postedAt: daysAgo(58) } });
  const tx2c = await prisma.transaction.create({ data: { feeAssignmentId: fa2c.id, studentId: s2.id, schoolId, channel: PaymentChannel.upi,  amount: 1500,  refNumber: upiRef(1003), reconciliationStatus: ReconciliationStatus.posted, postedAt: daysAgo(28) } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 3 â€” Neha Patel  CRITICAL defaulter â€” 3 fee types, zero paid
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const pl3 = await makeParent("parent.neha@demo.com", "+919888888801");
  const s3   = await prisma.student.create({ data: { name: "Neha Patel",  class: "9-A", schoolId, admissionNumber: "ADM-2026-003", status: StudentStatus.active } });
  await prisma.guardianOf.create({ data: { parentLinkId: pl3.id, studentId: s3.id } });

  const fa3a = await prisma.feeAssignment.create({ data: { studentId: s3.id, feeTypeId: ftTuition.id,   schoolId, amount: 18000, dueDate: daysAgo(75) } });
  const fa3b = await prisma.feeAssignment.create({ data: { studentId: s3.id, feeTypeId: ftTransport.id, schoolId, amount: 4200,  dueDate: daysAgo(75) } });
  const fa3c = await prisma.feeAssignment.create({ data: { studentId: s3.id, feeTypeId: ftActivity.id,  schoolId, amount: 2500,  dueDate: daysAgo(75) } });

  await prisma.reminderLog.create({ data: { feeAssignmentId: fa3a.id, draftedText: "Urgent: â‚¹18,000 tuition overdue 75 days. Immediate payment required.", tier: 3, channel: ReminderChannel.whatsapp, status: ReminderStatus.sent, sentAt: daysAgo(10) } });
  await prisma.defaulterScore.create({ data: { studentId: s3.id, schoolId, riskLevel: 94, computedReason: "Total â‚¹24,700 overdue 75 days across 3 fee types. No payment recorded.", computedAt: daysAgo(1) } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 4 â€” Rohan Das  Scholarship waiver + balance paid
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const pl4 = await makeParent("parent.rohan@demo.com", "+919888888802");
  const s4   = await prisma.student.create({ data: { name: "Rohan Das", class: "10-B", schoolId, admissionNumber: "ADM-2026-004", status: StudentStatus.active } });
  await prisma.guardianOf.create({ data: { parentLinkId: pl4.id, studentId: s4.id } });

  const fa4a = await prisma.feeAssignment.create({ data: { studentId: s4.id, feeTypeId: ftTuition.id, schoolId, amount: 16000, dueDate: daysAgo(30) } });
  await prisma.waiver.create({ data: { feeAssignmentId: fa4a.id, approvedById: admin.id, amount: 6000, reason: "Principal scholarship â€” merit-based 37.5% discount" } });
  await prisma.transaction.create({ data: { feeAssignmentId: fa4a.id, studentId: s4.id, schoolId, channel: PaymentChannel.cash, amount: 10000, reconciliationStatus: ReconciliationStatus.posted, postedAt: daysAgo(25) } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "waiver_applied", beforeState: { balance: 16000 }, afterState: { balance: 0, waiver: 6000, paid: 10000 } } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 5 â€” Ananya Iyer  Duplicate UPI flagged
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const pl5 = await makeParent("parent.ananya@demo.com", "+919888888803");
  const s5   = await prisma.student.create({ data: { name: "Ananya Iyer", class: "11-A", schoolId, admissionNumber: "ADM-2026-005", status: StudentStatus.active } });
  await prisma.guardianOf.create({ data: { parentLinkId: pl5.id, studentId: s5.id } });

  const fa5a    = await prisma.feeAssignment.create({ data: { studentId: s5.id, feeTypeId: ftTuition.id, schoolId, amount: 15000, dueDate: daysAgo(20) } });
  const tx5ok   = await prisma.transaction.create({ data: { feeAssignmentId: fa5a.id, studentId: s5.id, schoolId, channel: PaymentChannel.upi, amount: 15000, refNumber: upiRef(5001), reconciliationStatus: ReconciliationStatus.posted,  postedAt: daysAgo(18) } });
  await mkReceipt(tx5ok.id, 15000, 0.18);
  const tx5flag = await prisma.transaction.create({ data: { feeAssignmentId: fa5a.id, studentId: s5.id, schoolId, channel: PaymentChannel.upi, amount: 15000, refNumber: upiRef(5001), reconciliationStatus: ReconciliationStatus.flagged, postedAt: daysAgo(17) } });
  await prisma.anomalyFlag.create({ data: { transactionId: tx5flag.id, schoolId, expectedAmount: 0, receivedAmount: 15000, flagReason: "duplicate_channel_ref", narration: "Duplicate UPI reference UPI0000005001 detected. First payment already posted. Second submission flagged for admin review." } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 6 â€” Dev Malhotra  Reversed UPI + penalty
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const pl6 = await makeParent("parent.dev@demo.com", "+919888888804");
  const s6   = await prisma.student.create({ data: { name: "Dev Malhotra", class: "6-A", schoolId, admissionNumber: "ADM-2026-006", status: StudentStatus.active } });
  await prisma.guardianOf.create({ data: { parentLinkId: pl6.id, studentId: s6.id } });

  const fa6a = await prisma.feeAssignment.create({ data: { studentId: s6.id, feeTypeId: ftTransport.id, schoolId, amount: 4000, dueDate: daysAgo(50) } });
  const tx6  = await prisma.transaction.create({ data: { feeAssignmentId: fa6a.id, studentId: s6.id, schoolId, channel: PaymentChannel.upi, amount: 4000, refNumber: upiRef(6001), reconciliationStatus: ReconciliationStatus.reversed, postedAt: daysAgo(48) } });
  await prisma.penalty.create({ data: { transactionId: tx6.id, amount: 200, reason: "Late payment penalty â€” 5% of due amount after 30 days" } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "transaction_reversed", beforeState: { status: "posted" }, afterState: { status: "reversed", reason: "Bank chargeback â€” insufficient funds" } } });
  await prisma.defaulterScore.create({ data: { studentId: s6.id, schoolId, riskLevel: 70, computedReason: "UPI reversal of â‚¹4,000. Bank chargeback received. Penalty â‚¹200 applied. Balance overdue 50 days.", computedAt: daysAgo(1) } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 7 â€” Meera Sen  All 5 fee types, upcoming dues only
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const pl7 = await makeParent("parent.meera@demo.com", "+919888888805");
  const s7   = await prisma.student.create({ data: { name: "Meera Sen", class: "12-C", schoolId, admissionNumber: "ADM-2026-007", status: StudentStatus.active } });
  await prisma.guardianOf.create({ data: { parentLinkId: pl7.id, studentId: s7.id } });

  const fa7a = await prisma.feeAssignment.create({ data: { studentId: s7.id, feeTypeId: ftTuition.id,   schoolId, amount: 20000, dueDate: daysAhead(10) } });
  await prisma.feeAssignment.create({ data: { studentId: s7.id, feeTypeId: ftTransport.id, schoolId, amount: 5000,  dueDate: daysAhead(10) } });
  await prisma.feeAssignment.create({ data: { studentId: s7.id, feeTypeId: ftActivity.id,  schoolId, amount: 3000,  dueDate: daysAhead(15) } });
  await prisma.feeAssignment.create({ data: { studentId: s7.id, feeTypeId: ftExam.id,      schoolId, amount: 2500,  dueDate: daysAhead(20) } });
  await prisma.feeAssignment.create({ data: { studentId: s7.id, feeTypeId: ftLab.id,       schoolId, amount: 1800,  dueDate: daysAhead(20) } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENT 8 â€” Priya Nair  Graduated â€” carry forward
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const pl8 = await makeParent("parent.priya@demo.com", "+919888888806");
  const s8   = await prisma.student.create({ data: { name: "Priya Nair", class: "Graduated-2025", schoolId, admissionNumber: "ADM-2025-008", status: StudentStatus.graduated, balanceDisposition: BalanceDisposition.carry_forward, statusChangedAt: daysAgo(90) } });
  await prisma.guardianOf.create({ data: { parentLinkId: pl8.id, studentId: s8.id } });

  const fa8a = await prisma.feeAssignment.create({ data: { studentId: s8.id, feeTypeId: ftTuition.id, schoolId, amount: 10000, dueDate: daysAgo(120) } });
  await prisma.transaction.create({ data: { feeAssignmentId: fa8a.id, studentId: s8.id, schoolId, channel: PaymentChannel.cash, amount: 10000, reconciliationStatus: ReconciliationStatus.posted, postedAt: daysAgo(120) } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STUDENTS 9â€“20  Bulk realistic data for charts & KPI density
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const bulkStudents = [
    { name: "Arjun Mehta",       cls: "7-A",  adm: "ADM-2026-009", email: "parent.arjun@demo.com",    phone: "+919700000001", tuition: 11000, transport: 3000, paid: true,  ch: PaymentChannel.upi,    days: 20 },
    { name: "Sana Khan",         cls: "9-B",  adm: "ADM-2026-010", email: "parent.sana@demo.com",     phone: "+919700000002", tuition: 14000, transport: 3500, paid: true,  ch: PaymentChannel.cash,   days: 35 },
    { name: "Vikram Reddy",      cls: "11-B", adm: "ADM-2026-011", email: "parent.vikram@demo.com",   phone: "+919700000003", tuition: 17000, transport: 4500, paid: false, ch: PaymentChannel.cheque, days: 10 },
    { name: "Pooja Krishnan",    cls: "6-B",  adm: "ADM-2026-012", email: "parent.pooja@demo.com",    phone: "+919700000004", tuition: 9000,  transport: 2500, paid: true,  ch: PaymentChannel.upi,    days: 50 },
    { name: "Rahul Gupta",       cls: "8-A",  adm: "ADM-2026-013", email: "parent.rahul@demo.com",    phone: "+919700000005", tuition: 13000, transport: 3200, paid: true,  ch: PaymentChannel.upi,    days: 15 },
    { name: "Divya Pillai",      cls: "12-A", adm: "ADM-2026-014", email: "parent.divya@demo.com",    phone: "+919700000006", tuition: 19000, transport: 5500, paid: true,  ch: PaymentChannel.cash,   days: 28 },
    { name: "Karan Joshi",       cls: "7-B",  adm: "ADM-2026-015", email: "parent.karan@demo.com",    phone: "+919700000007", tuition: 11500, transport: 3000, paid: false, ch: PaymentChannel.upi,    days: 60 },
    { name: "Tanvi Bhatt",       cls: "10-C", adm: "ADM-2026-016", email: "parent.tanvi@demo.com",    phone: "+919700000008", tuition: 15000, transport: 3800, paid: true,  ch: PaymentChannel.upi,    days: 5  },
    { name: "Amit Saxena",       cls: "9-C",  adm: "ADM-2026-017", email: "parent.amit@demo.com",     phone: "+919700000009", tuition: 13500, transport: 3300, paid: true,  ch: PaymentChannel.cash,   days: 45 },
    { name: "Sneha Nambiar",     cls: "11-C", adm: "ADM-2026-018", email: "parent.sneha@demo.com",    phone: "+919700000010", tuition: 16500, transport: 4200, paid: false, ch: PaymentChannel.cheque, days: 22 },
    { name: "Ritesh Agarwal",    cls: "6-C",  adm: "ADM-2026-019", email: "parent.ritesh@demo.com",   phone: "+919700000011", tuition: 9500,  transport: 2600, paid: true,  ch: PaymentChannel.upi,    days: 70 },
    { name: "Manisha Choudhary", cls: "8-C",  adm: "ADM-2026-020", email: "parent.manisha@demo.com",  phone: "+919700000012", tuition: 12500, transport: 3100, paid: true,  ch: PaymentChannel.upi,    days: 12 },
  ] as const;

  let txCounter  = 2000;
  let chqCounter = 100;

  for (const st of bulkStudents) {
    const pl = await makeParent(st.email, st.phone);
    const s  = await prisma.student.create({ data: { name: st.name, class: st.cls, schoolId, admissionNumber: st.adm, status: StudentStatus.active } });
    await prisma.guardianOf.create({ data: { parentLinkId: pl.id, studentId: s.id } });

    const dueDate = st.paid ? daysAgo(st.days + 5) : daysAgo(st.days);
    const faT = await prisma.feeAssignment.create({ data: { studentId: s.id, feeTypeId: ftTuition.id,   schoolId, amount: st.tuition,   dueDate } });
    const faX = await prisma.feeAssignment.create({ data: { studentId: s.id, feeTypeId: ftTransport.id, schoolId, amount: st.transport, dueDate } });

    if (st.paid) {
      const isCheque = (st.ch as PaymentChannel) === PaymentChannel.cheque;
      const ref = isCheque ? chqRef(chqCounter++) : ((st.ch as PaymentChannel) !== PaymentChannel.cash ? upiRef(txCounter++) : undefined);
      const status = isCheque ? ReconciliationStatus.cheque_pending : ReconciliationStatus.posted;

      const txT = await prisma.transaction.create({ data: { feeAssignmentId: faT.id, studentId: s.id, schoolId, channel: st.ch, amount: st.tuition, refNumber: ref, reconciliationStatus: status, postedAt: daysAgo(st.days - 2) } });
      if (status === ReconciliationStatus.posted && st.ch === PaymentChannel.upi) {
        await mkReceipt(txT.id, st.tuition, 0.18);
      }
      await prisma.transaction.create({ data: { feeAssignmentId: faX.id, studentId: s.id, schoolId, channel: PaymentChannel.cash, amount: st.transport, reconciliationStatus: ReconciliationStatus.posted, postedAt: daysAgo(st.days - 2) } });
    } else {
      await prisma.reminderLog.create({ data: { feeAssignmentId: faT.id, draftedText: `Dear Parent, ${st.name}'s tuition of â‚¹${st.tuition} is overdue. Please clear immediately.`, tier: 1, channel: ReminderChannel.email, status: ReminderStatus.logged } });
      const risk = Math.min(95, 40 + Math.floor(st.days * 0.8));
      await prisma.defaulterScore.create({ data: { studentId: s.id, schoolId, riskLevel: risk, computedReason: `â‚¹${st.tuition + st.transport} overdue for ${st.days} days.`, computedAt: daysAgo(1) } });
    }
  }

  // â”€â”€ 7. Historical transactions for revenue trend chart (Q1 â€” 60â€“90 days ago) â”€â”€
  console.log("ðŸ“Š Seeding historical Q1 transactionsâ€¦");
  const histEntries = [
    { faId: fa1c.id, sId: s1.id, amt: 2000, ch: PaymentChannel.cash,   day: 65 },
    { faId: fa2c.id, sId: s2.id, amt: 1500, ch: PaymentChannel.upi,    day: 70, ref: upiRef(9001) },
    { faId: fa7a.id, sId: s7.id, amt: 8500, ch: PaymentChannel.upi,    day: 75, ref: upiRef(9002) },
    { faId: fa3a.id, sId: s3.id, amt: 5000, ch: PaymentChannel.cash,   day: 80 },
    { faId: fa4a.id, sId: s4.id, amt: 4000, ch: PaymentChannel.cheque, day: 85, ref: chqRef(200) },
  ];
  for (const h of histEntries) {
    await prisma.transaction.create({ data: { feeAssignmentId: h.faId, studentId: h.sId, schoolId, channel: h.ch, amount: h.amt, refNumber: (h as any).ref, reconciliationStatus: ReconciliationStatus.posted, postedAt: daysAgo(h.day) } });
  }

  // â”€â”€ 8. OCR staging (for OCR demo page) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("ðŸ”¬ Seeding OCR staging entriesâ€¦");
  await prisma.ocrStaging.create({ data: { schoolId, imageUrl: "https://storage.supabase.co/ocr/receipt_scan_001.jpg", extractedAmount: 12500, extractedDate: daysAgo(3), extractedRefNumber: "CHQ-20260201", rawExtraction: { confidence: 0.94, fields: { amount: "12,500", date: "24-Jul-2026", ref: "CHQ-20260201" } }, confirmed: false } });
  await prisma.ocrStaging.create({ data: { schoolId, imageUrl: "https://storage.supabase.co/ocr/receipt_scan_002.jpg", extractedAmount: 8200,  extractedDate: daysAgo(1), extractedRefNumber: upiRef(7777),       rawExtraction: { confidence: 0.87, fields: { amount: "8,200",  date: "26-Jul-2026", ref: "UPI0000007777"  } }, confirmed: false } });

  // â”€â”€ 9. Offline sync conflict â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("ðŸ“µ Seeding offline sync conflictâ€¦");
  await prisma.offlineSyncConflict.create({ data: { schoolId, submittedById: admin.id, localId: "offline-local-uuid-001", feeAssignmentId: fa1a.id, channel: PaymentChannel.cash, amount: 3000, queuedAt: daysAgo(2), conflictReason: "Transaction already exists for this fee assignment with overlapping amount. Manual review required.", resolved: false } });

  // â”€â”€ 10. Additional audit log entries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "report_exported", beforeState: {}, afterState: { format: "pdf", range: "Q2-2026" } } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "cheque_bounced",  beforeState: { status: "cheque_pending" }, afterState: { status: "reversed", refNumber: chqRef(1) } } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "bulk_import",     beforeState: {}, afterState: { imported: 12, skipped: 0 } } });

  console.log(`
âœ… Rich demo seed complete!
   Students:      20 (2 linked to parent@demo.com portal)
   Fee Types:     5  (Tuition, Transport, Activity, Exam, Lab)
   Transactions:  ~45 across all channels & reconciliation states
   Receipts:      Generated for all posted UPI transactions
   Defaulters:    5 students with risk scores 55â€“94
   Waivers:       1 scholarship (â‚¹6,000 off â‚¹16,000)
   Penalties:     1 late-payment (â‚¹200)
   Anomaly Flags: 1 duplicate UPI
   Reminders:     4 logs (email + WhatsApp)
   OCR Staging:   2 unconfirmed receipt scans
   Offline Sync:  1 unresolved conflict
   Audit Logs:    5 entries
  `);
}

main()
  .catch((e) => { console.error("âŒ Seeding failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
