# Finora — Master Product Feature Inventory

> **System**: Finora Smart School FinTech Platform  
> **Verification Status**: 100% Certified (0 TypeScript Errors | 54/54 Tests Passing)  
> **Target Scope**: Complete Master Inventory across all 6 Sessions  

---

## 1. Financial Ledger & Fee Engine Core

| Feature | Description | Primary Code Files | DB Schema Tables | Status |
|---|---|---|---|---|
| **Multi-Fee Structure Assignment** | Supports Tuition, Transport, Sports, Laboratory, Admission, and Custom fee heads per class or student. | `apps/web/src/app/actions/fees.ts` | `FEE_TYPE`, `FEE_ASSIGNMENT` | Verified ✅ |
| **Double-Entry Master Ledger** | Centralized transaction journal recording all payment events, adjustments, and reversals with chronological sequence numbers. | `apps/web/src/app/actions/ledger.ts` | `TRANSACTION`, `AUDIT_LOG` | Verified ✅ |
| **Partial Payment Allocation** | Automatically applies partial payment amounts against remaining fee balances without off-by-one errors. | `packages/rules/src/feeComputation.ts` | `FEE_ASSIGNMENT`, `TRANSACTION` | Verified ✅ |
| **Waiver & Penalty Audit Engine** | Allows admins to apply waivers or penalties with mandatory logged reasons and strict audit logging. | `apps/web/src/app/actions/ledger.ts` | `WAIVER`, `PENALTY`, `AUDIT_LOG` | Verified ✅ |
| **Cheque Clearance & Bounce Workflow** | Real-time cheque status transitions (`cheque_pending` → `posted` or `reversed`), auto-reopening fee balances and recalculating defaulter risk on bounce. | `apps/web/src/app/actions/ledger.ts` | `TRANSACTION`, `DEFAULTER_SCORE` | Verified ✅ |
| **Bulk CSV Student Import** | Partial-batch resilient CSV student directory import skipping existing admission numbers per school. | `apps/web/src/app/actions/students.ts` | `STUDENT` | Verified ✅ |
| **Student Lifecycle Management** | Handles student status changes (`active`, `graduated`, `withdrawn`) with mandatory balance disposition rules (`write_off`, `refund`, `carry_forward`). | `apps/web/src/app/actions/students.ts` | `STUDENT`, `WAIVER` | Verified ✅ |

---

## 2. Reconciliation, Webhooks & Offline Sync

| Feature | Description | Primary Code Files | DB Schema Tables | Status |
|---|---|---|---|---|
| **Razorpay UPI Sandbox Integration** | Order creation and sandbox UPI simulation for parent payments. | `packages/payments/src/razorpay.ts` | `TRANSACTION` | Verified ✅ |
| **Webhook HMAC Verification & Idempotency** | Razorpay HMAC signature validation ensuring duplicate `ref_number` webhooks return existing records. | `apps/web/src/app/actions/ledger.ts` | `TRANSACTION` | Verified ✅ |
| **Manual UPI Reconciliation Fallback** | Admin recovery action (`reconcileMissedUpiPayment`) querying Razorpay API for missed webhooks. | `apps/web/src/app/actions/ledger.ts` | `TRANSACTION` | Verified ✅ |
| **Rule-Based Anomaly Detection** | Real-time amount mismatch and duplicate reference checking via `round2()` precision arithmetic. | `packages/rules/src/anomaly.ts` | `ANOMALY_FLAG` | Verified ✅ |
| **School-Scoped Anomaly Resolution** | Admin action (`resolveAnomaly`) allowing posting or reversing flagged transactions within authorized school context. | `apps/web/src/app/actions/ledger.ts` | `ANOMALY_FLAG`, `TRANSACTION` | Verified ✅ |
| **IndexedDB Offline Payment Queue** | Client-side queueing (`offlineQueue.ts`) for cash/cheque entries when offline (`navigator.onLine === false`). | `apps/web/src/lib/offlineQueue.ts` | IndexedDB (`finora_offline_db`) | Verified ✅ |
| **Background Sync & Conflict Resolution** | Syncs offline entries on reconnection, flagging conflicts in `OFFLINE_SYNC_CONFLICT` if balances changed offline. | `apps/web/src/app/actions/offlineSync.ts` | `OFFLINE_SYNC_CONFLICT` | Verified ✅ |

---

## 3. Defaulter Risk Scoring & Reminders

