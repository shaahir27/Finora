---
feature: "PWA & Push Notifications"
session: "Session 3"
status: "Built"
---

# Feature: PWA & Push Notifications

## 1. Overview
* **Name:** PWA & Push Notifications
* **Session:** Session 3 — Dashboard / Defaulter Scoring, PWA + Admin Push
* **Purpose:** Enable Progressive Web App capabilities for background sync and real-time push notifications for critical events (e.g., payments received, anomalies flagged).
* **Traces to:** `system_architecture.md` (PWA layer) and `product_requirements.md` (M-5).

## 2. Technical Rationale
* **How we achieved it:** Integrated `next-pwa` and authored a dedicated Service Worker (`public/sw.js`). Created UI components (`PushSettingsToggle`) to request browser push permissions and store `PUSH_SUBSCRIPTION` records. Wired `recordPayment` to asynchronously trigger `notifySchoolAdmins` on success or anomaly.
* **Alternatives considered:** Third-party managed services like Firebase Cloud Messaging for web.
* **Why we chose this path:** Native Web Push API directly satisfies the offline and delivery specs without introducing an external dependency layer purely for web delivery, keeping the footprint light.

## 3. Database Schema Impact
* **Changes made:** none (using existing `PUSH_SUBSCRIPTION` table from initial design).

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `notifySchoolAdmins` (`apps/web/src/app/actions/push.ts`): Queries active push subscriptions for admins at a given school and delegates to `sendPushNotification`.
  ```typescript
  // export async function notifySchoolAdmins(schoolId: string, payload: any)
  ```
  * `Service Worker` (`apps/web/public/sw.js`): Listens for `push` events and displays notifications. Listens for `sync` events to fire offline payment sync queues.
  ```javascript
  // self.addEventListener('push', ...)
  // self.addEventListener('sync', ...)
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session3.test.ts` — verified non-blocking guarantee: simulating a push send failure asserts that the triggering write (`recordPayment`) successfully commits and returns without failing.
* **Manually verified:** Service worker installs and registers in browser correctly.

## 6. Dependencies & Deferred Work
* **Depends on:** VAPID keys setup in `.env`.
* **Known issues/deferred:** Push Notification logic requires actual VAPID key injection to test end-to-end delivery in production. Currently logs to console if keys are missing.
