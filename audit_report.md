# Finora — Finalized Solutions (Round 4 + Round 5, Consolidated)

**Purpose:** This is the single, final solutions document covering every issue raised in the Round 4 (full re-audit) and Round 5 (external-review verification) reports. Every item from both has been mapped below exactly once — where Round 4 and Round 5 described the same underlying problem from different angles, they've been merged into one fix rather than listed twice, and that merge is called out explicitly so nothing looks silently dropped. Nothing from Round 2/3 is repeated here (those are closed out in the earlier solutions pass); this file is scoped strictly to Round 4 + Round 5.

**Verification approach:** every fix below was checked against the actual current source (the codebase the Round 4/5 audits were run against) — exact file, exact current code, exact line numbers where useful. I did not have a live build/DB to run in this sandbox, so "verified" means hand-traced against real types, real schema, and every real caller, not executed. The **Post-Fix Verification** checklist at the end tells you exactly what to run locally to close that gap.

---

## Master Checklist — every Round 4 + Round 5 item, mapped

| # | Item | Source | Where it's fixed below |
|---|---|---|---|
| 1 | `require-session.ts` auth guard silently no-ops outside production | R4 §2.1 | Fix 1 |
| 2 | `reverseTransaction`, `markChequeCleared`, `markChequeBounced`, `applyPenalty`, `applyWaiver` have no auth guard | R4 §2.2 | Fix 2 |
| 3 | `resolveAnomaly` calls the guard with `""`, silently defeating the school check | R4 §2.2 | Fix 2 |
| 4 | Same missing-guard pattern also found in `fees.ts`, `parents.ts` (IDOR), `push.ts` (IDOR), `reminders.ts`, `ai.ts` | R5 (SEC-2/3/5/6/7) | Fix 3 |
| 5 | Backdoor login credentials ungated; login page now has a one-click auto-fill button and leaks credentials in the error message | R4 §2.3, R5 (SEC-8, restated) | Fix 4 |
| 6 | "AI Draft Text" button calls `draftReminderTextAction` with the wrong arguments — always fails | R4 §2.4 | Fix 5 |
| 7 | "Grade-Wise Defaulter Risk Heatmap" shows fabricated, hardcoded numbers | R4 §2.5 | Fix 6 |
| 8 | Nav redesign orphaned `/admin/reminders` — `markReminderSent` (and its Round 2 fix) is now unreachable | R4 §2.6 | Fix 7 |
| 9 | Real Razorpay webhook payments will fail in production because of Fix 1/2's own guard | R5 (NEW-2) | Fix 8 — **read this before deploying Fix 1–4** |
| 10 | `simulateSandboxPayment` has no auth or environment gate — a live payment-fraud primitive once Fix 8 lands | R5 (NEW-3) | Fix 9 |
| 11 | `exportTallyXmlReport` calls a function that's out of scope — always throws | R5 (NEW-1) | Fix 10 |
| 12 | `recordPayment`'s session-verified `effectiveAdminId` is computed and then never used | R5 (NEW-4) | Fix 11 |
| 13 | Dead, duplicate `handleRazorpayWebhook` implementation in `payments.ts` | R5 (NEW-5) | Fix 12 |
| 14 | Receipt numbering can collide under concurrency; no DB uniqueness constraint | R5 (NEW-6) | Fix 13 |
| 15 | Anomaly detection uses strict floating-point equality on money | R5 (NEW-7) | Fix 14 |
| 16 | `bulkImportStudents` still inserts one row at a time | R5 (NEW-8) | Fix 15 |
| 17 | In-memory rate limiter won't work across serverless instances | R5 (MED-1) | Fix 16 |
| 18 | `getDefaulters` recomputes/writes scores sequentially per student (N+1) | R5 (MED-2) | Fix 17 |
| 19 | `getDefaulters`' balance gate still sums raw (unclamped) totals — masking bug | R4 §3 (R3-5, restated as still open) | Fix 17 *(same function as #18 — merged)* |
| 20 | `WEBHOOK_ADMIN_ID` isn't a real seeded `User` row | R5 (MED-3) | Fix 18 |
| 21 | DB partial unique indexes (UPI ref idempotency, admission number dedup) still not created | R4 §3 (R3-1, restated as still open) | Fix 19 |
| 22 | Offline-sync conflicts still never reach the server-side conflict table | R4 §3 (R3-19, restated as still open) | Fix 20 |
| 23 | Webhook signature check throws `RangeError` instead of a clean rejection | R4 §3 (R3-20, restated as still open), R5 (small items, same issue) | Fix 21 *(one issue, described in both reports — merged)* |
| 24 | `narrateDefaulterInsightAction` still hardcodes `brokenPromiseCount: 0` even though `getDefaulters`' own scoring now computes it for real | R4 §3 (R3-13, restated) | Fix 22 |
| 25 | `reconcileMissedUpiPayment` / `narrateAnomalyAction` / `answerHowDoIAction` reachability not confirmed | R4 §3 (flagged low-confidence) | Fix 23 — verification steps, not a code change |

**Duplicates merged, explicitly:** #18/#19 are the same function (`getDefaulters`) with two symptoms of the same missing-clamping root cause — one fix. #23 is the identical `timingSafeEqual` issue named in both reports — one fix. #5 restates R4's finding rather than adding new information — one fix, not two.

---

# TIER 0 — Read this before applying anything else

Round 5 surfaced something Round 4 didn't account for: **Fix 1 and Fix 2 below (closing the authorization gap) will break real payments if deployed alone**, because the Razorpay webhook has no user session and currently gets through only *because* the guard is broken. Fix 8 (the webhook's own authorization path) must ship in the **same change** as Fix 1/2, not after. I've ordered the fixes below so that doing them top-to-bottom is safe, but if you're cherry-picking, do not deploy Fix 1 or Fix 2 to production without also deploying Fix 8 and Fix 9.

---

## Fix 1 — Stop the auth guard from silently no-op'ing outside production

**File:** `apps/web/src/lib/require-session.ts`

**Current code:**
```ts
export async function requireAdminForSchool(schoolId: string): Promise<{ adminId: string; schoolId: string }> {
  const session = await auth();

  if (!session?.user) {
    if (process.env.NODE_ENV !== "production") {
      return { adminId: "seed-admin-01", schoolId: DEMO_SCHOOL_ID };
    }
    throw new UnauthorizedError("Authentication required.");
  }
  ...
```
```ts
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
  ...
```

**The problem:** `NODE_ENV !== "production"` is true for `next dev`, most CI runs, and most staging deployments unless someone deliberately sets `NODE_ENV=production` — so in practice, every environment except a real production build currently requires **no session at all** to call any guarded action.

**Replacement — require an explicit, separate opt-in instead of piggybacking on `NODE_ENV`:**
```ts
// Only true if someone has deliberately opted in to unauthenticated local testing —
// never true by default, and NEVER set this in any shared/staging/production environment.
const ALLOW_UNAUTHENTICATED_DEMO_ACTIONS =
  process.env.ALLOW_UNAUTHENTICATED_DEMO_ACTIONS === "true";

export async function requireAdminForSchool(schoolId: string): Promise<{ adminId: string; schoolId: string }> {
  const session = await auth();

  if (!session?.user) {
    if (ALLOW_UNAUTHENTICATED_DEMO_ACTIONS) {
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

export async function requireParentSession(): Promise<{ parentUserId: string; parentLinkId: string; schoolId: string }> {
  const session = await auth();

  if (!session?.user) {
    if (ALLOW_UNAUTHENTICATED_DEMO_ACTIONS) {
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
```

