import { PrismaClient, UserRole, StudentStatus, GstTreatment, PaymentChannel, ReconciliationStatus, ReminderChannel, ReminderStatus, ReceiptFormat } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const schoolId = "demo-school-id";

  console.log("Starting database seeding for School:", schoolId);

  // 1. Ensure school exists
  const school = await prisma.school.upsert({
    where: { id: schoolId },
    update: { name: "Demo International School" },
    create: {
      id: schoolId,
      name: "Demo International School",
    },
  });

  // 2. Ensure Admin User exists
  const adminUser = await prisma.user.upsert({
    where: { id: "seed-admin-01" },
    update: {
      email: "admin@school.edu",
      role: UserRole.admin,
      schoolId: school.id,
    },
    create: {
      id: "seed-admin-01",
      role: UserRole.admin,
      email: "admin@school.edu",
      phone: null,
      schoolId: school.id,
    },
  });

  // 3. Ensure Parent User exists
  const parentUser = await prisma.user.upsert({
    where: { id: "demo-parent-id" },
    update: {
      email: "parent@demo.com",
      phone: "+919999999999",
      role: UserRole.parent,
      schoolId: school.id,
    },
    create: {
      id: "demo-parent-id",
      role: UserRole.parent,
      email: "parent@demo.com",
      phone: "+919999999999",
      schoolId: school.id,
    },
  });

  // 4. Ensure ParentLink exists
  const parentLink = await prisma.parentLink.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      id: "demo-parent-link",
      userId: parentUser.id,
    },
  });

  // Clean up other students and associated entities to ensure fresh idempotency
  console.log("Cleaning up stale demo entities...");
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
  
  // Clean other parents seeded earlier (excluding main demo parent)
  await prisma.user.deleteMany({
    where: {
      schoolId,
      role: UserRole.parent,
      id: { not: parentUser.id }
    }
  });

  console.log("Creating fee types...");
  // 5. Create Fee Types
  const ftTuition = await prisma.feeType.create({
    data: {
      schoolId,
      name: "Tuition Fee",
      category: "tuition",
      isActive: true,
      gstTreatment: GstTreatment.taxable,
      gstRate: 0.18,
    },
  });

  const ftTransport = await prisma.feeType.create({
    data: {
      schoolId,
      name: "Transport Fee",
      category: "transport",
      isActive: true,
      gstTreatment: GstTreatment.taxable,
      gstRate: 0.05,
    },
  });

  const ftActivity = await prisma.feeType.create({
    data: {
      schoolId,
      name: "Activity Fee",
      category: "other",
      isActive: true,
      gstTreatment: GstTreatment.exempt,
    },
  });

  const ftExam = await prisma.feeType.create({
    data: {
      schoolId,
      name: "Exam Fee",
      category: "other",
      isActive: true,
      gstTreatment: GstTreatment.exempt,
    },
  });

  console.log("Creating students and fee assignments...");

  const now = new Date();
  const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // ----------------------------------------------------
  // Student A: Aarav Sharma (Linked to demo parent)
  // Use Case: Overdue fees + Cheque Pending
  // ----------------------------------------------------
  const studentA = await prisma.student.create({
    data: {
      id: "demo-student-1",
      name: "Aarav Sharma",
      class: "10-A",
      schoolId,
      admissionNumber: "ADM-001",
      status: StudentStatus.active,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink.id,
      studentId: studentA.id,
    },
  });

  // Aarav Tuition (12,000, due 30 days ago)
  const assignATuition = await prisma.feeAssignment.create({
    data: {
      studentId: studentA.id,
      feeTypeId: ftTuition.id,
      schoolId,
      amount: 12000,
      dueDate: past30Days,
    },
  });

  // Aarav Transport (3,000, due next month)
  const assignATransport = await prisma.feeAssignment.create({
    data: {
      studentId: studentA.id,
      feeTypeId: ftTransport.id,
      schoolId,
      amount: 3000,
      dueDate: next30Days,
    },
  });

  // Aarav Tuition transactions:
  // - Posted Cash Payment of 6000
  const txACash = await prisma.transaction.create({
    data: {
      feeAssignmentId: assignATuition.id,
      studentId: studentA.id,
      schoolId,
      channel: PaymentChannel.cash,
      amount: 6000,
      reconciliationStatus: ReconciliationStatus.posted,
      postedAt: past30Days,
    },
  });

  // - Pending Cheque of 3000
  const txACheque = await prisma.transaction.create({
    data: {
      feeAssignmentId: assignATuition.id,
      studentId: studentA.id,
      schoolId,
      channel: PaymentChannel.cheque,
      amount: 3000,
      refNumber: "CHQ-889922",
      reconciliationStatus: ReconciliationStatus.cheque_pending,
      postedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // Aarav Transport transaction:
  // - Fully paid via UPI
  const txATransport = await prisma.transaction.create({
    data: {
      feeAssignmentId: assignATransport.id,
      studentId: studentA.id,
      schoolId,
      channel: PaymentChannel.upi,
      amount: 3000,
      refNumber: "pay_trans_1122",
      reconciliationStatus: ReconciliationStatus.posted,
      postedAt: now,
    },
  });

  // Create receipt for the transport payment
  await prisma.receipt.create({
    data: {
      transactionId: txATransport.id,
      receiptNumber: "RCP-2026-0001",
      format: ReceiptFormat.a4,
      gstAmount: 142.86, // 3000 * 5/105
      gstDetails: { gstTreatment: "taxable", gstRate: 0.05 },
      pdfUrl: "https://supabase-storage/receipts/rcp-0001.pdf",
    },
  });

  // ----------------------------------------------------
  // Student B: Kabir Sharma (Linked to demo parent)
  // Use Case: Fully paid child
  // ----------------------------------------------------
  const studentB = await prisma.student.create({
    data: {
      id: "demo-student-2",
      name: "Kabir Sharma",
      class: "8-B",
      schoolId,
      admissionNumber: "ADM-002",
      status: StudentStatus.active,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink.id,
      studentId: studentB.id,
    },
  });

  const assignBTuition = await prisma.feeAssignment.create({
    data: {
      studentId: studentB.id,
      feeTypeId: ftTuition.id,
      schoolId,
      amount: 10000,
      dueDate: past30Days,
    },
  });

  const assignBTransport = await prisma.feeAssignment.create({
    data: {
      studentId: studentB.id,
      feeTypeId: ftTransport.id,
      schoolId,
      amount: 2500,
      dueDate: past30Days,
    },
  });

  // Fully Paid Transactions
  const txBTuition = await prisma.transaction.create({
    data: {
      feeAssignmentId: assignBTuition.id,
      studentId: studentB.id,
      schoolId,
      channel: PaymentChannel.upi,
      amount: 10000,
      refNumber: "pay_tuit_9988",
      reconciliationStatus: ReconciliationStatus.posted,
      postedAt: past30Days,
    },
  });

  await prisma.receipt.create({
    data: {
      transactionId: txBTuition.id,
      receiptNumber: "RCP-2026-0002",
      format: ReceiptFormat.a4,
      gstAmount: 1525.42, // 10000 * 18/118
      gstDetails: { gstTreatment: "taxable", gstRate: 0.18 },
      pdfUrl: "https://supabase-storage/receipts/rcp-0002.pdf",
    },
  });

  await prisma.transaction.create({
    data: {
      feeAssignmentId: assignBTransport.id,
      studentId: studentB.id,
      schoolId,
      channel: PaymentChannel.cash,
      amount: 2500,
      reconciliationStatus: ReconciliationStatus.posted,
      postedAt: past30Days,
    },
  });

  // ----------------------------------------------------
  // Student C: Neha Patel (Linked to parent 2)
  // Use Case: Critical Defaulter
  // ----------------------------------------------------
  const parentUser2 = await prisma.user.create({
    data: {
      role: UserRole.parent,
      email: "parent2@demo.com",
      phone: "+919888888888",
      schoolId,
    },
  });

  const parentLink2 = await prisma.parentLink.create({
    data: { userId: parentUser2.id },
  });

  const studentC = await prisma.student.create({
    data: {
      name: "Neha Patel",
      class: "9-A",
      schoolId,
      admissionNumber: "ADM-003",
      status: StudentStatus.active,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink2.id,
      studentId: studentC.id,
    },
  });

  const assignCTuition = await prisma.feeAssignment.create({
    data: {
      studentId: studentC.id,
      feeTypeId: ftTuition.id,
      schoolId,
      amount: 18000,
      dueDate: past30Days,
    },
  });

  const assignCTransport = await prisma.feeAssignment.create({
    data: {
      studentId: studentC.id,
      feeTypeId: ftTransport.id,
      schoolId,
      amount: 4500,
      dueDate: past30Days,
    },
  });

  // Critical defaulter score
  await prisma.defaulterScore.create({
    data: {
      studentId: studentC.id,
      schoolId,
      riskLevel: 92,
      computedReason: "Student owes 22,500 total, outstanding for over 30 days.",
      computedAt: now,
    },
  });

  // ----------------------------------------------------
  // Student D: Rohan Das (Linked to parent 3)
  // Use Case: Waiver applied
  // ----------------------------------------------------
  const parentUser3 = await prisma.user.create({
    data: {
      role: UserRole.parent,
      email: "parent3@demo.com",
      phone: "+919777777777",
      schoolId,
    },
  });

  const parentLink3 = await prisma.parentLink.create({
    data: { userId: parentUser3.id },
  });

  const studentD = await prisma.student.create({
    data: {
      name: "Rohan Das",
      class: "10-B",
      schoolId,
      admissionNumber: "ADM-004",
      status: StudentStatus.active,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink3.id,
      studentId: studentD.id,
    },
  });

  const assignDTuition = await prisma.feeAssignment.create({
    data: {
      studentId: studentD.id,
      feeTypeId: ftTuition.id,
      schoolId,
      amount: 15000,
      dueDate: past30Days,
    },
  });

  // Apply Waiver of 5000
  await prisma.waiver.create({
    data: {
      feeAssignmentId: assignDTuition.id,
      approvedById: adminUser.id,
      amount: 5000,
      reason: "Scholarship discount applied by principal",
    },
  });

  // Pay remaining 10000
  await prisma.transaction.create({
    data: {
      feeAssignmentId: assignDTuition.id,
      studentId: studentD.id,
      schoolId,
      channel: PaymentChannel.cash,
      amount: 10000,
      reconciliationStatus: ReconciliationStatus.posted,
      postedAt: past30Days,
    },
  });

  // ----------------------------------------------------
  // Student E: Ananya Iyer (Linked to parent 4)
  // Use Case: Flagged Transaction
  // ----------------------------------------------------
  const parentUser4 = await prisma.user.create({
    data: {
      role: UserRole.parent,
      email: "parent4@demo.com",
      phone: "+919666666666",
      schoolId,
    },
  });

  const parentLink4 = await prisma.parentLink.create({
    data: { userId: parentUser4.id },
  });

  const studentE = await prisma.student.create({
    data: {
      name: "Ananya Iyer",
      class: "11-A",
      schoolId,
      admissionNumber: "ADM-005",
      status: StudentStatus.active,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink4.id,
      studentId: studentE.id,
    },
  });

  const assignETuition = await prisma.feeAssignment.create({
    data: {
      studentId: studentE.id,
      feeTypeId: ftTuition.id,
      schoolId,
      amount: 12000,
      dueDate: past30Days,
    },
  });

  const txEFlagged = await prisma.transaction.create({
    data: {
      feeAssignmentId: assignETuition.id,
      studentId: studentE.id,
      schoolId,
      channel: PaymentChannel.upi,
      amount: 12000,
      refNumber: "UPI-DUPLICATE-9988",
      reconciliationStatus: ReconciliationStatus.flagged,
      postedAt: now,
    },
  });

  await prisma.anomalyFlag.create({
    data: {
      transactionId: txEFlagged.id,
      schoolId,
      expectedAmount: 12000,
      receivedAmount: 12000,
      flagReason: "duplicate_channel_ref",
      narration: "Multiple transaction submissions detected using the same bank reference ID.",
    },
  });

  // ----------------------------------------------------
  // Student F: Dev Malhotra (Linked to parent 5)
  // Use Case: Reversed payment
  // ----------------------------------------------------
  const parentUser5 = await prisma.user.create({
    data: {
      role: UserRole.parent,
      email: "parent5@demo.com",
      phone: "+919555555555",
      schoolId,
    },
  });

  const parentLink5 = await prisma.parentLink.create({
    data: { userId: parentUser5.id },
  });

  const studentF = await prisma.student.create({
    data: {
      name: "Dev Malhotra",
      class: "6-A",
      schoolId,
      admissionNumber: "ADM-006",
      status: StudentStatus.active,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink5.id,
      studentId: studentF.id,
    },
  });

  const assignFTransport = await prisma.feeAssignment.create({
    data: {
      studentId: studentF.id,
      feeTypeId: ftTransport.id,
      schoolId,
      amount: 3500,
      dueDate: past30Days,
    },
  });

  await prisma.transaction.create({
    data: {
      feeAssignmentId: assignFTransport.id,
      studentId: studentF.id,
      schoolId,
      channel: PaymentChannel.upi,
      amount: 3500,
      refNumber: "pay_dev_rev",
      reconciliationStatus: ReconciliationStatus.reversed,
      postedAt: past30Days,
    },
  });

  // ----------------------------------------------------
  // Student G: Meera Sen (Linked to parent 6)
  // Use Case: Mixed Taxes
  // ----------------------------------------------------
  const parentUser6 = await prisma.user.create({
    data: {
      role: UserRole.parent,
      email: "parent6@demo.com",
      phone: "+919444444444",
      schoolId,
    },
  });

  const parentLink6 = await prisma.parentLink.create({
    data: { userId: parentUser6.id },
  });

  const studentG = await prisma.student.create({
    data: {
      name: "Meera Sen",
      class: "12-C",
      schoolId,
      admissionNumber: "ADM-007",
      status: StudentStatus.active,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink6.id,
      studentId: studentG.id,
    },
  });

  await prisma.feeAssignment.create({
    data: { studentId: studentG.id, feeTypeId: ftTuition.id, schoolId, amount: 10000, dueDate: next30Days },
  });
  await prisma.feeAssignment.create({
    data: { studentId: studentG.id, feeTypeId: ftTransport.id, schoolId, amount: 2000, dueDate: next30Days },
  });
  await prisma.feeAssignment.create({
    data: { studentId: studentG.id, feeTypeId: ftActivity.id, schoolId, amount: 1500, dueDate: next30Days },
  });
  await prisma.feeAssignment.create({
    data: { studentId: studentG.id, feeTypeId: ftExam.id, schoolId, amount: 1000, dueDate: next30Days },
  });

  // ----------------------------------------------------
  // Student H: Aditya Verma (Linked to parent 7)
  // Use Case: Inactive Graduated student
  // ----------------------------------------------------
  const parentUser7 = await prisma.user.create({
    data: {
      role: UserRole.parent,
      email: "parent7@demo.com",
      phone: "+919333333333",
      schoolId,
    },
  });

  const parentLink7 = await prisma.parentLink.create({
    data: { userId: parentUser7.id },
  });

  const studentH = await prisma.student.create({
    data: {
      name: "Aditya Verma",
      class: "Graduated-2026",
      schoolId,
      admissionNumber: "ADM-008",
      status: StudentStatus.graduated,
      balanceDisposition: "write_off",
      statusChangedAt: now,
    },
  });

  await prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink7.id,
      studentId: studentH.id,
    },
  });

  // ----------------------------------------------------
  // Defaulter scores baseline for dashboard charts
  // ----------------------------------------------------
  await prisma.defaulterScore.create({
    data: {
      studentId: studentA.id,
      schoolId,
      riskLevel: 45,
      computedReason: "Overdue tuition fee pending cleared cheque.",
      computedAt: now,
    },
  });

  // ----------------------------------------------------
  // Seed Stale and Pending Reminder Logs
  // ----------------------------------------------------
  await prisma.reminderLog.create({
    data: {
      feeAssignmentId: assignATuition.id,
      draftedText: "Dear Parent, Aarav's school fees of ₹6,000 are overdue. Please pay at your earliest convenience.",
      tier: 1,
      channel: ReminderChannel.email,
      status: ReminderStatus.logged,
    },
  });

  await prisma.reminderLog.create({
    data: {
      feeAssignmentId: assignBTuition.id,
      draftedText: "Dear Parent, Kabir's tuition fees of ₹10,000 are due. Please settle.",
      tier: 1,
      channel: ReminderChannel.email,
      status: ReminderStatus.sent,
      sentAt: past30Days,
    },
  });

  console.log("Database seeding completed successfully for 8 students.");
}

main()
  .catch((e) => {
    console.error("Database seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
