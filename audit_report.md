# Finora — Senior Engineering Code Audit

**Scope:** Full monorepo (`apps/web` Next.js app, `packages/rules`, `packages/db`, `packages/ai`, `packages/payments`)
**Method:** Manual read-through of every route, server action, and shared component; static grep sweeps for hardcoded colors, dead handlers, TODOs, and unsafe patterns; cross-referencing UI buttons against their backing server actions.

**Bottom line:** The core financial engine (`packages/rules`, `ledger.ts`) is genuinely well-built — the balance math, state machine, and cheque bounce/reversal logic are correct and match the documented business rules. The problems are concentrated in three places: (1) the UI layer has several buttons and flows that look finished but are disconnected from the backend, (2) there is no real server-side authorization anywhere, and (3) the "color palette" is actually three different palettes fighting each other.

---

## 1. Critical Issues (fix before any demo/production use)

### 1.1 The parent payment flow never actually records a payment
**File:** `apps/web/src/app/parent/pay/page.tsx` — `handleSimulatePayment`

After a parent "pays," the UI calls `payDueViaUpi` (which only creates a Razorpay **order**, correctly), then the "Simulate Sandbox Success" button does this:

```ts
const handleSimulatePayment = async () => {
  setLoading(true);
  setTimeout(() => {
    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push("/parent/dues"), 3000);
  }, 1500);
};
```

It never calls the server, never hits `recordPayment`, and never touches the `/api/webhooks/razorpay` route that was actually built correctly for this exact purpose. The parent sees a "Payment Successful" screen and gets redirected to Dues — where the balance is **unchanged**, because no `TRANSACTION` row was ever created. This is the single most visible bug in the app: the entire payment-completion promise is fake.

**Fix:** either have the button POST a synthetic signed payload to `/api/webhooks/razorpay` (so the real idempotent path is exercised), or call `recordPayment` directly for the sandbox case.

### 1.2 Every page shows an infinite spinner on a real fetch error — never an error message
**File:** `apps/web/src/lib/useDataState.ts`

```ts
if (query.status === "error") {
  if (query.data !== undefined) {
    return { state: "stale", data: query.data as T };
  }
  return { state: "loading" };   // <-- a hard failure is mapped to "loading"
}
```

The `DataState` type has five variants (`idle | loading | synced | stale | conflict`) and **none of them is "error."** If a query fails and there's no cached data to fall back to, the user is shown "Loading…" forever (`FiveStateRenderer.tsx` only special-cases `idle`/`loading`, `stale`, and `conflict`). Since essentially every page in both the admin and parent app (`dashboard`, `defaulters`, `students`, `ledger`, `dues`, `history`, `reminders`, …) is built on `useDataState` + `FiveStateRenderer`, this is a systemic bug: a dropped connection, a bad `schoolId`, or a 500 anywhere renders as a spinner that never resolves, with no retry affordance and no way for the user to know something is wrong.

**Fix:** add a real `{ state: "error"; error: Error }` variant and render it distinctly in `FiveStateRenderer`.

### 1.3 No server-side authorization on any server action
Every server action (`getStudents`, `getDefaulters`, `recordPayment`, `generateReceipt`, `applyWaiver`, …) takes `schoolId`/`adminId` as plain function arguments supplied by the client — there is no session check inside the action itself. Confirmed there is **no `middleware.ts`** anywhere in the app, and:

- `schoolId = "demo-school-id"` is hardcoded client-side in `app/admin/students/page.tsx`, `app/admin/defaulters/page.tsx`, `app/admin/dashboard/DashboardClient.tsx`, `app/admin/offline-sync/page.tsx`.
- `adminId = "admin-123"` is hardcoded in `app/admin/settings/page.tsx` and used as the audit-log actor in several places.

Anyone who can call these Next.js server actions directly (trivial via browser devtools) can pass an arbitrary `schoolId` and read or mutate another school's financial ledger, since nothing in `ledger.ts`/`students.ts`/`defaulters.ts` re-derives `schoolId` from an authenticated session. This is fine for a single-tenant demo but is a real multi-tenant data isolation hole.

### 1.4 Login/auth guard is entirely client-side and trivially bypassable
**Files:** `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/parent/layout.tsx`

