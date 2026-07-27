import { describe, it, expect } from "vitest";
import { parseBankStatementText, reconcileBankStatement } from "../reconcileBankStatement";

describe("reconcileBankStatement — Bank Statement Auto-Reconciliation Engine", () => {
  it("parses raw bank statement lines into BankLineItem objects", () => {
    const rawText = `
    2026-07-25,NEFT-ICICI-Rahul Sharma VIII-A Fee,UTR90218491,5000.00
    2026-07-25,UPI-Ananya Patel VII-B Fee,RRN84910294,3500.00
    `;

    const items = parseBankStatementText(rawText);
    expect(items.length).toBe(2);
    expect(items[0]?.amount).toBe(5000);
    expect(items[0]?.refNumber).toBe("UTR90218491");
    expect(items[1]?.amount).toBe(3500);
  });

  it("auto-matches exact student details by rule match", async () => {
    const rawText = `2026-07-25,NEFT-ICICI-Rahul Sharma VIII-A Fee,fa-101,5000.00`;

    const openAssignments = [
      {
        id: "fa-101",
        studentId: "s-1",
        studentName: "Rahul Sharma",
        admissionNumber: "ADM-101",
        className: "VIII-A",
        feeTypeName: "Tuition Fee",
        amount: 5000,
        remainingBalance: 5000,
        dueDate: "2026-08-01",
      },
    ];

    const result = await reconcileBankStatement(rawText, openAssignments);

    expect(result.autoMatched.length).toBe(1);
    expect(result.autoMatched[0]?.matchedAssignment.studentName).toBe("Rahul Sharma");
    expect(result.autoMatched[0]?.confidence).toContain("100%");
  });

  it("handles unmatched statements gracefully", async () => {
    const rawText = `2026-07-25,DIRECT CASH DEPOSIT CDM90123,CDM90123,9999.00`;

    const openAssignments = [
      {
        id: "fa-101",
        studentId: "s-1",
        studentName: "Rahul Sharma",
        admissionNumber: "ADM-101",
        className: "VIII-A",
        feeTypeName: "Tuition Fee",
        amount: 5000,
        remainingBalance: 5000,
        dueDate: "2026-08-01",
      },
    ];

    const result = await reconcileBankStatement(rawText, openAssignments);
    expect(result.unlinkedSuspense.length).toBe(1);
    expect(result.unlinkedSuspense[0]?.amount).toBe(9999);
  });
});