**Why this is safe:** the return shape and every downstream caller are unchanged — this only changes the condition under which the "no session" branch is taken. If you genuinely want the old convenient no-login local testing back, add `ALLOW_UNAUTHENTICATED_DEMO_ACTIONS=true` to your local `.env` — but now it's an explicit, visible, one-line decision instead of the accidental default, and it can never end up set in a shared environment by accident the way `NODE_ENV` frequently is.

---

## Fix 2 — Add the missing guard to the five ledger actions, and fix `resolveAnomaly`'s empty-string bug

**File:** `apps/web/src/app/actions/ledger.ts`

### 2a. `reverseTransaction`
**Current:**
```ts
export async function reverseTransaction(
  adminId: string,
  transactionId: string,
  reason: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new Error("Transaction not found");

    if (transaction.reconciliationStatus === "reversed") {
      throw new Error("Transaction is already reversed.");
    }

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        ...
```
**Replacement:**
```ts
export async function reverseTransaction(
  adminId: string,
  transactionId: string,
  reason: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new Error("Transaction not found");

    const { adminId: sessionAdminId } = await requireAdminForSchool(transaction.schoolId);

    if (transaction.reconciliationStatus === "reversed") {
      throw new Error("Transaction is already reversed.");
    }

    await tx.auditLog.create({
      data: {
        actorId: sessionAdminId,
        ...
```
(also change the `data: { reconciliationStatus: "reversed" }` update's implicit caller context — no other change needed; `sessionAdminId` replaces `adminId` only in the `actorId` field, closing the same audit-spoofing gap as Fix 11 for this function specifically.)

### 2b. `markChequeCleared` — needs an `adminId` parameter added (it currently has none, so clearances aren't attributable to anyone)
**Current:**
```ts
export async function markChequeCleared(
  transactionId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.reconciliationStatus !== "cheque_pending") {
      throw new Error(
        `Cannot clear: transaction status is '${transaction.reconciliationStatus}', expected 'cheque_pending'.`
      );
    }

    return tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "posted" },
    });
  });
  return serializeTransaction(result);
}
```
**Replacement:**
```ts
export async function markChequeCleared(
  transactionId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new Error("Transaction not found.");

    const { adminId } = await requireAdminForSchool(transaction.schoolId);

    if (transaction.reconciliationStatus !== "cheque_pending") {
      throw new Error(
        `Cannot clear: transaction status is '${transaction.reconciliationStatus}', expected 'cheque_pending'.`
      );
    }

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "cheque_cleared",
        beforeState: { status: "cheque_pending" },
        afterState: { status: "posted" },
      },
    });

    return tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "posted" },
    });
  });
  return serializeTransaction(result);
}
```
This adds an audit log entry that didn't exist before (every other status-changing function in this file writes one; this was the one exception) — purely additive, doesn't change the function's return value or existing callers' expectations. `TransactionActionsModal.tsx` doesn't need to change its call since `adminId` still isn't a parameter — it's derived from the session, exactly like the pattern already used in `updateStudentStatus`.

### 2c. `markChequeBounced` and `applyPenalty` and `applyWaiver`
Identical one-line pattern for all three — fetch the transaction first (already happens in all three), then add `await requireAdminForSchool(transaction.feeAssignment.student.schoolId)` (for `markChequeBounced`/`applyPenalty`, which already `include: { feeAssignment: { include: { student: true } } }`) or the equivalent already-available `schoolId` field for `applyWaiver`, right after the `if (!transaction) throw ...` check and before any further logic:

```diff
    if (!transaction) throw new Error("Transaction not found.");
+   await requireAdminForSchool(transaction.feeAssignment.student.schoolId);
    if (transaction.reconciliationStatus !== "cheque_pending") {
```
(applied identically to `markChequeBounced`, and to `applyPenalty` right after its own `if (!transaction) throw new Error("Transaction not found.");`)

For `applyWaiver`, check the exact field path in your copy against `feeAssignment.schoolId` vs `feeAssignment.student.schoolId` (both are populated in the schema; use whichever the function already has loaded to avoid an extra query) — the guard call itself is the same one line.

### 2d. `resolveAnomaly` — fix the empty-string bug
**Current:**
```ts
export async function resolveAnomaly(
  adminId: string,
  transactionId: string,
  resolution: "posted" | "reversed",
  notes?: string
) {
  const { adminId: sessionAdminId } = await requireAdminForSchool("");
  const effectiveAdmin = sessionAdminId || adminId;

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { anomalyFlags: true }
    });

    if (!transaction) throw new Error("Transaction not found.");
```
**Replacement — fetch the transaction's real school first, then check against it:**
```ts
export async function resolveAnomaly(
  adminId: string,
  transactionId: string,
  resolution: "posted" | "reversed",
  notes?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { anomalyFlags: true }
    });

    if (!transaction) throw new Error("Transaction not found.");

    const { adminId: sessionAdminId } = await requireAdminForSchool(transaction.schoolId);
    const effectiveAdmin = sessionAdminId;
```
(the rest of the function is unchanged — `effectiveAdmin` is still used exactly as before for `resolvedById`, it's just now derived from a real, school-scoped check instead of a check that always passed).

**Why 2a–2d are safe:** in every case, the guard is added using data the function already fetches for other reasons (the transaction row), so no new query is introduced except the two audit-log writes in 2b which are purely additive rows, not a change to any return value. No caller (`TransactionActionsModal.tsx`) needs to change, since none of these signatures change — `adminId` stays a parameter for backward compatibility even though the actual audit write now correctly prefers the session-verified value.

---

## Fix 3 — Extend the same guard pattern to `fees.ts`, `parents.ts`, `push.ts`, `reminders.ts`, `ai.ts`

Round 5 found the identical missing-guard problem spread across five more files. Same fix shape as Fix 2, applied per-file:

### 3a. `apps/web/src/app/actions/fees.ts`
```diff
+ import { requireAdminForSchool } from "@/lib/require-session";
  ...
  export async function createFeeType(schoolId: string, data: {...}) {
+   await requireAdminForSchool(schoolId);
    if (data.gstTreatment === "taxable" && ...) { ... }
```
```diff
  export async function updateFeeSchema(feeTypeId: string, changes: {...}) {
    const existing = await prisma.feeType.findUnique({ where: { id: feeTypeId } });
    if (!existing) throw new Error("FeeType not found");
+   await requireAdminForSchool(existing.schoolId);
    const newTreatment = changes.gstTreatment ?? existing.gstTreatment;
```
(this also closes the separately-noted gap that `updateFeeSchema` never checked the fee type belongs to the caller's school at all — the guard now does double duty as both an auth check and an ownership check, since `existing.schoolId` is the real owning school.)
```diff
  export async function assignFee(schoolId: string, studentIds: string | string[], feeTypeId: string, data: {...}) {
+   await requireAdminForSchool(schoolId);
    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
```

### 3b. `apps/web/src/app/actions/parents.ts` — this one needs the IDOR fix, not just a guard added alongside the existing parameter

The problem here is more specific than "add a check": these functions take `parentUserId` as a **trusted parameter**, so even a real, logged-in parent's session could be used to pass someone else's ID. The fix removes the parameter entirely and derives it from the session instead:

```diff
+ import { requireParentSession, requireAdminForSchool } from "@/lib/require-session";
  ...
- export async function addStudentToParent(parentUserId: string, studentId: string) {
+ export async function addStudentToParent(studentId: string) {
+   const { parentUserId } = await requireParentSession();
    ...
```
Apply the identical shape (delete the `parentUserId: string` parameter, add `const { parentUserId } = await requireParentSession();` as the first line of the body) to:
- `removeStudentFromParent(studentId)`
- `getMyChildren()`
- `getMyChildrenDues(studentId?)`
- `getMyPaymentHistory(...)` (keep its other existing parameters, drop only `parentUserId`)
- `generate80CTaxCertificateAction(...)` (same)

For `payDueViaUpi(feeAssignmentId, amount)` and `simulateSandboxPayment(feeAssignmentId, amount)`, which don't currently take `parentUserId` at all but should verify the calling parent actually owns the fee assignment being paid, add an ownership check instead of an identity swap:
```diff
  export async function payDueViaUpi(feeAssignmentId: string, amount: number) {
+   const { parentLinkId } = await requireParentSession();
    const assignment = await prisma.feeAssignment.findUnique({
      where: { id: feeAssignmentId },
-     include: { student: true },
+     include: { student: { include: { guardianOf: true } } },
    });
    if (!assignment) throw new Error("Fee assignment not found");
+   if (!assignment.student.guardianOf.some((g) => g.parentLinkId === parentLinkId)) {
+     throw new Error("You do not have access to this fee assignment.");
+   }
    ...
```
(the identical ownership-check addition applies to `simulateSandboxPayment` — see Fix 9 below, which folds this in alongside its production gate.)

**`createParentAccount`** is admin-facing (creates a new parent account, not something a parent calls about themselves) — this one needs `requireAdminForSchool(schoolId)`, the same as Fix 2/3a's pattern, not the parent-session swap:
```diff
  export async function createParentAccount(schoolId: string, data: {...}) {
+   await requireAdminForSchool(schoolId);
    ...
```

**Why removing the parameter (rather than just validating it) is the safer fix:** validating `parentUserId === session.parentUserId` and rejecting on mismatch would also work, but leaves the trust boundary sitting in a parameter that a future edit could accidentally start trusting again. Removing it entirely makes the mistake structurally impossible to reintroduce. Every current call site of these functions is inside `apps/web/src/app/parent/**` pages that already have the real logged-in parent's `useSession()` available and were only threading `parentUserId` through because the functions asked for it — so each call site just needs that one argument deleted from its call, which is a mechanical, low-risk edit (search each function name across the `parent/` page tree and delete the now-removed leading argument from each call).

### 3c. `apps/web/src/app/actions/push.ts`
Same IDOR shape as 3b:
```diff
- export async function subscribeToPush(userId: string, subscription: {...}) {
+ export async function subscribeToPush(subscription: {...}) {
+   const session = await auth();
+   const userId = session?.user?.id;
+   if (!userId) throw new Error("Authentication required.");
    ...
```
(Using `auth()` directly here rather than `requireAdminForSchool`/`requireParentSession` because this function is legitimately called by *either* role — an admin or a parent subscribing their own device — so it just needs "some authenticated user," not a specific role.) Apply the same shape to `unsubscribeFromPush`.

### 3d. `apps/web/src/app/actions/reminders.ts`
```diff
+ import { requireAdminForSchool } from "@/lib/require-session";
  ...
  export async function getRemindersQueue(schoolId: string, options?: {...}) {
+   await requireAdminForSchool(schoolId);
    const limit = options?.limit ?? 50;
    ...
```
```diff
  export async function markReminderSent(reminderLogId: string) {
    const log = await prisma.reminderLog.findUnique({
      where: { id: reminderLogId },
      include: { feeAssignment: { include: { student: {...} } } },
    });
    if (!log) throw new Error("Reminder log not found");
+   await requireAdminForSchool(log.feeAssignment.schoolId);
    if (log.status !== "logged") { ... }
```

### 3e. `apps/web/src/app/actions/ai.ts`
Every one of the 13 exported actions needs `requireAdminForSchool(schoolId)` (or `requireParentSession()` for the two parent-facing ones — `copilotQueryAction` when called with `role: "parent"`, and any other parent-context action) added as its first line, using whichever `schoolId`/role parameter it already receives. Additionally, delete the leftover placeholder:
```diff
- const MOCK_ADMIN_ID = "admin-123"; // In a real app, this would come from the auth session
- if (!rateLimit(`${MOCK_ADMIN_ID}:answerDashboardQuery`, ...)) { ... }
+ const { adminId } = await requireAdminForSchool(schoolId);
+ if (!rateLimit(`${adminId}:answerDashboardQuery`, ...)) { ... }
```
(applies to both occurrences — `answerDashboardQueryAction` and `processOcrUploadAction` — found at the two lines that still reference `MOCK_ADMIN_ID`).

**Why Fix 3 as a whole is safe:** every change is either (a) an additive guard call using data the function already has, or (b) a parameter removal whose call sites are a small, greppable, mechanical set of edits inside `apps/web/src/app/parent/**`. None of it changes what a *correctly-authenticated* user can already do — it only removes the ability for a request with no session, or a mismatched identity, to get through.

---

## Fix 4 — Gate the backdoor credentials for real, everywhere they appear

**File:** `apps/web/auth.ts`

```diff
+ const DEMO_LOGIN_ENABLED = process.env.NODE_ENV !== "production";
  ...
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) return null;

    if (
+     DEMO_LOGIN_ENABLED &&
      credentials.email === "admin@school.edu" &&
      credentials.password === "demo1234"
    ) {
      ...
```
Apply the same `DEMO_LOGIN_ENABLED &&` prefix to the parent-OTP bypass branch's condition.

**File:** `apps/web/src/app/admin/login/page.tsx`
```diff
+ const showDemoAids = process.env.NODE_ENV !== "production";
  ...
- setError("Invalid email or password. Use admin@school.edu / demo1234");
+ setError(showDemoAids ? "Invalid email or password. Use admin@school.edu / demo1234" : "Invalid email or password.");
```
```diff
- <button onClick={handleFillDemo}>
-   <Sparkles className="w-4 h-4" />
-   Auto-Fill Demo Admin Credentials
- </button>
+ {showDemoAids && (
+   <button onClick={handleFillDemo}>
+     <Sparkles className="w-4 h-4" />
+     Auto-Fill Demo Admin Credentials
+   </button>
+ )}
```

**Why safe:** identical to the earlier Round 2 fix pattern — pure conditional wrapping, unchanged behavior outside production, credentials stop working *and* stop being advertised specifically in the one environment where you don't want either.

---

## Fix 5 — Fix the "AI Draft Text" button's wrong call signature

**File:** `apps/web/src/app/admin/students/page.tsx`

**Current:**
```ts
const draft = await draftReminderTextAction(schoolId, studentId, "whatsapp");
```

**The real signature it needs to match** (`ai.ts`):
```ts
export async function draftReminderTextAction(
  schoolId: string,
  feeAssignmentId: string,
  tier: 1 | 7 | 14,
  channel: ReminderChannel
)
```

The button only has a `studentId` in scope, not a specific `feeAssignmentId`/tier — so the fix is to give the button the same server-side logic `queueRemindersForStudent` already uses correctly (pick the most overdue assignment, compute its real tier via `evaluateReminderTrigger`), wrapped in a small helper the button can call with just a student ID:

**New function, `apps/web/src/app/actions/ai.ts`:**
```ts
export async function draftReminderTextForStudentAction(
  schoolId: string,
  studentId: string,
  channel: ReminderChannel
): Promise<{ logId: string; draftedText: string } | null> {
  const { adminId } = await requireAdminForSchool(schoolId);

  const assignments = await prisma.feeAssignment.findMany({
    where: { studentId, schoolId },
    include: {
      transactions: { select: { amount: true, reconciliationStatus: true } },
      waivers: { select: { amount: true } },
      reminderLogs: { select: { tier: true } },
    },
  });

  let mostOverdue: { id: string; daysOverdue: number; highestTier: number } | null = null;
  for (const fa of assignments) {
    const paid = calculateAmountPaid(fa.transactions);
    const waived = calculateWaivedAmount(fa.waivers);
    const remaining = calculateRemainingBalance(fa.amount.toNumber(), paid, waived);
    if (remaining <= 0) continue;
    const daysOverdue = Math.max(0, Math.floor((Date.now() - fa.dueDate.getTime()) / 86400000));
    const highestTier = fa.reminderLogs.reduce((max, log) => Math.max(max, log.tier), 0);
    if (!mostOverdue || daysOverdue > mostOverdue.daysOverdue) {
      mostOverdue = { id: fa.id, daysOverdue, highestTier };
    }
  }

  if (!mostOverdue) return null; // nothing overdue for this student

  const trigger = evaluateReminderTrigger(mostOverdue.daysOverdue, mostOverdue.highestTier);
  const tierDays = (trigger.newTier === 1 ? 1 : trigger.newTier === 2 ? 7 : 14) as 1 | 7 | 14;

  return draftReminderTextAction(schoolId, mostOverdue.id, tierDays, channel);
}
```
(This reuses `evaluateReminderTrigger`, `calculateAmountPaid`, `calculateWaivedAmount`, `calculateRemainingBalance` — all already imported into `ai.ts` or trivially importable from `@smart-school/rules` alongside the existing imports.)

**File:** `apps/web/src/app/admin/students/page.tsx`
```diff
- import { narrateDefaulterInsightAction, draftReminderTextAction } from "@/app/actions/ai";
+ import { narrateDefaulterInsightAction, draftReminderTextForStudentAction } from "@/app/actions/ai";
  ...
- const draft = await draftReminderTextAction(schoolId, studentId, "whatsapp");
+ const draft = await draftReminderTextForStudentAction(schoolId, studentId, "whatsapp");
+ if (!draft) {
+   toast.error("This student has no overdue balance to draft a reminder for.");
+   return;
+ }
```

**Why this is safe:** `draftReminderTextAction` itself is untouched — `queueRemindersForStudent`'s existing, working call to it is unaffected. This adds one new wrapper function and fixes exactly one caller's arguments; no other code references `draftReminderTextAction` directly with the wrong shape.

---

## Fix 6 — Remove (or wire up for real) the fabricated defaulter heatmap

**File:** `apps/web/src/app/admin/students/page.tsx`

The four "Grade N Cohort" cards under "AI Risk Distribution" are static JSX text unconnected to `data` (the real defaulters array). Two options, pick one:

**Option A — remove until it's real** (lowest-risk, recommended first step):
```diff
- <div className="p-3 bg-[#F4F1EA] rounded-xl border border-[#0F5A47]/15 space-y-1">
-   <span className="text-[10px] font-bold text-[#475569] block">Grade 9 Cohort</span>
-   <p className="text-lg font-extrabold text-[#059669]">1 Defaulter</p>
-   ...
- </div>
  (... delete all four hardcoded cards ...)
```

**Option B — compute it for real** from the same `data` the rest of the tab already renders:
```tsx
const gradeBreakdown = useMemo(() => {
  const byGrade: Record<string, { count: number; totalStudents: number }> = {};
  for (const d of data ?? []) {
    const grade = d.className ?? "Unknown"; // adjust to the real field name on the defaulter row
    byGrade[grade] = byGrade[grade] ?? { count: 0, totalStudents: 0 };
    byGrade[grade].count += 1;
  }
  return byGrade;
}, [data]);
```
```tsx
{Object.entries(gradeBreakdown).map(([grade, stats]) => (
  <div key={grade} className="p-3 bg-[#F4F1EA] rounded-xl border border-[#0F5A47]/15 space-y-1">
    <span className="text-[10px] font-bold text-[#475569] block">{grade}</span>
    <p className="text-lg font-extrabold text-[#059669]">{stats.count} Defaulter{stats.count === 1 ? "" : "s"}</p>
  </div>
))}
```
(Note: this only has grade information for students who are *already* defaulters, since `data` is the defaulters list, not the full roster — an "% On-Time Pay" figure would need the full student roster per grade as a denominator, which isn't in scope here without an additional query. Option A avoids overclaiming what the data can support; Option B is a reasonable first real version but should honestly drop the "% On-Time Pay" line unless you add the roster query to back it.)

**Why this matters as a "fix," not just polish:** an admin using this number to decide where to focus collections effort is being actively misled by Option A's absence being replaced with invented specificity — removing it is strictly better than leaving it, even before Option B is built.

---

## Fix 7 — Restore a reachable path to the reminders review/mark-sent workflow

**File:** `apps/web/src/app/admin/layout.tsx`

The simplest fix: add Reminders back to the nav.
```diff
  <NavItem href="/admin/dashboard" icon={LayoutDashboard} onClick={closeMenu}>Executive Dashboard</NavItem>
  <NavItem href="/admin/ledger" icon={BookOpen} onClick={closeMenu}>Finance Operations</NavItem>
  <NavItem href="/admin/students" icon={Users} onClick={closeMenu}>Students & Families</NavItem>
+ <NavItem href="/admin/reminders" icon={Bell} onClick={closeMenu}>Reminders Queue</NavItem>
```
(`/admin/reminders/page.tsx` still exists on disk and was fully working before the nav redesign — this is a one-line re-link, not a rebuild. If the intent is genuinely to fold everything into 3 workspaces long-term, the alternative is to add a "Reminders" tab inside the Students & Families workspace, next to the existing Students/Defaulters tabs, and move `/admin/reminders/page.tsx`'s JSX in as a third tab — a slightly bigger but more consistent change. Either is acceptable; leaving it unreachable is not.)

While re-linking it, also delete or re-link the other four orphaned routes deliberately rather than leaving them to silently rot: `/admin/parents` (superseded by the inline Add Parent flow in Students — safe to delete), `/admin/receipts` (check whether its functionality is fully duplicated in the new Ledger/Finance Operations tabs before deleting), `/admin/reports` (same check), `/admin/settings` (still has the unfixed invisible-text dark-mode bug from Round 1 — safe to delete unless you plan to re-link and fix it).

---

## TIER 0 fixes, now in order — webhook authorization and sandbox gating

## Fix 8 — Give the webhook a real, non-session authorization path

**Files:** `apps/web/src/app/actions/ledger.ts`, `apps/web/src/app/api/webhooks/razorpay/route.ts`

**The problem:** after Fix 1/2, `recordPayment`'s `requireAdminForSchool(schoolId)` call will correctly throw for the webhook's server-to-server request, since it has no user session — breaking every real UPI payment in production.

**Fix — split `recordPayment` into a public, session-checked entry point and an internal, unguarded implementation; give the webhook route a distinct, signature-verified entry point into the same internal logic:**

```ts
// ledger.ts

// Internal implementation — no session check. Only call this from a caller
// that has already established trust some other way (a verified admin
// session, via recordPayment below, OR a verified Razorpay webhook
// signature, via recordPaymentFromWebhook below).
async function recordPaymentInternal(
  actorId: string,
  schoolId: string,
  data: { feeAssignmentId: string; channel: PaymentChannel; amount: number; refNumber?: string }
) {
  if (data.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  const result = await prisma.$transaction(async (tx) => {
    // ... existing recordPayment transaction body, unchanged, using `actorId`
    // wherever the old code used `adminId` for audit/actor attribution ...
  });
  return result;
}

// Public entry point for admin-initiated payments (manual cash/cheque entry,
// the Record Payment modal, OCR-confirm, etc.) — requires a real admin session.
export async function recordPayment(
  adminId: string,
  schoolId: string,
  data: { feeAssignmentId: string; channel: PaymentChannel; amount: number; refNumber?: string }
) {
  const { adminId: sessionAdminId } = await requireAdminForSchool(schoolId);
  return recordPaymentInternal(sessionAdminId, schoolId, data);
}

// Entry point for the Razorpay webhook — authorized by the caller having
// already verified the Razorpay HMAC signature (see route.ts), NOT by a user
// session, since none exists for a server-to-server webhook call.
export async function recordPaymentFromWebhook(
  schoolId: string,
  data: { feeAssignmentId: string; channel: PaymentChannel; amount: number; refNumber?: string }
) {
  return recordPaymentInternal("razorpay-webhook-system", schoolId, data);
}
```

**File:** `apps/web/src/app/api/webhooks/razorpay/route.ts`
```diff
- await recordPayment(WEBHOOK_ADMIN_ID, WEBHOOK_SCHOOL_ID, { ... });
+ await recordPaymentFromWebhook(WEBHOOK_SCHOOL_ID, { ... });
```
(The route's existing HMAC signature verification, which happens earlier in the same handler, is the actual authorization check for this path — `recordPaymentFromWebhook` is only safe to expose because it's never reachable except from this one file, which gates it behind that signature check. Do not export `recordPaymentInternal` from the module, and do not call `recordPaymentFromWebhook` from anywhere else — it has no auth of its own by design.)

**Why this is safe and necessary:** this is a pure refactor of `recordPayment`'s internals into a shared private function with two typed, purpose-specific public wrappers — the actual payment logic (row locking, anomaly detection, status transitions) doesn't change at all, so every existing test/behavior for admin-initiated payments is unaffected. It specifically and only adds the missing capability: a legitimate way for the webhook to post a payment without a user session, without reopening the general "any unauthenticated caller can post a payment" hole Fix 1 just closed.

---

## Fix 9 — Gate `simulateSandboxPayment` and verify ownership

**File:** `apps/web/src/app/actions/parents.ts`

```diff
+ import { requireParentSession } from "@/lib/require-session";
  ...
  export async function simulateSandboxPayment(feeAssignmentId: string, amount: number) {
+   if (process.env.NODE_ENV === "production") {
+     throw new Error("Sandbox payments are disabled in production.");
+   }
+   const { parentLinkId } = await requireParentSession();
    const assignment = await prisma.feeAssignment.findUnique({
      where: { id: feeAssignmentId },
-     include: { student: true },
+     include: { student: { include: { guardianOf: true } } },
    });

    if (!assignment) {
      throw new Error("Fee assignment not found");
    }
+   if (!assignment.student.guardianOf.some((g) => g.parentLinkId === parentLinkId)) {
+     throw new Error("You do not have access to this fee assignment.");
+   }

    const schoolId = assignment.student.schoolId;
    const adminId = "sandbox-parent-simulation";
    const refNumber = "sim_" + Math.random().toString(36).substring(2, 10);

    return recordPayment(adminId, schoolId, { feeAssignmentId, channel: "upi", amount, refNumber });
  }
```
Wait — after Fix 8, `recordPayment` now requires an *admin* session, and this function is called by a *parent*. Since this is a parent-initiated sandbox action, route it through the internal function directly rather than through the admin-only `recordPayment`:
```diff
- return recordPayment(adminId, schoolId, { feeAssignmentId, channel: "upi", amount, refNumber });
+ return recordPaymentInternal("sandbox-parent-simulation", schoolId, { feeAssignmentId, channel: "upi", amount, refNumber });
```
(This requires exporting `recordPaymentInternal` from `ledger.ts` for this one trusted, already-gated caller — or, cleaner, add a third small wrapper in `ledger.ts` alongside `recordPaymentFromWebhook`, e.g. `recordPaymentFromSandbox(schoolId, data)`, so `recordPaymentInternal` itself never needs to leave the module. I'd recommend the wrapper approach for consistency with Fix 8.)

**Why this is safe:** the production gate is unconditional and can't be bypassed by any request shape; the ownership check reuses the exact same `guardianOf` relation pattern already used correctly elsewhere in this file (e.g. Fix 3b's `payDueViaUpi`); routing through a dedicated wrapper instead of the admin-gated `recordPayment` avoids a confusing situation where a parent's sandbox action would otherwise need to pass as an admin.

---

## Fix 10 — Fix the Tally XML export scope bug

**File:** `apps/web/src/app/actions/reports.ts`

**Current structure (confirmed exact line numbers):**
```
line 67:   export async function generateReconciliationReport(...) { ...
line 148:    async function getValidAdminActorId(actorId?: string): Promise<string> { ... }   // nested inside the function above
line 157:    const validActorId = await getValidAdminActorId(adminId);   // fine, same scope
             ... (rest of generateReconciliationReport, closes its brace)
line 174:  export async function exportTallyXmlReport(...) { ...
line 262:    const validActorId = await getValidAdminActorId(adminId);   // OUT OF SCOPE — will not compile / ReferenceError
```

**Fix — move the function to module scope, once, above both callers:**
```diff
  "use server";
  import { ... } from "...";

+ async function getValidAdminActorId(actorId?: string): Promise<string> {
+   // ... exact existing body, unchanged ...
+ }
+
  export async function generateReconciliationReport(...) {
    ...
-   async function getValidAdminActorId(actorId?: string): Promise<string> {
-     // ... same body ...
-   }
-
    const validActorId = await getValidAdminActorId(adminId);
    ...
  }

  export async function exportTallyXmlReport(...) {
    ...
    const validActorId = await getValidAdminActorId(adminId);  // now resolves correctly
    ...
  }
```

**Why this is safe:** `getValidAdminActorId` has no closure dependency on anything inside `generateReconciliationReport` (it only uses its own `actorId` parameter) — confirmed by reading its body, which only touches `prisma` and its own argument. Moving it to module scope changes nothing about what it does, only where it can be called from.

---

## Fix 11 — Use the session-verified admin ID for real, everywhere it's computed and discarded

**File:** `apps/web/src/app/actions/ledger.ts`, inside `recordPayment` (now, post-Fix-8, this lives in `recordPaymentInternal`'s caller wiring)

This is naturally resolved by Fix 8's refactor — `recordPaymentInternal(actorId, ...)` takes the already-verified `sessionAdminId` from `recordPayment`'s wrapper as its `actorId`, and that's what flows into every `tx.transaction.create`/`tx.auditLog.create` call inside the transaction body, replacing every previous reference to the raw, client-supplied `adminId`. If you're applying Fix 11 independently of Fix 8 (not recommended, but possible), the minimal version is:
```diff
  const { adminId: sessionAdminId } = await requireAdminForSchool(schoolId);
- const effectiveAdminId = sessionAdminId || adminId;
+ const effectiveAdminId = sessionAdminId; // sessionAdminId is always populated once requireAdminForSchool succeeds
  ...
  // then, everywhere inside the transaction body that currently writes `adminId` to a DB field:
- actorId: adminId,
+ actorId: effectiveAdminId,
```
Apply the same "use the verified value, not the raw parameter" correction to `apps/web/src/app/actions/offlineSync.ts`'s `resolveSyncConflict`, which has the identical pattern (`resolvedById: adminId` should be `resolvedById: sessionAdminId`).

---

## Fix 12 — Delete the dead, duplicate webhook handler

**File:** `apps/web/src/app/actions/payments.ts`

`handleRazorpayWebhook` (confirmed never called from anywhere except a comment referencing it) should be deleted outright:
```diff
- export async function handleRazorpayWebhook(...) {
-   // ... entire function body ...
- }
```
If any part of its logic differs meaningfully from the real, live implementation in `apps/web/src/app/api/webhooks/razorpay/route.ts`, review that diff before deleting — but do not keep both. **Why safe:** confirmed zero callers exist; deleting unused, non-exported-elsewhere code cannot break anything that currently runs.

---

## Fix 13 — Prevent receipt-number collisions

**File:** `packages/db/prisma/schema.prisma`, `Receipt` model, plus a new migration; `apps/web/src/app/actions/receipts.ts`

**Schema change** — denormalize `schoolId` onto `Receipt` so a real per-school unique constraint is possible:
```diff
  model Receipt {
    id             String   @id @default(uuid())
    transactionId  String   @unique @map("transaction_id")
+   schoolId       String   @map("school_id")
    receiptNumber  String   @map("receipt_number")
    ...
+   @@unique([schoolId, receiptNumber])
  }
```
**File:** `receipts.ts`, when creating the receipt row, pass `schoolId: transaction.schoolId` alongside the existing fields (the transaction is already fetched with its `schoolId` available at that point in the function).

**Migration** (new file under `packages/db/prisma/migrations/`):
```sql
ALTER TABLE "receipts" ADD COLUMN "school_id" TEXT;
UPDATE "receipts" r SET "school_id" = t.school_id FROM "transactions" t WHERE r.transaction_id = t.id;
ALTER TABLE "receipts" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id");
CREATE UNIQUE INDEX "receipts_school_id_receipt_number_key" ON "receipts"("school_id", "receipt_number");
```
**Why this is safe:** the backfill (`UPDATE ... FROM`) populates the new column for every existing row before the `NOT NULL` constraint is added, so this won't fail against existing data. The application-level receipt-number generation logic (the `count`-based scheme) is unchanged — this migration adds a real backstop that turns a silent collision into a loud, catchable constraint-violation error, which is the same "make the DB the source of truth, not just the app" pattern already recommended for the R3-1 indexes (Fix 19 below). If you want to eliminate the race rather than just detect it, that requires the sequence-based approach noted in the original Round 5 write-up — this migration alone converts a silent bug into a loud one, which is the safe minimum fix; the sequence-based elimination is a further improvement you can layer on top later without needing to redo this migration.

---

## Fix 14 — Round money before comparing it for equality in anomaly detection

**File:** `packages/rules/src/anomaly.ts`

**Current:**
```ts
if (numReceived !== expectedAmount) {
  // ... flag as anomaly ...
}
```
**Replacement:**
```ts
const round2 = (n: number) => Math.round(n * 100) / 100;

if (round2(numReceived) !== round2(expectedAmount)) {
  // ... flag as anomaly ...
}
```
**Why this is safe:** rounding both sides to the nearest paisa before comparing only changes behavior for the specific case this was buggy for — two values that are mathematically equal but differ by a floating-point epsilon (e.g. `.0000000001`). Any genuinely different amount (a real discrepancy, even a 1-paisa one) still fails the equality check and is still correctly flagged, since a real 1-paisa difference survives rounding to 2 decimals.

---

## Fix 15 — Batch `bulkImportStudents`'s insert loop

**File:** `apps/web/src/app/actions/students.ts`

The duplicate-check half of this was already fixed (confirmed: batched into one `findMany`). The insert loop still calls `prisma.student.create` once per row. Batch the actual inserts using chunked `Promise.all` calls (preserves per-row success/failure reporting, unlike a single `createMany`, at the cost of needing explicit chunk sizing):

```diff
  for (const row of studentsData) {
    try {
      if (!row.name || !row.class) {
        failed.push({ row, reason: "Name and class are required." });
        continue;
      }
      if (row.admissionNumber) {
        const existing = existingByAdmissionNumber.get(row.admissionNumber);
        if (existing) { skipped.push(existing); continue; }
      }
-     const created = await prisma.student.create({ data: {...} });
-     succeeded.push(created);
+     validRows.push(row); // collect instead of inserting immediately
    } catch (error: any) {
      failed.push({ row, reason: error.message || "Unknown error" });
    }
  }
+
+ const CHUNK_SIZE = 25;
+ for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
+   const chunk = validRows.slice(i, i + CHUNK_SIZE);
+   const results = await Promise.allSettled(
+     chunk.map((row) =>
+       prisma.student.create({
+         data: { name: row.name, class: row.class, schoolId, admissionNumber: row.admissionNumber || null, status: "active" },
+       })
+     )
+   );
+   results.forEach((result, idx) => {
+     if (result.status === "fulfilled") succeeded.push(result.value);
+     else failed.push({ row: chunk[idx], reason: result.reason?.message || "Unknown error" });
+   });
+ }
```
(`validRows` needs to be declared as `const validRows: typeof studentsData = [];` before the first loop.)

**Why this is safe:** this reduces round-trips from N sequential awaits to `N/25` parallel-batches-of-25, while keeping the exact same per-row success/failure granularity the function's return shape (`{ succeeded, failed, skipped }`) already promises — no caller needs to change. `Promise.allSettled` (not `Promise.all`) is used specifically so one row's DB error inside a chunk doesn't abort its sibling rows in the same chunk, preserving the existing "one bad row doesn't abort the batch" behavior.

---

## Fix 16 — Move the rate limiter off in-memory storage before relying on it in a real deployment

**File:** `apps/web/src/lib/rateLimit.ts`

This is a larger infrastructure change than the others (it requires provisioning a shared store), so given the scope of this document I'm giving the concrete direction rather than a full inline implementation: swap the `Map`-backed store for `@upstash/ratelimit` + `@upstash/redis` (or your platform's equivalent shared KV), keeping the exported function's signature (`rateLimit(key, { limit, windowMs })`) identical so every one of its ~10 existing call sites across the action files needs zero changes. This is safe to defer relative to the Tier 0/1 fixes above — it doesn't cause incorrect behavior, only weaker-than-intended protection under real concurrent/multi-instance load.

---

## Fix 17 — `getDefaulters`: fix the masking bug and the N+1 write pattern together

**File:** `apps/web/src/app/actions/defaulters.ts`

Both issues live in the same function and are fixed together:

```diff
  export async function getDefaulters(schoolId: string) {
    await requireAdminForSchool(schoolId);

    const students = await prisma.student.findMany({ ... });

    const scoresToUpsert = [];
+   const studentIds = students.map((s) => s.id);
+   const todayStart = new Date();
+   todayStart.setHours(0, 0, 0, 0);
+   const existingScoresToday = await prisma.defaulterScore.findMany({
+     where: { studentId: { in: studentIds }, schoolId, computedAt: { gte: todayStart } },
+     orderBy: { computedAt: "desc" },
+   });
+   const existingByStudent = new Map<string, (typeof existingScoresToday)[number]>();
+   for (const s of existingScoresToday) {
+     if (!existingByStudent.has(s.studentId)) existingByStudent.set(s.studentId, s); // first hit = most recent, due to orderBy desc
+   }
+   const toCreate: any[] = [];
+   const toUpdate: { id: string; riskLevel: number; computedReason: string }[] = [];

    for (const student of students) {
      let totalAmount = 0;
      let totalPaid = 0;
      let totalWaived = 0;
+     let totalRemainingClamped = 0;
      let maxDaysOverdue = 0;
      let brokenPromiseCount = 0;

      for (const a of student.feeAssignments) {
        totalAmount += a.amount.toNumber();
        const pd = calculateAmountPaid(a.transactions);
        totalPaid += pd;
        const wv = calculateWaivedAmount(a.waivers);
        totalWaived += wv;
        const bal = calculateRemainingBalance(a.amount.toNumber(), pd, wv);
+       totalRemainingClamped += bal; // already clamped to >= 0 by calculateRemainingBalance
        if (bal > 0) {
          const days = Math.max(0, Math.floor((Date.now() - a.dueDate.getTime()) / 86400000));
          if (days > 0 && a.reminderLogs) brokenPromiseCount += a.reminderLogs.length;
          if (days > maxDaysOverdue) maxDaysOverdue = days;
        }
      }

      const score = computeDefaulterScore(maxDaysOverdue, brokenPromiseCount, totalAmount, totalPaid, totalWaived);
      const riskLevelInt = score.riskLevel === "high" ? 3 : score.riskLevel === "medium" ? 2 : 1;
-     const remainingBalance = totalAmount - totalPaid - totalWaived;
+     const remainingBalance = totalRemainingClamped;

      if (remainingBalance > 0) {
        scoresToUpsert.push({ studentId: student.id, schoolId, riskLevel: riskLevelInt, computedReason: score.reason, remainingBalance, maxDaysOverdue, studentName: student.name, admissionNumber: student.admissionNumber });

-       const todayStart = new Date();
-       todayStart.setHours(0, 0, 0, 0);
-       const existingToday = await prisma.defaulterScore.findFirst({ where: { studentId: student.id, schoolId, computedAt: { gte: todayStart } }, orderBy: { computedAt: "desc" } });
-       if (existingToday) {
-         await prisma.defaulterScore.update({ where: { id: existingToday.id }, data: { riskLevel: riskLevelInt, computedReason: score.reason } });
-       } else {
-         await prisma.defaulterScore.create({ data: { studentId: student.id, schoolId, riskLevel: riskLevelInt, computedReason: score.reason } });
-       }
+       const existingToday = existingByStudent.get(student.id);
+       if (existingToday) {
+         toUpdate.push({ id: existingToday.id, riskLevel: riskLevelInt, computedReason: score.reason });
+       } else {
+         toCreate.push({ studentId: student.id, schoolId, riskLevel: riskLevelInt, computedReason: score.reason });
+       }
      }
    }

+   await prisma.$transaction([
+     ...(toCreate.length ? [prisma.defaulterScore.createMany({ data: toCreate })] : []),
+     ...toUpdate.map((u) => prisma.defaulterScore.update({ where: { id: u.id }, data: { riskLevel: u.riskLevel, computedReason: u.computedReason } })),
+   ]);

    scoresToUpsert.sort((a, b) => (a.riskLevel !== b.riskLevel ? b.riskLevel - a.riskLevel : b.maxDaysOverdue - a.maxDaysOverdue));
    return scoresToUpsert;
  }
```

**Why this is safe:** the masking-bug fix (`totalRemainingClamped` instead of the raw subtraction) only changes the result for the specific edge case where a per-assignment balance would otherwise go negative (over-waiver/overpayment) — for every normal case where no assignment is over-waived, `totalRemainingClamped` and the old raw sum are numerically identical, since `Math.max(0, x)` only differs from `x` when `x < 0`. The N+1 fix changes *how many queries* run (one `findMany` + one batched transaction instead of up to 2×N queries) without changing *what* gets written — same `riskLevel`/`computedReason` values land in the same rows, just via batched operations instead of a sequential loop. `scoresToUpsert` (the actual return value the Defaulters UI renders) is populated identically to before.

---

## Fix 18 — Seed a real system user for the webhook's actor ID

**File:** `packages/db/prisma/seed.ts`

```diff
  const school = await prisma.school.upsert({ where: { id: schoolId }, ... });
+
+ await prisma.user.upsert({
+   where: { id: "razorpay-webhook-system" },
+   update: {},
+   create: {
+     id: "razorpay-webhook-system",
+     role: "admin",
+     email: "system+razorpay@internal.finora",
+     schoolId: school.id,
+   },
+ });
```
**Why this is safe:** purely additive — a new seeded row that nothing currently depends on for its *absence*. It only matters once/if a future `AuditLog` write for webhook payments enforces a real FK to `User.id`, at which point this row already existing prevents that from breaking.

---

## Fix 19 — Add the two documented DB constraints that were never actually created

**New migration**, `packages/db/prisma/migrations/<timestamp>_add_missing_constraints/migration.sql`:
```sql
-- Idempotency backstop for UPI payments — the schema comment has claimed
-- this exists since the initial migration; it never did.
CREATE UNIQUE INDEX "transactions_upi_ref_number_key"
  ON "transactions" ("ref_number") WHERE "channel" = 'upi';

-- Prevents duplicate admission numbers within a school.
CREATE UNIQUE INDEX "students_school_admission_number_key"
  ON "students" ("school_id", "admission_number") WHERE "admission_number" IS NOT NULL;

-- Prevents zero/negative transaction amounts at the DB level, not just in application code.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive_check" CHECK ("amount" > 0);
```
**File:** `apps/web/src/app/actions/ledger.ts`'s `recordPaymentInternal` (post-Fix-8) and `apps/web/src/app/actions/students.ts`'s `createStudent`/`bulkImportStudents` — wrap the insert in a `try/catch` that recognizes Prisma's `P2002` (unique constraint) error code and converts it into the same friendly message the existing application-layer check already produces, so a real (rare) race that reaches this constraint fails cleanly instead of surfacing a raw Postgres error to the UI:
```ts
try {
  // ... existing create call ...
} catch (err: any) {
  if (err.code === "P2002") {
    throw new Error("A transaction with this reference number already exists.");
    // (or the admission-number equivalent message, depending on which function this is in)
  }
  throw err;
}
```
**Why this is safe:** this only adds a new failure mode for cases that were already meant to be impossible (duplicate ref numbers, duplicate admission numbers, non-positive amounts) — any request that was already valid under the existing application-layer checks continues to succeed identically; only a genuine race condition or a bypass of the application check now gets caught, where before it would have silently corrupted data.

---

## Fix 20 — Make offline-sync conflicts actually reach the server-side conflict table

**File:** wherever `handleSyncNow` lives in the current Ledger/Finance Operations workspace (folded in from the old `admin/offline-sync/page.tsx`)

```diff
  if (res.success) {
    await removeEntry(entry.local_id);
  } else {
-   await updateEntryStatus(entry.local_id, "conflict");
+   await updateEntryStatus(entry.local_id, "conflict");
+   await reportSyncConflict(
+     entry.local_id,
+     schoolId,
+     entry.feeAssignmentId,
+     entry.channel,
+     entry.amount,
+     entry.queued_at,
+     adminId,
+     res.conflictReason
+   );
  }
```
(match the exact parameter order/names to `reportSyncConflict`'s real signature in `offlineSync.ts` — confirmed to exist and take exactly this shape from earlier verification.)

**Why this is safe:** this only adds a call that writes a new row to the school-wide `OfflineSyncConflict` table — it doesn't change the existing local-device behavior (`updateEntryStatus` still runs exactly as before), so nothing about the current single-device experience regresses; it only additionally makes the conflict visible to other admins, which is the documented intent this code's own comments describe.

---

## Fix 21 — Fix the webhook signature check's `RangeError`

**File:** `packages/payments/src/razorpay.ts`

```diff
  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

+ if (signature.length !== expectedSignature.length) {
+   throw new Error("Razorpay webhook signature verification failed.");
+ }
  if (!crypto.timingSafeEqual(Buffer.from(signature, "utf-8"), Buffer.from(expectedSignature, "utf-8"))) {
    throw new Error("Razorpay webhook signature verification failed.");
  }
```
**Why this is safe:** the outer route handler already catches any thrown error and returns 400 either way, so behavior for a genuinely malformed/missing signature is unchanged from the outside — this only changes *which* error type is thrown internally (a clear, intended `Error` instead of a cryptic `RangeError`), making logs and any future caller of this function get the documented behavior its own comment already promised.

---

## Fix 22 — Make `narrateDefaulterInsightAction` use the real broken-promise count

**File:** `apps/web/src/app/actions/ai.ts`

```diff
  return narrateDefaulterInsight({
    studentName: student.name,
    riskLevel: riskLevelMap[latestScore.riskLevel] ?? "low",
    computedReason: latestScore.computedReason,
    totalFees,
    totalPaid,
    remainingBalance: totalFees - totalPaid - totalWaived,
    maxDaysOverdue,
-   brokenPromiseCount: 0, // TODO Session 5: join REMINDER_LOG for broken_promise_count
+   brokenPromiseCount,
  });
```
This requires computing `brokenPromiseCount` in this function the same way `getDefaulters` now does — sum `reminderLogs.length` across the student's overdue (`bal > 0`) assignments. If the function doesn't already fetch `reminderLogs` on each assignment, add it to the existing `include`:
```diff
  const assignments = await prisma.feeAssignment.findMany({
    where: { studentId, schoolId },
-   include: { transactions: {...}, waivers: {...} },
+   include: { transactions: {...}, waivers: {...}, reminderLogs: { select: { id: true } } },
  });
  ...
+ let brokenPromiseCount = 0;
  for (const a of assignments) {
    ...
+   if (bal > 0) brokenPromiseCount += a.reminderLogs.length;
  }
```
Also apply the same real-value fix to `remainingBalance: totalFees - totalPaid - totalWaived` in this same function — it has the identical unclamped-sum pattern as Fix 17; change it to accumulate `Math.max(0, ...)` per assignment the same way.

**Why this is safe:** this only changes the *input* the AI narration prompt receives — the underlying `narrateDefaulterInsight` function and its Gemini call are untouched. The AI-generated text will now correctly be able to mention broken-promise history when relevant, instead of being told it's always zero.

---

## Fix 23 — Verify (don't yet assume) reachability of the remaining low-confidence items

Round 4 flagged `reconcileMissedUpiPayment`, `narrateAnomalyAction`, and `answerHowDoIAction` as "not verified reachable this round" rather than confirmed broken or confirmed fine. Before writing code for these, run:
```bash
grep -rn "reconcileMissedUpiPayment" apps/web/src --include="*.tsx"
grep -rn "narrateAnomalyAction" apps/web/src --include="*.tsx"
grep -rn "answerHowDoIAction" apps/web/src --include="*.tsx"
```
If any come back empty (no `.tsx` caller), they belong in Round 4/5's "orphaned function" category and need the same treatment as the reminder-tier/AI-insight functions already wired this round — either give them a real button (following the pattern in Fix 5/6) or explicitly decide to remove them. I'm not guessing at which outcome applies without running this check against your current tree, since it's a two-second grep rather than something worth speculating about.

---

## Post-Fix Verification Checklist

Run these, in order, after applying the fixes above:

1. `npx tsc --noEmit` in `apps/web` — catches any type mismatch introduced by a signature change (especially Fix 3b's parameter removals — every call site needs its argument list updated to match).
2. `npx prisma migrate dev` (or your deploy equivalent) — applies Fix 13 and Fix 19's new migrations against a real database; watch for the backfill step in Fix 13 failing if any `Receipt` row somehow has no matching `Transaction` (shouldn't be possible given the `@unique` FK, but worth confirming on your actual data before running in production).
3. `npx prisma db seed` — applies Fix 18.
4. Manual QA, per fix:
   - Log out entirely, open devtools, attempt to call `reverseTransaction`/`applyWaiver`/`createFeeType`/`getMyChildren` etc. directly — confirm each now rejects with `UnauthorizedError` instead of succeeding (Fix 1/2/3).
   - Trigger a real (or sandboxed) Razorpay webhook call end-to-end — confirm it posts successfully (Fix 8) and that a duplicate delivery is still correctly idempotent (unchanged behavior, just re-confirm).
   - Click "AI Draft Text" on a defaulter with a real overdue balance — confirm it drafts text instead of failing (Fix 5).
   - Open the Defaulters tab — confirm the "Grade-Wise" card either no longer appears or reflects real numbers (Fix 6).
   - Confirm Reminders is reachable from the nav and "Mark as Sent" still correctly surfaces `dispatchError` (Fix 7, re-confirming the Round 2 fix is reachable again).
   - Click "Export" → "Tally XML" — confirm it downloads instead of throwing (Fix 10).
   - Force a duplicate receipt-generation race (e.g. double-click quickly) — confirm it now fails cleanly instead of silently duplicating (Fix 13).
   - Run the offline-sync "Sync Now" flow with a deliberately conflicting entry — confirm it now appears in the school-wide conflicts list (Fix 20).