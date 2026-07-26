# Feature Log: Admin Dashboard Mobile Ergonomics & Ngrok Tunnel Sign-Out Fix

## 1. Overview
* **Name:** Admin Dashboard Mobile Ergonomics & Ngrok Tunnel Sign-Out Fix
* **Session:** Session 6 — Polish, Auditing & Demo
* **Purpose:** Overhaul the Admin Dashboard mobile UI (Ask AI search bar, Copilot icon sizing, Reports Drawer mobile bottom sheet) and fix NextAuth client sign-out URL resolution to preserve ngrok tunnel domains instead of forcing a redirect to `http://localhost:3000`.
* **Traces to:** `docs/product_requirements.md` & `ui_ux_specification.md` Mobile Ergonomics & Authentication Strategy.

## 2. Technical Rationale
* **How we achieved it:**
  1. Fixed invalid Tailwind CSS class `w-13 h-13` in `CopilotWidget.tsx` by replacing it with valid `w-14 h-14 sm:w-16 sm:h-16 min-w-[56px] min-h-[56px]` touch targets, ensuring the floating Copilot trigger renders as a prominent, high-clarity 56px action button on mobile screens.
  2. Upgraded AI Query Bar in `DashboardClient.tsx` to use responsive flex layout (`flex-col sm:flex-row gap-2.5`), 16px base font size on mobile (`text-base sm:text-sm`) to prevent iOS Safari focus auto-zoom, and 44px+ minimum height submit button.
  3. Added `.mobile-bottom-sheet` presentation to the Reports Generator overlay in `DashboardClient.tsx` for phone viewports (< 640px).
  4. Resolved the ngrok tunnel sign-out bug by adding a custom `redirect` callback in `apps/web/auth.ts` that preserves relative URLs (`/admin/login`, `/parent/login`) and current origin. Updated `signOut` handlers in `AdminLayout` (`apps/web/src/app/admin/layout.tsx`) and `ParentLayout` (`apps/web/src/app/parent/layout.tsx`) to dynamically resolve `window.location.origin + "/admin/login"` (or `/parent/login`), keeping tunneled users on their active ngrok domain (`https://xxxx.ngrok-free.app`).
* **Alternatives considered:** Rely on default `signOut({ callbackUrl: "/admin/login" })` — rejected because NextAuth's default behavior resolves relative callback URLs against `NEXTAUTH_URL` (`http://localhost:3000`), breaking ngrok tunnel sessions on sign out.
* **Why we chose this path:** Dynamic origin preservation ensures seamless authentication flow regardless of whether the app is accessed on `localhost:3000`, an ngrok tunnel, or a custom production domain.

## 3. Database Schema Impact
* **Changes made:** none (UI/UX ergonomics and auth redirect handling only).

## 4. Core Logic & Necessary Functions
* **List of files modified:**
  * `auth.ts` (`apps/web/auth.ts`): Added custom `redirect` callback to preserve relative paths and current origin.
  * `AdminLayout` (`apps/web/src/app/admin/layout.tsx`): Updated sign out click handler to dynamically append `window.location.origin + "/admin/login"`.
  * `ParentLayout` (`apps/web/src/app/parent/layout.tsx`): Updated logout click handler to dynamically append `window.location.origin + "/parent/login"`.
  * `CopilotWidget` (`apps/web/src/components/CopilotWidget.tsx`): Replaced invalid `w-13 h-13` with valid 56px (`w-14 h-14 sm:w-16 sm:h-16`) touch targets and added 16px base input size.
  * `DashboardClient` (`apps/web/src/app/admin/dashboard/DashboardClient.tsx`): Upgraded Ask AI search bar layout to `flex-col sm:flex-row` and added mobile bottom-sheet styling to Reports Drawer.

## 5. Testing & Verification
* **Automated tests:** Next.js production build (`pnpm --filter web build`).
* **Manually verified:**
  * Floating Copilot button on mobile viewports (375px/390px) renders as a prominent 56px circle with clear icon readability.
  * Ask AI search bar on Admin Dashboard stacks cleanly on mobile viewports without horizontal input squishing.
  * Signing out from Admin Portal or Parent Portal while accessing via an ngrok tunnel (`https://xxxx.ngrok-free.app`) retains the ngrok domain instead of falling back to `http://localhost:3000`.

## 6. Dependencies & Deferred Work
* **Depends on:** NextAuth (Auth.js), Lucide React, Tailwind CSS.
* **Known issues/deferred:** none.
