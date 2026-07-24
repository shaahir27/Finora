# Feature: Parent Push Notifications

## 1. Overview
* **Name:** Parent Push Notifications
* **Session:** Session 5 — Parent Portal
* **Purpose:** (1) When a payment is `posted` for a student, their linked parents receive a push notification via the existing `PUSH_SUBSCRIPTION` mechanism. (2) Parents can subscribe/unsubscribe via a toggle in `/parent/settings`.
* **Traces to:** `docs/api_specification.md` — subscribeToPush, unsubscribeFromPush contracts; `database_design.md` — PUSH_SUBSCRIPTION table note that it "works for both roles."

## 2. Technical Rationale
* **How we achieved it:** Extended `recordPayment` in `ledger.ts` — after a `posted` status is confirmed, a non-blocking `.then()` chain queries `GUARDIAN_OF` for the student's linked parents and calls `sendPushNotification` for each parent's `userId`. Uses the same `push.ts` `sendPushNotification` function already serving admin notifications — no new code path, just an additional caller. The parent settings page uses the standard Web Push API (`pushManager.subscribe`) and calls `subscribeToPush`/`unsubscribeFromPush` server actions (the same ones used for admin subscriptions).
* **Alternatives considered:** Dedicated `notifyParents` function. Rejected — the existing `sendPushNotification(userId, payload)` is already the correct abstraction.
* **Why we chose this path:** Reusing the existing push infrastructure keeps the codebase DRY and avoids duplicating VAPID key configuration.

## 3. Database Schema Impact
* **Changes made:** None — PUSH_SUBSCRIPTION table already supports both roles. No migration needed.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * Modified `recordPayment` (`apps/web/src/app/actions/ledger.ts`): After posted-status confirmation, queries `prisma.guardianOf` and fires `sendPushNotification` for each linked parent.
  * `ParentSettingsPage` (`apps/web/src/app/parent/settings/page.tsx`): UI toggle calling `subscribeToPush`/`unsubscribeFromPush` with the parent's `userId`.
  ```typescript
  // In recordPayment, after notifySchoolAdmins:
  prisma.guardianOf.findMany({ where: { studentId }, include: { parentLink: true } })
    .then((guardians) => guardians.forEach((g) =>
      sendPushNotification(g.parentLink.userId, { title: "Payment Confirmed", ... })
    ));
  ```

## 5. Testing & Verification
* **Automated tests:** Covered implicitly by the `recordPayment` mock in session3/session4 tests. No dedicated push test (requires a real service worker environment).
* **Manually verified:** Settings page toggle renders; VAPID key absence warning displays correctly in environments without keys.

## 6. Dependencies & Deferred Work
* **Depends on:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env vars; service worker registration (`/sw.js`) from Session 3.
* **Known issues/deferred:** Service worker `/sw.js` must already be registered for push to work — this was built in Session 3. Parent settings page does not expose a "device label" input (deferred UX improvement).