```ts
const authed = sessionStorage.getItem(SESSION_KEY) === "1";
if (!authed) router.replace("/admin/login");
```

Both portals gate access purely by checking a `sessionStorage` flag inside a `"use client"` layout `useEffect`. Opening devtools and running `sessionStorage.setItem("finora_admin_authed","1")` grants full UI access without ever authenticating (combined with 1.3, this also grants full data access, since the underlying actions don't check anything either).

---

## 2. High-Priority Bugs (broken or misleading features)

### 2.1 Dead / unwired buttons
| Button | Location | Problem |
|---|---|---|
| **Download Receipt** | `app/parent/history/page.tsx:130` | No `onClick` at all. The exact same feature is correctly wired on the admin side (`app/admin/receipts/page.tsx` calls `generateReceipt`), but the parent-facing button was never connected. |
| **Edit Profile** | `app/admin/students/[id]/StudentProfileClient.tsx:73` | `<QuickActionButton label="Edit Profile" />` — no `onClick`. There is also no `editStudent`/`updateStudentProfile` server action anywhere in the codebase to wire it to. |
| **Add Student** | `app/admin/students/page.tsx:37` | `onClick={() => router.push("/admin/students?action=new")}`. Nothing on the page reads `?action=new` (no `useSearchParams`, no modal). Clicking it just reloads the same list with no visible effect. |
| **Import CSV** | `app/admin/students/page.tsx:36` | Redirects to `/admin/settings`, which only contains a push-notification toggle — no CSV import UI or logic exists anywhere in the repo. |

### 2.2 "Mark as Sent" lies about delivery status
**Files:** `app/actions/reminders.ts` (`markReminderSent`) + `app/admin/reminders/page.tsx` (`handleMarkSent`)

For an email reminder where the guardian has no email on file, the server action correctly leaves the DB status as `"logged"` and stores `dispatchError: "no_email_on_file"` — but it returns `void`, so the caller has no way to see that. The page then **unconditionally** does an optimistic update:

```ts
await markReminderSent(id);
setReminders(prev => prev?.map(r => r.id === id ? { ...r, status: "simulated_sent", ... } : r));
```

The admin sees a green "Sent" badge even though nothing was sent — directly undermining the app's stated "Governing Principle 3: no reminder is ever delivered without an explicit, logged action" by making a silent no-op look like a success.

**Fix:** have `markReminderSent` return `{ status, dispatchError? }` and branch the UI on it.

### 2.3 CSV export produces a malformed file
**File:** `app/admin/dashboard/DashboardClient.tsx:58`

```ts
const csvData = [...].map(e => e.join(",")).join("\\n");
```

That is a literal two-character string `\` + `n` (verified byte-for-byte), not a real newline. The exported `dashboard_export_*.csv` will have all rows concatenated onto a single line with the literal text `\n` between them instead of actual line breaks — most spreadsheet tools will not parse it as multiple rows.

**Fix:** `.join("\n")`.

### 2.4 "Download Report" and receipt PDFs point to a URL that doesn't exist
**Files:** `app/actions/reports.ts`, `app/actions/receipts.ts`

```ts
const url = `https://storage.dummy.com/reports/${fileName}`;   // reports.ts
const pdfUrl = `https://storage.dummy.com/receipts/${receiptNumber}.pdf`; // receipts.ts
```

Both are explicitly stubbed (the comments say so), but the **UI treats them as real**: `app/admin/reports/page.tsx` renders `result.url` as a clickable `<a href=... target="_blank">Download Report</a>`, and `app/admin/receipts/page.tsx` shows the dummy `pdfUrl` in a success `alert()`. Clicking "Download Report" will hit a domain that resolves to nothing. This isn't a UI wiring bug so much as a backend feature that was never finished but is presented to the user as complete.

### 2.5 Inconsistent duplicate-payment scoping
**File:** `app/actions/ledger.ts`, `recordPayment`

The UPI idempotency check queries **globally**, with no `schoolId` filter:
```ts
const existingUpi = await tx.transaction.findFirst({ where: { channel: "upi", refNumber: data.refNumber } });
```
while the general duplicate-ref check (`detectDuplicateRef`) is scoped to `existingTransactions` fetched only for the current `feeAssignmentId`. The two anti-duplicate mechanisms use different scopes for what is conceptually the same protection, and the UPI path could in principle return a transaction belonging to a different school/fee assignment if a ref number ever collided (unlikely for real UPI RRNs, but a real inconsistency worth tightening, especially combined with 1.3's lack of school scoping elsewhere).

### 2.6 Defaulter risk score is computed with a hardcoded input
**Files:** `app/actions/defaulters.ts:49`, `app/actions/ai.ts:105`

```ts
// TODO: broken_promise_count requires REMINDER_LOG join. Hardcoded to 0 for this session.
```
`computeDefaulterScore` is a correct pure function, but one of its three weighted inputs (`brokenPromiseCount`) is permanently `0` in production code, not just a test stub. Every student's risk score is therefore silently missing the "broken promises" component the formula was designed to include — high-risk students who have ignored multiple reminders will not be ranked any higher for that reason.

### 2.7 Guardian "name" is actually the guardian's email address
**File:** `app/actions/ai.ts:233`, `packages/db/prisma/schema.prisma`

```ts
guardianName: guardian?.email ?? undefined,
```
The `User` model has no `name` field at all (only `email`/`phone`), so AI-drafted reminder texts that greet the guardian by name will actually show their email address (e.g. "Dear priya.sharma@gmail.com,"). Worth adding a `name` column to `User`/`ParentLink` rather than papering over it in the AI action.

---

## 3. Design System / Color Palette Audit

You specifically asked whether the color palette is used consistently — **it is not.** There are effectively three competing palettes in the codebase:

### 3.1 The "real" palette (defined correctly)
`globals.css` defines CSS variables (`--color-bg-base`, `--color-accent-primary`, `--color-risk-high`, etc.) and `tailwind.config.ts` maps them to token classes: `bg-base`, `bg-surface`, `accent-primary`, `accent-primary-text`, `accent-emerald`, `accent-gold`, `risk-high/medium/low`, `status-posted/cheque-pending/flagged/reversed`. Most of `apps/admin/dashboard`, `defaulters`, `offline-sync`, and `parent/pay` correctly use these tokens.

### 3.2 A second, undefined palette used on the landing page — renders with **no color at all**
`app/page.tsx`, `components/PushSettingsToggle.tsx`, and `app/parent/copilot/page.tsx` use `accent-teal`, `accent-core`, and `accent-secondary` extensively:
```tsx
className="bg-gradient-to-r from-accent-teal to-accent-core ..."
className="... focus:ring-accent-core"
```
**None of these three tokens exist in `tailwind.config.ts`.** Tailwind's JIT compiler will not generate CSS for a class it doesn't recognize as a valid color scale, so every gradient, button fill, spotlight glow, and logo badge that references `accent-teal`/`accent-core`/`accent-secondary` will render with **no background color** — this affects the hero CTA button, the logo mark, the "AI chat" demo bubble, and the push-notification toggle's "on" state on the landing page and settings.

### 3.3 A third, fully hardcoded "phantom" palette that doesn't match the design system's actual colors
`components/CopilotWidget.tsx`, `app/admin/reminders/page.tsx`, `app/admin/login/page.tsx`, `app/admin/ocr/page.tsx`, and `app/admin/layout.tsx` (nav highlight) all hardcode a **different green/amber/red** than the one defined in `globals.css`:

| Used (hardcoded) | Actual design-system token | 
|---|---|
| `#4CAF82` / `#2D6A4F` (green) | `--color-accent-emerald: #6BBF82` |
| `#FFC864` / `#E09040` (amber) | `--color-status-cheque-pending: #F2C94C` |
| `#E06060` / `#A6432D`-adjacent (red) | `--color-risk-high: #A6432D` |

These aren't just "hardcoded instead of tokenized" — they're a **visibly different color** from the one the rest of the app uses for the same semantic meaning (success/pending/danger), so the Reminders queue, OCR upload, admin login, and the AI Copilot widget will look like they belong to a different app skin than the Dashboard/Defaulters/Ledger screens sitting right next to them in the same nav.

### 3.4 `darkMode: 'class'` is configured but never activated — invisible text bug
`tailwind.config.ts` sets `darkMode: 'class'`. `dark:` variants are used in exactly 3 files (`app/admin/settings/page.tsx`, `components/PushSettingsToggle.tsx`, `components/IosBanner.tsx`), but **nothing in the entire codebase ever adds a `dark` class to `<html>` or `<body>`** — no `ThemeProvider`, no `next-themes`, no manual `classList.add`. Since the app is dark-themed by default (`--color-bg-base: #0A0C0F`) but the `dark` class never activates, the "light mode" Tailwind classes are what actually render:
```tsx
<h1 className="text-2xl font-bold text-gray-900 dark:text-white ...">
```
`text-gray-900` (near-black) on a near-black `#0A0C0F` background is effectively invisible. The entire Settings page header and the Push Notifications card text are unreadable in the shipped build.

### 3.5 Scattered raw Tailwind defaults bypassing tokens entirely
Beyond the above, plain default Tailwind colors (never part of the design system) show up in several places and should be swapped for the equivalent token: `bg-gray-500` / `bg-gray-600` (student status badges), `text-red-400` (landing page mock chat), `bg-red-500`/`text-red-500` (reports page error banner — should be `risk-high`), `bg-yellow-900`/`text-yellow-200`/`border-yellow-700` (stale-data banner in `FiveStateRenderer`).

**Recommendation:** add `accent-teal`, `accent-core`, and `accent-secondary` to `tailwind.config.ts` (or replace their usages with existing tokens), delete the phantom `#4CAF82` palette in favor of the real `accent-emerald`/`status-*` tokens, either wire up a real dark-mode provider or strip all `dark:` classes, and replace the handful of raw `gray-`/`red-`/`yellow-` Tailwind defaults with their token equivalents.

---

## 4. Minor / Cosmetic Issues

- **Dead footer links** — `app/page.tsx:375-377`: Privacy / Terms / Security all use `href="#"`.
- **Decorative but non-functional button on the landing page** — the "Send Payment Reminders" button inside the fake AI-chat demo (`app/page.tsx:333`) has no handler. Low priority since it's part of a scripted marketing animation, but it visually invites a click that does nothing.
- **Redundant inline styles** — `app/admin/ocr/page.tsx` and `app/admin/reminders/page.tsx` set `style={{ fontFamily: "'Inter', sans-serif" }}` even though `Inter` is already the global font loaded via `next/font` in `app/layout.tsx`. Harmless but unnecessary.
- **Type-unsafe raw SQL row shape** — `ledger.ts`'s `recordPayment` types the raw `$queryRaw` result as `{ amount: number }`, but Postgres/node-postgres actually returns `NUMERIC` columns as strings. It happens to work because every consumer wraps the value in `Number(...)`, but the TypeScript type is lying about the runtime shape and would silently break if a future consumer used it without coercion.

---

## 5. What's Actually Solid

Worth calling out explicitly since it's easy for an audit to read as all-negative: `packages/rules` (`feeComputation.ts`, `defaulterScore.ts`, `reminderTrigger.ts`, `duplicateRef.ts`, `anomaly.ts`) is clean, well-documented, and correctly implements the documented business rules — including the subtle "expected amount must exclude the current transaction" anomaly trap and the correct cheque `cheque_pending → posted/reversed` state machine. The admin-side OCR flow, offline-sync queue, and reconciliation dashboard are all fully and correctly wired end-to-end. The gap is specifically in the parent-facing payment completion, error/loading states, auth, and the color system — all fixable without touching the financial engine.

---

## Priority Fix Order

1. Wire the sandbox payment button to a real backend call (1.1) — otherwise the core product promise doesn't work.
2. Add a real error state to `useDataState`/`FiveStateRenderer` (1.2) — affects every screen.
3. Add real session-derived authorization to server actions, or at minimum a `middleware.ts` (1.3/1.4).
4. Fix the "Mark as Sent" false-success and the CSV newline bug (2.2, 2.3) — quick, high-visibility fixes.
5. Wire or remove the dead buttons (2.1).
6. Consolidate the three color palettes into one (3.1–3.5).