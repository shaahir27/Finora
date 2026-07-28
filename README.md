# 🎓 Finora — Smart School FinTech Platform

> **A production-grade, double-entry digital fee management system for schools, featuring real-time bank auto-reconciliation, risk-segmented defaulter tracking, offline PWA payment syncing, AI-powered copilot analytics, and a multi-channel parent payment portal.**

---

## 📌 Executive Quick Links

Access the primary product specification and live presentation guides directly from the root directory:

* 📋 **[Master Feature Inventory](file:///d:/Desktop/project/Smart_school/master_feature_inventory.md)** — Comprehensive catalog of all implemented features, functional requirements, and module scopes.
* 🎭 **[Demo Presentation Guide](file:///d:/Desktop/project/Smart_school/demo_presentation_guide.md)** — Step-by-step walkthrough script for rehearsing and presenting live admin & parent workflows.

---

## 🌟 Product Overview & Problem Statement

### The Problem in School Fee Management
Traditional K-12 educational institutions across India and emerging markets face severe financial management friction:
* **Manual Cash & Cheque Reconciliation**: School accountants spend dozens of hours manually matching paper bank receipts and UTR numbers against ledger spreadsheets, leading to untracked cheque bounces and unaccounted cash receipts.
* **Floating-Point Financial Errors**: Generic software platforms use standard floating-point numbers (`0.1 + 0.2 = 0.30000000000000004`), creating cumulative balance drift across thousands of student fee ledgers.
* **Reactive Defaulter Tracking**: Schools lack real-time visibility into high-risk fee defaulters, relying on manual end-of-month lists that delay fee recovery and cash flow.
* **Fragmented Parent Communication**: Parents receive irregular paper notices or generic SMS blasts without direct, single-click payment options or immediate tax certificate access.

### The Finora Solution
**Finora** bridges traditional school accounting with modern FinTech engineering. Built on a zero-float, double-entry financial engine, Finora automates the entire lifecycle of school revenue collection — from fee assignment and automated bank statement reconciliation to risk-weighted defaulter recovery, AI financial analytics, and a seamless multi-child parent portal.

---

## 🔬 Core Product Modules & Deep Dive

### 1. 💳 Double-Entry Financial Master Ledger
* **Mathematical Invariants**: Enforces strict double-entry ledger rules (`Sum(Debits) = Sum(Credits)`). Revenue is credited to fee category accounts while accounts receivable or bank balances are debited.
* **Integer Minor-Unit Math**: All currency figures are calculated in minor units (paisa/cents) to guarantee zero floating-point calculation errors.
* **Immutable Audit Trail**: Every financial mutation — including fee creation, waiver application, penalty assessment, cheque bounce marking, and payment posting — generates an immutable `AuditLog` record containing the session `actorId`, timestamp, reason tag, and state diff.

### 2. 🔄 Automated Bank Reconciliation & Anomaly Engine
* **Automated Bank Statement Parsing**: Accepts electronic bank statement files (CSV/UPI logs) and matches incoming line items against pending student transactions.
* **Multi-Factor Matching**: Uses UTR/reference numbers, transaction dates, and exact amount matching to achieve automated reconciliation.
* **Real-time Anomaly Detection**: Automatically detects and flags suspicious transactions, including:
  - *Duplicate Reference Numbers*: Prevents double-counting duplicate UTRs across channels.
  - *Amount Mismatches*: Flags partial or overpaid amounts for human review.
  - *Unmapped VPAs*: Isolates unidentified bank transfers into an admin review queue.

### 3. 📉 Defaulter Risk Engine & Automated Escalation
* **Multi-Factor Risk Scoring**: Evaluates student payment history using a weighted scoring model:
  $$\text{Risk Score} = w_1 \cdot \text{Days Overdue} + w_2 \cdot \text{Outstanding Balance Ratio} + w_3 \cdot \text{Broken Promises} + w_4 \cdot \text{Assignment Count}$$
* **Dynamic Risk Categorization**: Automatically categorizes students into `High Risk` (🔴), `Medium Risk` (🟡), and `Low Risk` (🟢) tiers.
* **Tiered Reminder Dispatch**: Generates localized, personalized fee reminders for WhatsApp, SMS, or Email with dynamic single-click payment links.

### 4. 📱 PWA & Offline Payment Syncing
* **IndexedDB Offline Storage**: Allows school administrators to record cash or cheque payments in offline or low-connectivity school environments.
* **Background Sync Queue**: Queues transactions locally and automatically syncs with the central server when network connectivity is restored.
* **Conflict Resolution Table**: Provides a dedicated administrative interface (`OFFLINE_SYNC_CONFLICT`) to inspect, resolve, or override payment discrepancies safely.
* **Offline Demo Resilience**: Features an intelligent network connection detector (`isDbUnreachable`) that automatically falls back to local demo data if the remote database server is unreachable or offline.

### 5. 🤖 AI Financial Copilot & OCR Receipt Ingestion
* **Gemini 1.5 Flash Vision OCR**: Enables school staff to upload scanned images of physical paper receipts, cheque deposit slips, or bank statements, automatically extracting student IDs, amounts, and dates into an automated staging form.
* **Natural Language Copilot**: Allows administrators to ask complex natural language questions about school financial metrics (e.g., *"What is our total collection efficiency for Grade 10 transport fees this quarter?"*).
* **Strict Read-Only Access Boundary**: The AI Copilot operates within a strictly read-only security sandbox — it can query and summarize financial data but can *never* execute financial mutations directly.

### 6. 👨‍👩‍👧 Multi-Child Parent Portal & FinTech Cockpit
* **Unified Family Switcher**: Allows parents with multiple enrolled children to switch between student profiles seamlessly without logging out.
* **Instant Sec 80C Tax Receipts**: Generates official, downloadable Section 80C Tax Certificates with auto-formatted PDFs for tuition fee tax deductions.
* **Multi-Channel Payment Options**: Supports instant UPI QR code generation, online card/netbanking sandbox payments, direct WhatsApp payment link sharing, and tactile audio Soundbox confirmations upon payment completion.

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

### Test Suite Breakdown
* **`packages/rules`**: Tests financial calculation invariants, integer arithmetic, waiver rules, and duplicate reference detection.
* **`apps/web/src/__tests__`**: Tests student directory filtering, waiver/penalty audit log creation, and bank reconciliation pipelines.
* **`apps/web/tests/`**: Integration tests verifying session authorization guards, non-blocking notification dispatch, and tax certificate generation.

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
