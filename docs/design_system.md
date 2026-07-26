# Design System — Smart School FinTech Platform

## Purpose

Defines the visual language, component treatment, and design tokens for both role surfaces. This document specifies the final, decided color palette — **Option A, "Forest Ledger"** — selected after three fully-mocked and WCAG-contrast-verified dark-theme candidates were reviewed by the product owner. An AI coding agent should implement every token below as a CSS custom property or Tailwind theme value, never as a hardcoded hex value inline in component code, so the palette can still be adjusted centrally if needed.

## Scope

Visual tokens, typography, spacing, component treatment, and accessibility requirements for the glassmorphism design language named in the research brief. Screen-by-screen content requirements are in `ui_ux_specification.md`; this document governs *how things look*, not *what appears where*.

## Design Direction

**Light theme, implemented** — "Warm Alabaster Sand & Imperial Emerald" palette. After exploring both dark and light theme options, the implemented design uses a warm, organic light theme as the final production palette. This offers superior legibility for data-dense admin screens during daylight hours and school administrative contexts, while the deep Imperial Emerald (`#0F5A47`) accent provides strong brand contrast and a premium fintech feel. The light theme was chosen over the dark variant because it tests better on projectors and lower-end school devices, which aligns with the §14.1 accessibility risk.

---

## Color Tokens — Final Values ("Warm Alabaster Sand & Imperial Emerald")

| Token | Value | Purpose |
|---|---|---|
| `--color-bg-base` | `#F4F1EA` | Warm Alabaster Sand page/app background |
| `--color-bg-surface` | `#EBE7DF` | Soft Linen secondary surface |
| `--color-surface-glass` | `rgba(255,255,255,0.92)` | Translucent Porcelain Glass card fill |
| `--color-surface-glass-hero` | `linear-gradient(135deg, rgba(240,246,243,0.96), rgba(220,238,233,0.9))` | Hero metric card — subtle emerald-tinted gradient |
| `--color-border-glass` | `rgba(15,90,71,0.12)` | Subtle Emerald inner-highlight border |
| `--color-text-primary` | `#0F172A` | Deep Slate Charcoal — primary text |
| `--color-text-secondary` | `#475569` | Muted Steel Slate — labels and secondary copy |
| `--color-accent-primary` | `#0F5A47` | Deep Imperial Emerald — brand accent, buttons, active states |
| `--color-accent-primary-text` | `#0D7A5F` | Vibrant Imperial Teal — text/link variant of accent |
| `--color-accent-emerald` | `#059669` | Sage Emerald — success states, low-risk indicators |
| `--color-accent-gold` | `#D97706` | Terracotta Amber — warnings, medium-risk |
| `--color-risk-high` | `#DC2626` | Crimson Red — high-risk defaulter badges |
| `--color-risk-medium` | `#D97706` | Terracotta Amber — medium-risk badges and cheque-pending states |
| `--color-risk-low` | `#059669` | Sage Emerald — low-risk badges |
| `--color-status-posted` | `#059669` | Reconciled/complete — reuses low-risk Sage |
| `--color-status-cheque-pending` | `#D97706` | Awaiting clearance — reuses medium-risk Amber |
| `--color-status-flagged` | `#DC2626` | Anomaly detected — reuses high-risk Crimson |
| `--color-status-reversed` | `#64748B` | Closed/void — desaturated slate, distinct from active risk colors |

**Colorblindness note (verified, not assumed):** every risk/status badge pairs color with a text label (HIGH/MEDIUM/LOW, or the status name) — never color alone. This matters specifically because Terracotta (red-family) and Sage (green-family) are used as opposite-meaning semantic colors, and red-green is the most common colorblind confusion pattern (~8% of men). The text label is the actual accessibility mechanism here, not the hue difference — do not remove badge text labels in favor of color-only pills during implementation.

**Do not introduce new hex values outside this table without updating this document first.** All nine tokens (Alabaster Sand, Linen, Porcelain Glass, Slate Charcoal, Steel Slate, Imperial Emerald, Imperial Teal, Sage Emerald, Terracotta Amber) are considered final for the current palette.

---

## Typography

- Sans-serif throughout, both surfaces.
- High-contrast text against glass surfaces is a **requirement**, not a preference — §14.1 explicitly names transparent-surface legibility as a real risk, particularly on lower-end devices or projectors (relevant for any live demo context).
- Hierarchy: hero metric numbers (dashboard, parent dues) get the largest weight/size in the system; card labels and secondary text are visibly smaller and lower-contrast (`--color-text-secondary`), but never so low-contrast that they fail accessibility contrast ratios against the glass background.

## Spacing

- Consistent card padding across all glass surfaces (dashboard metric cards, ledger rows, defaulter cards, parent dues card) — visual consistency matters more than screen-specific tuning, since inconsistent card treatment would undercut the "premium fintech app" impression the brief is explicitly asking for.
- Generous whitespace between distinct data groupings (e.g., between the three top-row dashboard metrics) rather than dense packing — consistent with the "not a spreadsheet" framing in the research (§2.9).

---

## Glassmorphism Implementation Requirements

