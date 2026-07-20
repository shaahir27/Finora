# Financial Engine — Smart School FinTech Platform

## Purpose

Specifies the calculation and state-transition mechanics of every money-affecting engine in the system: fee computation, reconciliation, waiver/penalty application, GST calculation, and reporting aggregation. Where `business_rules.md` states *what* the rules are, this document specifies *how* they execute as engine mechanics — sequencing, derived-field computation, and state machines. An AI coding agent implementing the ledger, fee, or reporting modules should treat this as the mechanical reference; treat `business_rules.md` as the policy reference.

## Scope

Fee computation mechanics, the `FEE_ASSIGNMENT` payment-status state machine, the `TRANSACTION` reconciliation-status state machine, GST calculation mechanics, and reporting query mechanics. Does not restate policy rationale already covered in `business_rules.md`.

---

## 1. Fee Computation

- `FEE_ASSIGNMENT.amount` is the sole source of the amount owed for that assignment — never recomputed from `FEE_TYPE` after assignment. If a fee type's default changes later, existing assignments are unaffected; only new assignments pick up the new default.
- `FEE_ASSIGNMENT.amount_paid` is **always derived, never stored as an independent writable field**:
  ```
  amount_paid = SUM(TRANSACTION.amount)
    WHERE fee_assignment_id = this.id
    AND reconciliation_status IN ('posted')
  ```
  Note: `cheque_pending` transactions are **excluded** from this sum — a pending cheque is not yet paid money for the purposes of balance calculation, consistent with its exclusion from "collected" reporting.
- `remaining_balance = FEE_ASSIGNMENT.amount − amount_paid − SUM(applicable WAIVER.amount)`. Waivers reduce the effective amount owed without altering the `amount_paid` figure — paid, waived, and remaining must always be independently visible, never collapsed into one adjusted number.
- **Concurrency (added Phase 8 — previously unaddressed)**: `recordPayment`'s overpayment check ("amount ≤ remaining balance") must not be a plain read-then-compare against application-cached state. Two concurrent calls against the same `FEE_ASSIGNMENT` (e.g., a parent's UPI payment and an admin's cash entry landing in the same instant) could otherwise both read the same pre-payment balance and both pass validation, together posting more than the assignment actually owes — exactly the class of error the reconciliation engine exists to prevent. `recordPayment` must acquire a row-level lock on the target `FEE_ASSIGNMENT` (`SELECT ... FOR UPDATE`) inside the same database transaction as the balance check and `TRANSACTION` insert. The second concurrent call blocks until the first transaction commits, then re-reads the now-updated balance before its own check runs. This is the same transactional boundary already required by FR-6 (payment and balance update in one DB transaction) — the lock is an addition to that existing transaction, not a new one.

## 2. Payment-Status State Machine (`FEE_ASSIGNMENT.payment_status`)

```
unpaid ──(any partial payment posted)──▶ partially_paid
unpaid ──(due_date passes, still unpaid)──▶ overdue
partially_paid ──(remaining_balance reaches 0)──▶ paid
partially_paid ──(due_date passes, balance > 0)──▶ overdue
overdue ──(remaining_balance reaches 0)──▶ paid
```

- This status is **recomputed**, not manually set, on every event that changes `amount_paid` or crosses `due_date`: a new transaction posting, a cheque clearing/bouncing, a waiver applying, and the daily scheduled job (for the `due_date`-crossing transition).
- `overdue` with `amount_paid > 0` is a valid and expected state — a partially-paid, overdue assignment. The engine must not conflate "overdue" with "nothing paid."

## 3. Reconciliation-Status State Machine (`TRANSACTION.reconciliation_status`)

```
(new UPI/cash payment) ──▶ posted
(new cheque payment)   ──▶ cheque_pending

posted         ──(anomaly detected)──▶ flagged
posted         ──(admin reverses)──▶ reversed
cheque_pending ──(markChequeCleared)──▶ posted
cheque_pending ──(markChequeBounced)──▶ reversed
flagged        ──(admin resolves anomaly, transaction was valid)──▶ posted
flagged        ──(admin resolves anomaly, transaction was invalid)──▶ reversed
```

- `reversed` is terminal — a reversed transaction is never transitioned again. Correcting a reversed transaction means creating a **new** `TRANSACTION`, not mutating the reversed one. This preserves the audit trail's integrity: history is never rewritten, only appended to.
- A `markChequeBounced` transition must, in the same operation, trigger the `computeDefaulterScore` recompute specified in `business_rules.md` §5 — this is a cross-engine dependency the agent must not miss, since it's easy to implement the state transition correctly while forgetting the downstream defaulter-score effect.
- **"Reopens the fee balance" — exact mechanics (added Phase 8; previously stated three times across documents without being tied to the derivation formula)**: no separate write is needed to "reopen" anything. Because `amount_paid` (section 1 above) is derived by summing only `TRANSACTION` rows with `reconciliation_status = 'posted'`, the moment `markChequeBounced` flips the transaction's status to `reversed`, that row is automatically excluded from the next computation of `amount_paid` — the balance is reopened as a natural consequence of the existing derivation, not a distinct mutation an agent needs to remember to perform. The only writes `markChequeBounced` must actually perform are: the status transition itself, the `AUDIT_LOG` row, and the `computeDefaulterScore` trigger above.