| Feature | Description | Primary Code Files | DB Schema Tables | Status |
|---|---|---|---|---|
| **3-Factor Defaulter Risk Scoring** | Mathematical risk algorithm (0–100 score, Low/Medium/High) based on days overdue, broken promises, and unpaid balance ratio. | `packages/rules/src/defaulterScore.ts` | `DEFAULTER_SCORE` | Verified ✅ |
| **Multi-Tier Reminder Escalation** | Tier 1 (1–6 days), Tier 2 (7–13 days), and Tier 3 (14+ days) reminder drafting engine. | `packages/rules/src/reminderTrigger.ts` | `REMINDER_LOG` | Verified ✅ |
| **Human-in-the-Loop Reminders Queue** | Admin checkpoint UI (`/admin/reminders`) requiring explicit human "Mark as Sent" before dispatch. | `apps/web/src/app/admin/reminders/page.tsx` | `REMINDER_LOG` | Verified ✅ |
| **Email Reminders via Resend** | Real, non-blocking email dispatch via Resend for linked parent accounts. | `apps/web/src/app/actions/reminders.ts` | `REMINDER_LOG` | Verified ✅ |
| **Smart Reminder Muting (24h Window)** | 24-hour `isPaymentInFlight` suppression preventing annoying reminder blasts to parents currently paying. | `packages/rules/src/reminderTrigger.ts` | `REMINDER_LOG` | Verified ✅ |

---

## 4. Parent Portal, Multi-Child Cockpit & Localization

| Feature | Description | Primary Code Files | DB Schema Tables | Status |
|---|---|---|---|---|
| **Parent Phone OTP & Email Auth** | Supabase Auth integration with Twilio SMS OTP and email fallback for parent login. | `apps/web/src/app/actions/parents.ts` | `USER`, `PARENT_STUDENT_LINK` | Verified ✅ |
| **Multi-Child Parent Cockpit** | Consolidated view aggregating total household dues across siblings with an instant student switcher. | `apps/web/src/app/parent/cockpit/page.tsx` | `PARENT_STUDENT_LINK`, `STUDENT` | Verified ✅ |
| **Parent IDOR Protection** | Server Actions derive `parentUserId` directly from session context, verifying `guardianOf` ownership before returning data. | `apps/web/src/lib/require-session.ts` | `PARENT_STUDENT_LINK` | Verified ✅ |
| **Bilingual Hindi / English Toggle** | `next-intl` localization enabling 1-click toggle between English and Hindi across parent portal surfaces. | `apps/web/src/components/LanguageSwitcher.tsx` | `messages/en.json`, `messages/hi.json` | Verified ✅ |
| **Parent Payment Sandbox** | Interactive UPI payment simulator allowing parents to pay dues in sandbox mode with instant receipt generation. | `apps/web/src/app/parent/dues/page.tsx` | `TRANSACTION`, `RECEIPT` | Verified ✅ |

---

## 5. 7 Gemini-Powered AI Features

| Feature | Description | Primary Code Files | Dependencies | Status |
|---|---|---|---|---|
| **1. Defaulter Insight Narration** | Generates humanized risk summaries for high-risk student cards. | `packages/ai/src/narrative.ts` | Gemini API | Verified ✅ |
| **2. Natural Language Dashboard Queries** | Converts English/Hindi questions into structured ledger queries. | `packages/ai/src/dashboardQuery.ts` | Gemini API | Verified ✅ |
| **3. Anomaly Explanation Narration** | Explains why a transaction was flagged in plain language. | `packages/ai/src/narrative.ts` | Gemini API | Verified ✅ |
| **4. AI Reminder Text Drafting** | Drafts polite, persuasive reminder messages tailored to risk tier. | `packages/ai/src/narrative.ts` | Gemini API | Verified ✅ |
| **5. OCR Document Field Extraction** | Extracts fee amounts, student names, and dates from bank deposit slips and cheque images. | `packages/ai/src/ocr.ts` | Gemini Vision | Verified ✅ |
| **6. AI Copilot (Function Calling)** | Role-based Copilot executing whitelisted read actions for Admin & Parent. | `packages/ai/src/copilot.ts` | Gemini API | Verified ✅ |
| **7. Weekly Summary Digest** | Computes 7-day collection trends, cheque aging, and risk movements narrated into a weekly executive digest. | `packages/ai/src/weeklyDigest.ts` | Gemini API | Verified ✅ |

---

## 6. Receipts, Reports & Export Engine

