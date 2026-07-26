"use server";

import { prisma, type FeeAssignment, type GstTreatment } from "@smart-school/db";

// Helper — strips Prisma Decimal from a FeeType row before it crosses the RSC boundary.
function serializeFeeType(ft: any) {
  return {
    ...ft,
    gstRate: ft.gstRate !== null && ft.gstRate !== undefined ? Number(ft.gstRate) : null,
  };
}

/**
 * Creates a new FeeType for a school.
 */
export async function createFeeType(
  schoolId: string,
  data: {
    name: string;
    category: string;
    isActive?: boolean;
    gstTreatment: GstTreatment;
    gstRate?: number;
  }
) {
  if (data.gstTreatment === "taxable" && (data.gstRate === undefined || data.gstRate === null || data.gstRate <= 0)) {
    throw new Error("GST rate is required and must be greater than 0 for taxable fee types.");
  }

  const created = await prisma.feeType.create({
    data: {
      schoolId,
      name: data.name,
      category: data.category,
      isActive: data.isActive ?? true,
      gstTreatment: data.gstTreatment,
      gstRate: data.gstTreatment === "taxable" ? (data.gstRate as number) : null,
    },
  });

  return serializeFeeType(created);
}

/**
 * Updates an existing FeeType.
 * Deactivating (isActive: false) does NOT delete/alter existing assignments.
 */
export async function updateFeeSchema(
  feeTypeId: string,
  changes: {
    name?: string;
    category?: string;
    isActive?: boolean;
    gstTreatment?: GstTreatment;
    gstRate?: number | null;
  }
) {
  // Fetch existing first to validate GST combinations
  const existing = await prisma.feeType.findUnique({ where: { id: feeTypeId } });
  if (!existing) throw new Error("FeeType not found");

  const newTreatment = changes.gstTreatment ?? existing.gstTreatment;
  let newRate = changes.gstRate !== undefined ? changes.gstRate : existing.gstRate;

  if (newTreatment === "taxable" && (newRate === null || newRate === undefined || Number(newRate) <= 0)) {
    throw new Error("GST rate is required and must be greater than 0 for taxable fee types.");
  }

  if (newTreatment === "exempt") {
    newRate = null;
  }

  const updated = await prisma.feeType.update({
    where: { id: feeTypeId },
    data: {
      ...changes,
      gstRate: newRate,
    },
  });

  return serializeFeeType(updated);
}

/**
 * Assigns a fee to one or more students.
 * Supports bulk via an array of studentIds.
 * One bad row does not abort the batch.
 */
export async function assignFee(
  schoolId: string,
  studentIds: string | string[],
  feeTypeId: string,
  data: { amount: number; dueDate: Date }
) {
  const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
  const succeeded: any[] = [];
  const failed: { studentId: string; reason: string }[] = [];

  const feeType = await prisma.feeType.findFirst({
    where: { id: feeTypeId, schoolId },
  });

  if (!feeType) {
    throw new Error("Fee type not found in this school");
  }
  if (!feeType.isActive) {
    throw new Error("Cannot assign an inactive fee type");
  }

  for (const studentId of ids) {
    try {
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId },
      });

      if (!student) {
        failed.push({ studentId, reason: "Student not found" });
        continue;
      }
      if (student.status !== "active") {
        failed.push({ studentId, reason: `Cannot assign fee to a ${student.status} student` });
        continue;
      }

      const assignment = await prisma.feeAssignment.create({
        data: {
          studentId,
          feeTypeId,
          schoolId,
          amount: data.amount,
          dueDate: data.dueDate,
        },
      });

      // Serialize Decimal before returning to client
      succeeded.push({ ...assignment, amount: Number(assignment.amount) });
    } catch (error: any) {
      failed.push({ studentId, reason: error.message || "Unknown error" });
    }
  }

  // If passed a single ID, return the single result for ease of use.
  if (!Array.isArray(studentIds)) {
    if (failed.length > 0) throw new Error(failed[0]?.reason);
    return succeeded[0];
  }

  return { succeeded, failed };
}
