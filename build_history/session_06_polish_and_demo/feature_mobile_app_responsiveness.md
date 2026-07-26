# Feature Log: Mobile App Layout & Responsiveness Overhaul

## 1. Overview
* **Name:** Mobile App Layout & Responsiveness Overhaul
* **Session:** Session 6 — Polish, Auditing & Demo
* **Purpose:** Upgrade the Finora application (Parent Portal, Admin Portal, and Landing Page) into a native touch-first mobile experience with dedicated Mobile Bottom Navigation, dynamic `100dvh` viewport handling, responsive Stack Cards views, mobile bottom sheet dialogs, and 44px+ touch targets.
* **Traces to:** `docs/product_requirements.md` & `ui_ux_specification.md` Mobile PWA & Touch Ergonomics Strategy.

## 2. Technical Rationale
* **How we achieved it:**
  1. Built `MobileBottomNav` component (`apps/web/src/components/MobileBottomNav.tsx`) offering persistent 1-tap mobile bottom tab bar navigation for **Dues**, **History**, **Copilot**, and **Settings** with glassmorphism styling, active state pills, and safe area insets (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`).
  2. Updated `globals.css` with dynamic viewport height utilities (`min-h-dvh`, `h-dvh`), safe area inset utility classes (`pb-safe`, `mb-safe`), scrollbar hidden utilities (`.no-scrollbar`), and mobile bottom-sheet modal styling (`.mobile-bottom-sheet`).
  3. Integrated `MobileBottomNav` into `ParentLayout` (`apps/web/src/app/parent/layout.tsx`), set dynamic `h-dvh` heights, updated mobile content bottom padding (`pb-24 md:pb-8`) to prevent content cutoff, and streamlined the sticky top app bar.
  4. Updated `AdminLayout` (`apps/web/src/app/admin/layout.tsx`) with sticky top header, dynamic viewport heights (`h-dvh`), and 44px+ minimum tap target areas for mobile menu triggers.
  5. Overhauled Landing Page (`apps/web/src/app/page.tsx`) with compact mobile header action pills, fluid hero typography (`text-3xl sm:text-5xl md:text-6xl`), horizontally scrollable sandbox tab pills (`overflow-x-auto no-scrollbar flex-nowrap`), and safe area aware Floating Judge Dock (`bottom-[max(1rem,env(safe-area-inset-bottom))]`).
  6. Enhanced `ParentDuesPage` (`apps/web/src/app/parent/dues/page.tsx`) child switcher buttons to 44px+ touch target size (`min-h-[44px]`) with horizontal scrolling wrapper and added `.mobile-bottom-sheet` class to Section 80C Tax, GST, and Installment simulator dialogs.
  7. Implemented dual responsive views in `ParentHistoryPage` (`apps/web/src/app/parent/history/page.tsx`): **Touch-Optimized Stack Cards** on mobile viewports (< 640px) and **Structured Data Table** on desktop viewports (≥ 640px).
  8. Updated `ParentCopilotPage` (`apps/web/src/app/parent/copilot/page.tsx`), `ParentPayPage` (`apps/web/src/app/parent/pay/page.tsx`), and `ParentSettingsPage` (`apps/web/src/app/parent/settings/page.tsx`) with dynamic `dvh` container bounds, input font size `text-base` to eliminate iOS Safari focus auto-zoom, and 44px+ minimum tap target heights on buttons, controls, and selects.
* **Alternatives considered:** Keep standard top drawer hamburger menu on mobile — rejected because mobile parents expect modern fintech native tab bar navigation (like GPay, Paytm, Cred).
* **Why we chose this path:** Dedicated bottom navigation, bottom-sheet dialogs, mobile stack cards, and dynamic `dvh` viewports provide an exceptional native-app feel on mobile devices without breaking desktop layouts.

## 3. Database Schema Impact
* **Changes made:** none (UI/UX responsiveness overhaul only).

## 4. Core Logic & Necessary Functions
* **List of files modified & created:**
  * `MobileBottomNav` (`apps/web/src/components/MobileBottomNav.tsx`): Touch-friendly mobile bottom tab bar navigation component.
  * `globals.css` (`apps/web/src/globals.css`): Added safe-area insets, dvh heights, scrollbar, and mobile bottom sheet helpers.
  * `ParentLayout` (`apps/web/src/app/parent/layout.tsx`): Wired `MobileBottomNav`, updated container heights to `h-dvh`, and adjusted main padding for mobile.
  * `AdminLayout` (`apps/web/src/app/admin/layout.tsx`): Updated top bar sticky z-index, dynamic dvh heights, and touch targets.
  * `Landing Page` (`apps/web/src/app/page.tsx`): Compact mobile header buttons, fluid title scaling, scrollable sandbox tabs, and safe-area dock.
  * `ParentDuesPage` (`apps/web/src/app/parent/dues/page.tsx`): 44px+ child switcher touch targets and mobile bottom-sheet modals.
  * `ParentHistoryPage` (`apps/web/src/app/parent/history/page.tsx`): Dual-mode view with Mobile Stack Cards (< 640px) and Desktop Table (≥ 640px).
  * `ParentCopilotPage` (`apps/web/src/app/parent/copilot/page.tsx`): Dynamic dvh chat window height and 16px base input size.
  * `ParentPayPage` & `ParentSettingsPage`: Base 16px inputs (iOS auto-zoom prevention) and 44px+ tap targets.

## 5. Testing & Verification
* **Automated tests:** Next.js production build (`pnpm --filter web build`).
* **Manually verified:**
  * Landing page rendering on mobile viewports (375px, 390px, 412px, 430px) with responsive header actions and scrollable sandbox tabs.
  * Parent portal bottom tab bar switching between Dues, History, Copilot, Settings.
  * Stack cards view on `ParentHistoryPage` for mobile viewports without horizontal table scrollbars.
  * Bottom-sheet dialog rendering for Tax 80C, GST, and Installment simulator modals on phone screens.
  * Input focus stability on iOS Safari (zero auto-zooming canvas shifts).

## 6. Dependencies & Deferred Work
* **Depends on:** `next-intl`, `lucide-react`, `Framer Motion`.
* **Known issues/deferred:** none.