| Feature | Description | Primary Code Files | Output Format | Status |
|---|---|---|---|---|
| **GST-Compliant Digital Receipts** | Generates standard A4 & Thermal POS receipt PDFs with GST breakdown and signature blocks. | `apps/web/src/app/actions/receipts.ts` | PDF / Data URL | Verified ✅ |
| **Section 80C Tax Certificate Engine** | Isolates pure tuition fee allocations for a financial year, generating downloadable Section 80C Tax Certificates. | `apps/web/src/app/actions/receipts.ts` | Structured Payload / PDF | Verified ✅ |
| **Reconciliation Summary Reports** | Summarizes total collections, channel breakdowns, anomaly flags, and pending cheques. | `apps/web/src/app/actions/reports.ts` | JSON / UI | Verified ✅ |
| **Tally Prime Double-Entry XML Export** | Exports posted ledger transactions in official Tally XML voucher format (`vouchertype="Receipt"`). | `apps/web/src/app/actions/reports.ts` | XML File | Verified ✅ |

---

## 7. Standout Flagship Innovations

| Feature | Description | Primary Code Files | Zero-Key Requirement | Status |
|---|---|---|---|---|
| **AI Audio Fee Soundbox** | Provides bilingual (Hindi/English) voice confirmation when payments or cheque clearances post, using W3C `SpeechSynthesis`. | `apps/web/src/lib/soundbox.ts`, `SoundboxToggle.tsx` | 0 External API Keys | Verified ✅ |
| **WhatsApp 1-Tap UPI Payment Links** | Dispatches interactive WhatsApp links (`https://wa.me/...`) with pre-filled student details and 1-tap Google Pay/PhonePe checkout. | `apps/web/src/lib/whatsapp.ts` | 0 External API Keys | Verified ✅ |
| **Smart Sibling WhatsApp Bundling** | Aggregates dues for parents with 2+ children into a single single-card WhatsApp payment link. | `apps/web/src/lib/whatsapp.ts` | 0 External API Keys | Verified ✅ |
| **Dynamic Student UPI QR Code Generator** | Builds NPCI-compliant UPI URIs (`upi://pay?pa=...&tr=feeAssignmentId`) containing embedded transaction references for 100% auto-reconciliation. | `apps/web/src/lib/upiQr.ts` | 0 External API Keys | Verified ✅ |

---

## 8. Security, Infrastructure & Quality Assurance

| Feature | Description | Target Specification / Code Files | Status |
|---|---|---|---|
| **Application Session Guards** | `requireAdminForSchool(schoolId)` & `requireParentSession()` protecting all Server Action entry points. | `apps/web/src/lib/require-session.ts` | Verified ✅ |
| **Demo Mode Security Gate** | `ALLOW_UNAUTHENTICATED_DEMO_ACTIONS` opt-in flag protecting unauthenticated demo action fallbacks in production. | `apps/web/src/lib/require-session.ts` | Verified ✅ |
| **Database Constraints & Partial Indexes** | Partial unique indexes on `ref_number`, `admission_number`, `receipt_number`, and `CHECK ("amount" > 0)`. | `packages/db/prisma/migrations/20260726000000...` | Verified ✅ |
| **In-Memory Rate Limiting** | Sliding window rate limiting (`rateLimit.ts`) protecting AI, report export, and file upload endpoints. | `apps/web/src/lib/rateLimit.ts` | Verified ✅ |
| **Native PWA & Service Worker** | Progressive Web App manifest (`manifest.json`), service worker, and offline asset caching. | `apps/web/public/manifest.json` | Verified ✅ |
| **VAPID Web Push Notifications** | Native PWA push notifications dispatched via `web-push` for payment events and anomaly alerts. | `apps/web/src/app/actions/push.ts` | Verified ✅ |
| **TanStack React Query v5** | Client-side state synchronization wrapping Supabase Realtime and server action queries via `useDataState`. | `apps/web/src/lib/useDataState.ts` | Verified ✅ |
| **Glassmorphic Mobile-First Design** | Custom Vanilla CSS design system with glassmorphism, responsive bottom nav, and mobile-optimized viewports. | `apps/web/src/app/globals.css`, `GlassCard.tsx` | Verified ✅ |
| **Strict Type Checking** | Zero TypeScript compilation errors across all workspace packages (`pnpm --filter web exec tsc --noEmit`). | Entire Monorepo | Verified ✅ |
| **Automated Test Suite** | 54 out of 54 Vitest unit and integration tests passing cleanly. | `pnpm test` | 100% Green ✅ |