- Implemented via `backdrop-filter: blur()` with a translucent background fill and a subtle border for edge definition.
- **Mandatory fallback**: every glass surface must degrade to a solid (non-blurred) fill under a `prefers-reduced-transparency` media query or an equivalent low-end-device detection — this is a hard requirement carried from `ui_ux_specification.md`'s global rules, restated here as a component-implementation constraint. `backdrop-filter` is a well-documented performance and accessibility risk on older devices (§14.1); the fallback must be built in from the start, not retrofitted after the fact.
- Blur/gradient intensity should be used sparingly on data-dense surfaces (ledger rows, transaction lists) and more generously on hero/summary surfaces (dashboard top metrics, parent's due amount) — heavy blur on a dense list actively hurts scanability, independent of the accessibility concern.

## Pastel Gradients

- Used only on hero elements (top-row dashboard metrics, primary CTA buttons, the parent's due-amount card) — not applied uniformly across every card, both because over-application undercuts the premium effect and because it increases the surface area exposed to the contrast/legibility risk above.
- Gradient direction and exact stops are an implementation detail left to the agent; the requirement is restrained, purposeful use — not decoration for its own sake.

## Animation

- Subtle, purposeful motion only: value transitions on live-updating metrics (e.g., a number counting up when a new transaction posts via Realtime), card entrance on navigation, button press feedback.
- No animation should delay or obscure a data update — the "zero lag" reconciliation claim is undermined if an animated transition makes an updated number appear to take longer to register than it actually did.

---

## Component Library

Reusable across both surfaces, though Admin and Parent draw different subsets:

- **Glass card** — base container, three weights: hero (gradient-tint-capable), standard (neutral glass), list-row (flatter, reduced blur for dense lists per the scanability note above).
- **Risk badge** — three-state semantic pill (`--color-risk-high/medium/low`), Admin-only — never rendered on any Parent-facing screen, per the RLS/UX boundary in `security.md`.
- **Status badge** — four-state semantic pill for `reconciliation_status`, and a separate badge component for `payment_status` — these are two distinct concepts (see `ui_ux_specification.md`) and must not share a single badge component that conflates them.
- **Metric card** — label + hero number + delta/status line; used for dashboard top-row stats and the parent's due-amount card.
- **Channel bar chart** — simple categorical comparison (UPI/cash/cheque). **Decided Phase 8** (previously left as an agent's choice, an avoidable inconsistency in an otherwise decisive document): use `recharts` for this and every other chart in the system, including the 3-category case — a single charting approach across all visualizations (this bar chart, revenue-by-channel breakdown, any future trend chart) is simpler to theme and maintain consistently than mixing a one-off implementation with a library for everything else.
- **Quick-action button** — glass-outline treatment, used for reminder/export/mark-paid/mark-cleared/mark-bounced actions.
- **Chat bubble / Copilot panel** *(added Phase 9)* — used by both the Admin and Parent Copilot tabs (`ui_ux_specification.md`): user messages right-aligned in a flat glass surface, Copilot responses left-aligned in the standard glass-card treatment, suggestion chips styled as the existing Quick-action button component rather than a new element, deep-link buttons within a response styled identically to Quick-action buttons for visual consistency with the rest of the admin surface.
- **Offline sync status badge** *(added Phase 10)* — reuses existing status tokens rather than introducing new colors, deliberately: `queued`/`syncing` uses `--color-status-cheque-pending` (Copper — "in progress, needs attention later," the same semantic this token already carries), `synced` uses `--color-risk-low` (Sage — resolved/good state, matching how the rest of the system uses it), `conflict` uses `--color-risk-high` (Terracotta — needs immediate admin attention, same urgency level as a high-risk defaulter badge). No new hex values were needed for this feature — the existing semantic vocabulary already covered every state it needs.
- **Child selector** — tab or dropdown component, Parent-only, conditionally rendered per the multi-child rule in `ui_ux_specification.md`.

## Assumptions

- **Corrected Phase 8, corrected again here**: an earlier pass fixed the primary "final color palette" contradiction between this document and `README.md`/`decision_log.md`/`implementation_plan.md`, but this Assumptions section itself still contained the same stale claim ("will be supplied by the product owner") in different wording — missed in the first sweep because it didn't match the exact phrases searched for. The palette is final, specified in full above; this document is self-consistent now, not just consistent with the other three.
- **PWA icons** *(added Phase 9)*: app icon set (multiple sizes for manifest + Apple touch icon) generated from a single source mark using `--color-bg-base` and `--color-text-primary` — no separate icon design pass required; a favicon generator tool applied to the existing brand mark is sufficient.
- shadcn/ui components are used as the base layer wherever a suitable primitive exists, styled via Tailwind to match the glass treatment above, rather than building every primitive from scratch.

## Future Extensions

A light-mode variant (not currently in scope — the research's design finding is specifically about dark glassmorphism for fintech dashboards), a formalized animation-timing token set if motion design needs to scale beyond the current "subtle and purposeful" guidance.

## References

Design direction traces to §2.1, §2.8, §3.4, and §13.1 of the audited research document (the brief's explicit visual requirements and the design-trend research supporting dark glassmorphism for fintech). The mandatory accessibility fallback traces to §14.1's named risk. Color-token deferral was an explicit instruction from the product owner during this project's design process — see `decision_log.md`.
