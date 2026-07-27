# Finora — Round 7: Additional Findings (Deep Line-by-Line Sweep)

**Scope:** everything not yet covered by Rounds 2–6. I focused on the parts of the codebase that had never been individually audited before — the three brand-new features (WhatsApp reminders, Dynamic UPI QR codes, the audio Soundbox), `offlineSync.ts` end-to-end, and a broad sweep for the same *class* of bug that's bitten this app before (a hardcoded demo value quietly shipping inside a real feature) — plus one concrete, real-world confirmation of a bug Round 6 already flagged as theoretical.

**Headline:** the new WhatsApp reminder button is broken for every single reminder in the queue — it sends every message to the same hardcoded fake phone number, not the real parent's number. And the new Dynamic UPI QR code feature, if it ever gets wired to a page (it currently isn't), would let parents pay real money in a way that **completely bypasses the entire ledger system** — no webhook, no reconciliation, nothing recorded, ever. Also: I found the exact place where Round 6's "audit trail is spoofable" finding stops being theoretical — I can show you the literal string `"demo-admin"` that will show up as the actor on every waiver, penalty, and bounced cheque, today, in the current code.

---

## 🔴 Critical

### NEW7-1 — The WhatsApp reminder button always messages the same fake number, for every student

**File:** `apps/web/src/app/admin/reminders/page.tsx`, line 244

```tsx
<a
  href={buildWhatsAppPaymentUrl({
    phone: "+919876543210",
    studentName: r.studentName,
    studentClass: "Student",
    amountRupees: r.remainingBalance,
    feeAssignmentId: r.feeAssignmentId,
  })}
```

Every reminder row in the queue — regardless of which student, which parent, which phone number is actually on file — generates a WhatsApp link to the identical hardcoded number `+919876543210`, with the student's class replaced by the literal word `"Student"`. Clicking "WhatsApp" on any two different reminders opens a chat with the exact same (fake) contact both times.

**Root cause, not just a wiring miss:** I checked `getRemindersQueue`'s Prisma query — it never selects the guardian's phone number at all (only `student`, `feeType`, `transactions`, `waivers`). The frontend has no real phone number available to plug in even if someone wanted to fix just the JSX.

**Fix:**
1. In `getRemindersQueue` (`apps/web/src/app/actions/reminders.ts`), extend the `student` include to reach the guardian's phone: `student: { include: { guardianOf: { include: { parentLink: { include: { user: { select: { phone: true } } } } } } } }`, and add the resolved phone (and real class, if available on `Student`) to the mapped return object.
2. In the reminders page, use that real value: `phone: r.guardianPhone ?? "", studentClass: r.studentClassName ?? r.studentName`.
3. If `r.guardianPhone` is empty (no phone on file — the same gap already handled correctly for the email channel via `dispatchError: "no_email_on_file"`), disable the WhatsApp button for that row with a tooltip, rather than generating a link to nothing.

### NEW7-2 — The Dynamic UPI QR feature, if ever wired up, bypasses the entire ledger

**File:** `apps/web/src/lib/upiQr.ts`

```ts
export function buildDynamicUpiUri(params: DynamicUpiParams): string {
  const vpa = params.schoolVpa || DEFAULT_VPA; // "demoschool@icici"
  ...
  return `upi://pay?pa=${vpa}&pn=${name}&tr=${ref}&am=${amount}&cu=INR&tn=${note}`;
}
```

This builds a raw NPCI UPI intent link (`upi://pay?...`) — the kind any UPI app (GPay, PhonePe, Paytm) opens as a **direct bank-to-bank transfer**, initiated entirely outside Razorpay. The file's own comment claims *"payments are 100% auto-reconciled on webhook arrival — 0 manual matching"* — that's not how this actually works: a raw UPI intent link has no relationship to Razorpay at all, so **no webhook will ever fire** for a payment made this way. The money would leave the parent's account and land in the school's real bank account, but Finora's database would never learn the payment happened — the fee would stay marked unpaid indefinitely, and the school's own bank statement would be the only record of it.

There's a second problem layered on top: `DEFAULT_VPA = "demoschool@icici"` is a hardcoded fallback. If any caller ever invokes this without explicitly passing the school's real VPA, parents would be shown a QR code for a completely unrelated bank account.

**Current status:** I confirmed via a full-repo search that `buildDynamicUpiUri`/`getUpiQrImageUrl` are **not called from anywhere** yet — this is currently dead code, not an active bug. But it's clearly built and ready to be wired into a "Show Payment QR" button, and if that happens as-is, it would silently create a new, invisible-to-the-ledger payment channel.

