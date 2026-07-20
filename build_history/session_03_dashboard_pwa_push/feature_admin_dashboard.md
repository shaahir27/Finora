---
feature: "Admin Dashboard & Management Shell"
session: "Session 3"
status: "Built"
---

# Feature: Admin Dashboard & Management Shell

## 1. Overview
* **Name:** Admin Dashboard & Management Shell
* **Session:** Session 3 — Dashboard / Defaulter Scoring, PWA + Admin Push
* **Purpose:** Implement the admin overview dashboard with real-time financial metrics and the overarching app navigation shell.
* **Traces to:** `product_requirements.md` (M-4, M-5, M-6).

## 2. Technical Rationale
* **How we achieved it:** Created shared Glassmorphism UI components in `apps/web/src/components` (e.g., `GlassCard`, `MetricCard`, `FiveStateRenderer`). Built the main App Shell layout (`AdminLayout`) and connected the dashboard screen to `getLedgerSnapshot` for metric aggregation. Real-time updates are handled via Supabase `postgres_changes`.
* **Alternatives considered:** Real-time polling via setInterval.
* **Why we chose this path:** Supabase Realtime provides cleaner push-based updates without taxing the server. The layout wrapper naturally manages session state while isolating screen boundaries.

## 3. Database Schema Impact
* **Changes made:** none

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `getLedgerSnapshot` (`apps/web/src/app/actions/ledger.ts`): Aggregates daily/weekly/monthly payments, waivers, and total expected using raw Prisma queries.
  ```typescript
  // export async function getLedgerSnapshot(schoolId: string, range: 'today' | 'week' | 'month' = 'month')
  ```
  * `AdminLayout` (`apps/web/src/app/admin/layout.tsx`): The overarching layout providing sidebar navigation for the entire admin portal.
  ```typescript
  // export default function AdminLayout({ children }: { children: ReactNode })
  ```
  * `DashboardPage` (`apps/web/src/app/admin/dashboard/page.tsx`): The main dashboard view incorporating financial metrics.
  ```typescript
  // export default function DashboardPage()
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session3.test.ts` — verified five-state rendering behaviors (distinct states for syncing, offline conflict, etc.).
* **Manually verified:** Verified Tailwind glassmorphism design tokens load correctly in Next.js pages, and Tanstack query bindings properly fetch from `getLedgerSnapshot`.

## 6. Dependencies & Deferred Work
* **Depends on:** Ledger engine (Session 1 & 2), Supabase Realtime.
* **Known issues/deferred:** none
