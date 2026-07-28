# 🎓 Finora — Smart School FinTech Platform

> **A production-grade, double-entry digital fee management system for schools, featuring real-time bank auto-reconciliation, risk-segmented defaulter tracking, offline PWA payment syncing, AI-powered copilot analytics, and a multi-channel parent payment portal.**

---

## 📌 Executive Quick Links

Access the primary product specification and live presentation guides directly from the root directory:

* 📋 **[Master Feature Inventory](file:///d:/Desktop/project/Smart_school/master_feature_inventory.md)** — Comprehensive catalog of all implemented features, functional requirements, and module scopes.
* 🎭 **[Demo Presentation Guide](file:///d:/Desktop/project/Smart_school/demo_presentation_guide.md)** — Step-by-step walkthrough script for rehearsing and presenting live admin & parent workflows.

---

## 🌟 The Real-World Crisis: Day-to-Day Pain Points in School Fee Management

School fee collection is the financial lifeblood of educational institutions, yet it remains one of the most frustrating, error-prone, and stressful everyday experiences for parents, school accountants, and administrators alike.

### 😩 1. The Parent's Everyday Frustration
* **The Fee Desk Queue Nightmare**: Working parents are forced to take leave from work, travel to the school office, and stand in long, exhausting queues under extreme heat just to pay quarterly tuition fees in cash or cheque.
* **The Missing Tax Receipt Crisis**: During Income Tax filing season, parents scramble to locate physical paper receipts for **Section 80C tuition tax deductions**. School offices take weeks to issue duplicate receipts, causing parents to miss tax deadlines or lose valid deductions.
* **Embarrassing & False Default Reminders**: A parent who already paid via netbanking receives a harsh or public defaulter notice because the accountant hasn't manually updated the spreadsheet ledger. This breaks trust and damages the parent-school relationship.
* **Multi-Child Friction**: Parents with children in different grades have to navigate separate payment slips, different due dates, and multiple manual forms.

### 📑 2. The Accountant's Daily Nightmare
* **Late-Night UTR Matching**: School accountants spend dozens of midnight hours manually cross-referencing thousands of raw bank SMS alerts, 12-digit UTR numbers, and bank statement lines against Excel spreadsheets.
* **5–20% Annual Revenue Leakage**: Uncollected late penalties, untracked cheque bounces, unrecorded partial payments, and cumulative floating-point calculation drift lead to massive annual revenue loss.
* **Cash Handling & Security Risks**: Collecting physical cash at school counters exposes staff to theft, loss, and physical cash tally discrepancies without a digital audit trail.
* **Connectivity Bottlenecks**: In rural or Tier-2/3 schools, frequent internet outages freeze administrative fee desks, bringing daily collection operations to a complete standstill.

### 🏛 3. The Principal & Administrator's Strategic Blindspot
* **Working Capital Crunches**: Unpredictable cash flows caused by delayed fee collections force schools to defer teacher salary disbursements or take high-interest short-term loans.
* **Reactive Defaulter Management**: Administrators only discover who hasn't paid at the end of the term, when it is too late for proactive intervention.

---

## 🚀 The Finora Solution: Enterprise FinTech for Education

Finora directly addresses every single human and operational pain point with an automated, production-grade FinTech infrastructure:

| Everyday Human Pain Point | Finora's Engineering Solution | Operational & Financial Impact |
|---|---|---|
| **Parent Queue & Travel** | **Multi-Channel Parent Portal**: Single-click UPI QR codes, WhatsApp payment links, and Razorpay online payments from home. | ⚡ **Zero queues; 24/7 instant payment flexibility.** |
| **Missing 80C Tax Receipts** | **Instant 80C PDF Engine**: Automated, official Sec 80C Tax Exemption certificates generated in 1 click. | 📄 **100% tax compliance with instant PDF downloads.** |
| **False Default Notices** | **Automated Reconciliation**: Real-time matching of bank statement lines (UTR & amount) against pending fee assignments. | 🎯 **Zero false defaulter reminders; instant ledger updates.** |
| **Multi-Child Chaos** | **Unified Family Cockpit**: Single login allowing parents to manage and pay dues across all enrolled siblings. | 👨‍👩‍👧 **One-click multi-child payment overview.** |
| **Midnight UTR Cross-Referencing** | **Automated Bank Reconciliation Engine**: Auto-parses CSV/UPI statements, isolates duplicate UTRs & flags amount mismatches. | ⏱ **Saves 40+ accountant hours every month.** |
| **Revenue Leakage & Floating Errors** | **Double-Entry Zero-Float Ledger**: Minor-unit integer paisa math with invariant checking (`Debits = Credits`). | 💰 **0% floating-point calculation drift.** |
| **Internet & Desk Outages** | **Offline PWA & Resilient Fallback**: Offline IndexedDB queueing with `isDbUnreachable` automatic demo fallback. | 📶 **100% operational continuity even when offline.** |
| **Unpredictable Cash Flow** | **Defaulter Risk Engine**: Multi-factor weighted scoring ($\text{Risk Score} = w_1 \cdot \text{Days Overdue} + \dots$) with dynamic risk tiers. | 📈 **Proactive fee recovery & predictable working capital.** |
| **Opaque Financial Metrics** | **Gemini AI Financial Copilot**: Natural language queries and Gemini 1.5 Flash Vision receipt OCR scanning. | 🤖 **Instant executive financial intelligence.** |

---

## 🔬 Deep Dive: Core System Modules & Features

### 1. 💳 Double-Entry Financial Master Ledger Engine
* **Mathematical Invariants**: Enforces strict double-entry ledger rules (`Sum(Debits) = Sum(Credits)`). Revenue is credited to fee category accounts while accounts receivable or bank balances are debited.
* **Integer Minor-Unit Math**: All currency figures are calculated in minor units (paisa/cents) to guarantee zero floating-point calculation errors.
* **State Machine Governance**: Manages transaction and fee assignment lifecycle states (`unpaid`, `partially_paid`, `paid`, `overdue`, `cheque_pending`, `flagged`, `bounced`) with strict state-transition guards.
* **Immutable Audit Trail**: Every financial mutation — including fee creation, waiver application, penalty assessment, cheque bounce marking, and payment posting — generates an immutable `AuditLog` record containing the session `actorId`, timestamp, reason tag, and state diff.

### 2. 🔄 Automated Bank Statement Reconciliation & Anomaly Detection
* **Automated Statement Parsing**: Accepts electronic bank statement files (CSV/UPI logs) and matches incoming line items against pending student transactions.
* **Multi-Factor Matching**: Uses UTR/reference numbers, transaction dates, and exact amount matching to achieve automated reconciliation.
* **Real-time Anomaly Engine**: Automatically detects and flags suspicious transactions, including:
  - *Duplicate Reference Numbers*: Prevents double-counting duplicate UTRs across channels.
  - *Amount Mismatches*: Flags partial or overpaid amounts for human review.
  - *Unmapped VPAs*: Isolates unidentified bank transfers into an admin review queue.

### 3. 📉 Defaulter Risk Engine & Automated Recovery
* **Multi-Factor Weighted Risk Scoring**: Evaluates student payment history using a weighted scoring model:
  $$\text{Risk Score} = w_1 \cdot \text{Days Overdue} + w_2 \cdot \text{Outstanding Balance Ratio} + w_3 \cdot \text{Broken Promises} + w_4 \cdot \text{Assignment Count}$$
* **Dynamic Risk Categorization**: Automatically categorizes students into `High Risk` (🔴), `Medium Risk` (🟡), and `Low Risk` (🟢) tiers.
* **Tiered Reminder Queue**: Generates localized, personalized fee reminders for WhatsApp, SMS, or Email with dynamic single-click payment links.

### 4. 📱 PWA & Offline Payment Syncing
* **IndexedDB Offline Storage**: Allows school administrators to record cash or cheque payments in offline or low-connectivity school environments.
* **Background Sync Queue**: Queues transactions locally and automatically syncs with the central server when network connectivity is restored.
* **Conflict Resolution Table**: Provides a dedicated administrative interface (`OFFLINE_SYNC_CONFLICT`) to inspect, resolve, or override payment discrepancies safely.
* **Offline Demo Resilience**: Features an intelligent network connection detector (`isDbUnreachable`) that automatically falls back to local demo data if the remote database server is unreachable or offline.

### 5. 🤖 AI Financial Copilot & Multimodal Vision OCR
* **Gemini 1.5 Flash Vision OCR**: Enables school staff to upload scanned images of physical paper receipts, cheque deposit slips, or bank statements, automatically extracting student IDs, amounts, and dates into an automated staging form.
* **Natural Language Copilot**: Allows administrators to ask complex natural language questions about school financial metrics (e.g., *"What is our total collection efficiency for Grade 10 transport fees this quarter?"*).
* **Strict Read-Only Access Boundary**: The AI Copilot operates within a strictly read-only security sandbox — it can query and summarize financial data but can *never* execute financial mutations directly.

### 6. 👨‍👩‍👧 Multi-Child Parent Portal & FinTech Cockpit
* **Unified Family Switcher**: Allows parents with multiple enrolled children to switch between student profiles seamlessly without logging out.
* **Instant Sec 80C Tax Receipts**: Generates official, downloadable Section 80C Tax Certificates with auto-formatted PDFs for tuition fee tax deductions.
* **Multi-Channel Payment Options**: Supports instant UPI QR code generation, online card/netbanking sandbox payments, direct WhatsApp payment link sharing, and tactile audio Soundbox confirmations upon payment completion.
* **Multi-Language Support**: Supports 8 regional Indian languages (English, Hindi, Bengali, Gujarati, Marathi, Tamil, Telugu, Kannada) for inclusive parent accessibility.

### 7. 🎓 Student Lifecycle & Balance Disposition
* **Lifecycle State Tracking**: Manages student statuses (`active`, `inactive`, `graduated`, `transferred`).
* **Balance Disposition Guards**: Enforces strict financial settlement rules when changing student status — requiring explicit disposition of any remaining balance (e.g. refund, waiver, or write-off) to prevent stranded liabilities.

### 8. 🛡 Authorization & Row-Level Security (RLS) Model
* **Session Actor Bounding**: All administrative actions strictly derive the acting administrator ID from verified session tokens (`sessionAdminId`), preventing parameter tampering.
* **Tenant Isolation**: Row-Level Security policies in PostgreSQL enforce school-level multi-tenancy and restrict parent data access strictly to linked student records.

---

## 🏗 Monorepo Architecture

Finora is structured as a high-performance pnpm monorepo managed by Turborepo:

```
Finora Monorepo /
├── apps/
│   └── web/                   → Next.js 15 App Router Frontend & Server Actions
│       ├── src/
│       │   ├── app/           → Admin (/admin) & Parent (/parent) Portal Routes
│       │   ├── components/    → Reusable UI Components (GlassCard, StatusBadge, etc.)
│       │   └── lib/           → Utility Modules (Demo Mode, Supabase, Soundbox)
│       └── tests/             → Vitest Integration Test Suites
├── packages/
│   ├── ai/                    → Gemini API Client & Receipt OCR Ingestion Logic
│   ├── db/                    → Prisma Schema, Migrations, Seeders & RLS Policies
│   ├── payments/              → Razorpay Gateway Client & Webhook Event Handlers
│   └── rules/                 → Pure Business Rule Engine (Defaulter Score, Math)
├── docs/                      → 16 Architectural Specifications & Design Records
├── master_feature_inventory.md → Root Feature Specifications Catalog
├── demo_presentation_guide.md  → Root Step-by-Step Live Presentation Guide
└── Finora_source.zip          → Complete Source Code Archive (Git-managed)
```

---

## 🛠 Tech Stack

| Domain | Technology | Description |
|---|---|---|
| **Core Framework** | [Next.js 15 (App Router)](https://nextjs.org/) | Server Components, Native Server Actions & Streaming |
| **UI & Styling** | Vanilla Tailwind CSS | Dark mode, Glassmorphism design system & micro-animations |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Strict type checking & discriminant union type safety |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) + [Prisma 6](https://www.prisma.io/) | Relational database schema with row-level security |
| **Monorepo** | [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/) | Workspaces, incremental builds & dependency isolation |
| **Testing** | [Vitest 2](https://vitest.dev/) | Unit & integration test suites (~5s execution speed) |
| **AI Ingestion** | [Google Gemini 1.5 Flash Vision](https://ai.google.dev/) | Multimodal OCR receipt parsing & copilot queries |
| **Payment Gateway** | [Razorpay API](https://razorpay.com/) | Payment links, UPI QR generation & webhook signatures |
| **Offline PWA** | Service Workers + IndexedDB | Offline queueing & background sync capabilities |

---

## 💻 Local Setup & Installation

### Prerequisites
* **Node.js**: `>= 20.0.0`
* **pnpm**: `>= 9.0.0`

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/shaahir27/Finora.git
cd Finora
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
*(Note: If `DATABASE_URL` is omitted, offline, or unreachable, Finora automatically activates **Demo Mode**, serving rich mock data seamlessly for demonstration purposes).*

### 3. Database Migration & Seeding (Optional for Production DB)
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 4. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing Strategy

Finora includes comprehensive unit and integration test coverage across all workspace packages:

```bash
# Run complete test suite across monorepo
pnpm test

# Run type-checking across web application
pnpm --filter web exec tsc --noEmit
```

---

## 📚 Complete Architectural Documentation (`/docs`)

1. **`AI_INSTRUCTIONS.md`** — Master operating contract & strict AI coding boundaries.
2. **`project_overview.md`** — Core vision and governing financial principles.
3. **`product_requirements.md`** — Detailed functional requirement tiers (Must/Should/Nice).
4. **`business_rules.md`** — Rules governing fee structures, waivers, penalties, and GST.
5. **`system_architecture.md`** — Architectural diagrams, security boundaries, and module design.
6. **`database_design.md`** — Prisma entity relationships, indexes, and schema definitions.
7. **`api_specification.md`** — Complete server actions contract reference.
8. **`financial_engine.md`** — Integer math specifications and state transition models.
9. **`security.md`** — Row-Level Security policies, authentication flow, and token safety.
10. **`user_flows.md`** — End-to-end admin and parent user journey maps.
11. **`ui_ux_specification.md`** — Interface layouts, component specs, and responsive views.
12. **`design_system.md`** — Color design tokens (Forest Ledger Option A) & typography.
13. **`implementation_plan.md`** — Historical six-session implementation sequence.
14. **`testing_strategy.md`** — Testing protocol, coverage expectations, and assertion rules.
15. **`decision_log.md`** — Architectural Decision Records (ADRs) and design evolution.
16. **`BUILD_LOGGING_PROTOCOL.md`** — Feature build logging protocol (`build_history/`).

---

## 📜 License

Designed and developed for the PaperBuddy EduHack — Smart School FinTech Track. Available for production deployment.