**Fix, before this is ever wired to a UI:** either (a) don't use a raw UPI intent link at all — use Razorpay's own UPI Collect/QR APIs so a real webhook still fires when the payment completes, or (b) if a direct-VPA QR code is genuinely wanted for some reason (e.g., avoiding Razorpay's fee on small transactions), it needs its own reconciliation mechanism — e.g., a scheduled bank-statement import, or requiring the parent to also log the payment reference back into the app — and the UI showing it needs to make unmistakably clear that a payment made this way is **not** automatically tracked. Don't let the default-VPA fallback exist at all; make `schoolVpa` a required parameter with no fallback, so a missing VPA is a build-time/type error, not a silent wrong-account QR code.

### NEW7-3 — Confirmed: right now, the audit trail literally records `"demo-admin"` as the actor for every waiver, penalty, and bounced cheque

Round 6 flagged that `applyPenalty`, `markChequeBounced`, and `applyWaiver` compute `effectiveAdminId = adminId || sessionAdminId`, which always resolves to the raw client-supplied value. I traced where that client value actually comes from:

```ts
// apps/web/src/app/admin/ledger/page.tsx, line 38
const adminId = "demo-admin";
```
which is passed straight into `TransactionActionsModal`, which passes it straight into `reverseTransaction`, `markChequeBounced`, `applyPenalty`, `applyWaiver`, and `resolveAnomaly`.

**This means, today, regardless of who is actually logged in:** every cheque bounce, every penalty, and every waiver recorded through the Ledger page's action modal writes the literal string `"demo-admin"` into the audit log as the actor — not the real admin's session ID. This isn't a hypothetical spoofing risk anymore; it's the guaranteed, current behavior. (`reverseTransaction` and `resolveAnomaly` are fine — I re-confirmed both correctly use the session-derived value, not this literal.)

**Fix:** exactly the one already specified in the Round 4+5 document's Fix 11 (`effectiveAdminId = sessionAdminId`, dropping the `|| adminId` fallback, in all three functions) — this finding doesn't change the fix, it just confirms the fix is more urgent than "theoretical" framing might have suggested, since it's visibly wrong in the audit log right now for anyone who looks.

---

## 🟡 Medium

### NEW7-4 — `syncOfflinePayment` calls the authorization guard and then ignores its result

**File:** `apps/web/src/app/actions/offlineSync.ts`

```ts
await requireAdminForSchool(schoolId);

try {
  const result = await recordPayment(adminId, schoolId, { ... });
```

The guard is called, but its return value is discarded — `recordPayment` (which internally calls the same guard again and correctly derives the real admin for its own audit write) is the one that actually matters for security here, so this isn't unsafe. It is, however, a redundant round-trip through `auth()` on every offline sync call, and it's slightly confusing to read — it looks like it's meant to do something with the result and doesn't. **Fix:** either remove this outer call entirely (since `recordPayment` already re-checks), or, if the intent was to fail fast before doing any other work in this function, keep it but note in a comment that it's intentionally a fail-fast pre-check and the real enforcement happens inside `recordPayment`.

### NEW7-5 — Fire-and-forget push notifications risk being dropped in a serverless deployment

**File:** `apps/web/src/app/actions/offlineSync.ts` (and the same pattern elsewhere, e.g. `ledger.ts`'s `notifySchoolAdmins` calls)

```ts
notifySchoolAdmins(schoolId, { title: "Sync Conflict", ... }).catch(console.error);
return { id: conflict.id };
```
The promise is deliberately not awaited (the comment explains this is intentional, to avoid blocking the response on push delivery) — but on a serverless platform (Vercel, per the project's own README), the execution environment can be frozen or torn down as soon as the function returns its response, which can happen *before* the un-awaited `notifySchoolAdmins` promise finishes its own async work (a DB query for the admin list, then the push send itself). This isn't necessarily wrong on every platform, but it's a real risk specifically on the one this project targets. **Fix:** either await it (accepting the extra latency, since it's a background-priority-request anyway on a resolution/conflict path where speed isn't critical), or, if you want to keep it non-blocking, use `waitUntil()` (available on Vercel/Next.js's `after()` API in recent versions) so the platform knows to keep the function alive until the promise settles instead of guessing.

### NEW7-6 — `reportSyncConflict`'s failure is silently swallowed with no admin-facing feedback

**File:** `apps/web/src/app/admin/ledger/page.tsx`, line 200
```ts
await reportSyncConflict(...).catch(console.error); // non-blocking — local status already updated
```
If this call genuinely fails (not just "conflict reported successfully" but an actual error — a DB hiccup, a bad `localId`), the admin sees no indication anything went wrong; the local device still shows "conflict" and the admin has no way to know the school-wide table never got the entry. Low-severity since the local status is still accurate for the device that made the call, but it means the specific bug Fix 20 was designed to prevent (other admins not being able to see a conflict) can still happen on the rare occasion this specific call itself errors out. **Fix:** on catch, still show a toast (`toast.error("Reported locally, but couldn't notify other admins — please retry Sync Now.")`) rather than a console-only log.

---

## What I checked and found genuinely fine

`soundbox.ts`/`SoundboxToggle.tsx` — reviewed fully; correctly guards for `typeof window === "undefined"` and `"speechSynthesis" in window`, confirmed it's wired to real payment-recording flows (parent pay page, ledger page, `TransactionActionsModal`), not decorative/orphaned. `resolveSyncConflict`'s reason validation and `getSyncConflicts`'s query are both correct, matching the documented design. `RecordPaymentModal.tsx` matches the originally-proposed design with no new issues — the `adminId` prop it receives is a benign unused legacy parameter now that `recordPayment` derives the real actor from the session internally. `reportSyncConflict`'s actual parameter order in the real function differs from what I'd guessed in the earlier solutions document, but the real caller matches the real function correctly — no bug, just a note that my earlier draft's exact param order shouldn't be taken as gospel over the actual source.

---

## Priority order for this round's findings

1. **NEW7-3** — apply the already-specified Fix 11 (it's a 3-line change, and now confirmed visibly wrong in production data, not just a theoretical audit gap).
2. **NEW7-1** — fix the WhatsApp phone number before anyone relies on this button for a real reminder; right now it does nothing useful and could confuse an admin into thinking a reminder was sent.
3. **NEW7-2** — don't wire up the UPI QR feature as-is; fix the reconciliation gap first, since this is the kind of bug that's invisible until real money has already gone missing from the ledger.
4. NEW7-4/5/6 are all minor — worth cleaning up, none are urgent.