## 4. Reconciliation Matching Mechanics

Restating the exact matching arithmetic from `business_rules.md` §2, since precision here is the product's core claim:

```
expected_amount = FEE_ASSIGNMENT.amount − amount_paid_before_this_transaction
received_amount = TRANSACTION.amount (this event)

if received_amount != expected_amount:
    reconciliation_status = flagged
    ANOMALY_FLAG created with:
        expected_amount, received_amount,
        flag_reason = 'amount_mismatch'
```

- `amount_paid_before_this_transaction` must be computed **before** the current transaction is included in the sum — an off-by-one error here (including the current transaction in its own expected-amount baseline) would make every payment appear anomalous. This is a specific implementation trap worth calling out explicitly for the agent.
- A legitimate partial payment (received < full original fee amount, but matching the actual remaining balance) is **not** an anomaly — only a mismatch against the *expected remaining balance* is.

## 5. GST Calculation Mechanics

- At the moment a `RECEIPT` is generated for a `TRANSACTION`, the engine reads `FEE_TYPE.gst_treatment` and `FEE_TYPE.gst_rate` **as they exist at that moment** and writes the resolved values into `RECEIPT.gst_details` as a snapshot (jsonb). This value is never recalculated later, even if the fee type's GST configuration subsequently changes — historical receipts must reflect what was actually charged at the time.
- If `gst_treatment = exempt`: `gst_amount = 0`, `gst_details` records the exemption basis (e.g., "Exempt — core education service, Notification 12/2017-CT(Rate)") for transparency on the receipt.
- If `gst_treatment = taxable`: **the configured `amount` is always GST-inclusive — decided, not open** (see `business_rules.md` §GST Logic and `decision_log.md` Phase 7 continued). The tax component is back-calculated from the all-inclusive total, never added on top:
  ```
  gst_amount = TRANSACTION.amount × (gst_rate / (100 + gst_rate))
  taxable_base = TRANSACTION.amount − gst_amount
  ```
  There is no exclusive-pricing code path anywhere in this system. Do not implement, test against, or leave a toggle for `amount × (gst_rate / 100)` — that formula belongs to the B2B exclusive-pricing convention this project explicitly ruled out as inapplicable to a parent-as-end-consumer relationship.

## 6. Reporting Query Mechanics

All reporting figures are computed on read, directly from `TRANSACTION` and `FEE_ASSIGNMENT`, never from a separately maintained summary table — this avoids a second source of truth that could drift from the ledger.

```
collected(range) = SUM(TRANSACTION.amount)
    WHERE reconciliation_status = 'posted'
    AND posted_at BETWEEN range.start AND range.end

outstanding = SUM(FEE_ASSIGNMENT.amount − amount_paid)
    WHERE payment_status != 'paid'

revenue_by_channel(range) = collected(range) GROUP BY TRANSACTION.channel
```

- `cheque_pending` is excluded from every "collected" figure by construction (it's excluded from `posted` filter), so no separate exclusion logic is needed in reporting queries — this falls out naturally from the state machine in section 3, which is a deliberate design choice to avoid duplicated filtering logic across modules.
- **`generateReconciliationReport` (added Phase 14)** calls these exact same formulas for its date-range export — it does not introduce a second query path, so an exported figure can never diverge from what the live dashboard computes for the same range. See `decision_log.md` Phase 14.

## Assumptions

- All arithmetic uses `decimal` types throughout; no floating-point money math anywhere in the engine.
- Reporting queries are expected to run directly against Postgres at current scale; a materialized-view or caching layer is a Future Extension if/when volume requires it (see `system_architecture.md` scalability notes).

## Future Extensions

Materialized reporting views for scale, automatic late-fee accrual engine (if decided later), refund-adjacent transaction type and its interaction with the state machine above.

## Open Items

None remaining in this document. The GST-inclusive convention (section 5) was previously listed here as unresolved — that was a documentation-sync defect (the decision was made in Phase 7 but this document's body text was never updated to match); it has been corrected in-place above, not merely noted here. See `decision_log.md` Phase 7 (continued) and Phase 8 for the resolution and the correction respectively.

## References

Mechanics in this document formalize decisions made across Phase 3, Phase 5, and Phase 6 (GST research, cheque state machine, partial-payment derivation) of this project's design process. Policy rationale for each rule lives in `business_rules.md`; this document should not be read as introducing new policy, only precise execution mechanics for policy already established.
