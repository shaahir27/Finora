/**
 * apps/web/src/lib/offlineQueue.ts
 *
 * Client-side IndexedDB queue for offline cash/cheque payment entries.
 *
 * Design rules (system_architecture.md — Offline Payment Queue, Phase 10):
 * 1. Local storage: browser IndexedDB, written directly from the entry form.
 * 2. Each entry gets a client-generated local_id (UUID) — the idempotency anchor.
 * 3. UPI is REJECTED outright — offline UPI has no meaningful trust model.
 * 4. Queued entries are NOT posted to TRANSACTION until sync succeeds.
 *    The dashboard only reads `posted` TRANSACTION rows — queued entries are
 *    excluded by construction, not by a special-case filter.
 * 5. No sync logic here — sync is the service worker's job (Session 3).
 *    Session 2 only implements the write path.
 *
 * This file is CLIENT-SIDE ONLY. Never import from a Server Action.
 */

import { openDB, type IDBPDatabase } from "idb";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const DB_NAME = "smart_school_offline";
const DB_VERSION = 1;
const STORE_NAME = "offline_payment_queue";

export type OfflineEntryStatus = "queued" | "syncing" | "synced" | "conflict";

export interface OfflinePaymentEntry {
  /** Client-generated UUID — the idempotency anchor. Never changes after creation. */
  local_id: string;
  fee_assignment_id: string;
  /** cash | cheque only — upi is rejected at enqueue time. */
  channel: "cash" | "cheque";
  amount: number;
  ref_number?: string;
  /** ISO string — when the entry was originally created offline, not when sync ran. */
  queued_at: string;
  status: OfflineEntryStatus;
}

type SmartSchoolDB = {
  [STORE_NAME]: {
    key: string;
    value: OfflinePaymentEntry;
    indexes: { by_status: OfflineEntryStatus };
  };
};

// ---------------------------------------------------------------------------
// DB initialisation (singleton pattern — safe to call multiple times)
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<SmartSchoolDB>> | null = null;

export function openQueue(): Promise<IDBPDatabase<SmartSchoolDB>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<SmartSchoolDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: "local_id" });
      store.createIndex("by_status", "status");
    },
  });
  return dbPromise;
}

// ---------------------------------------------------------------------------
// enqueueOfflinePayment
// ---------------------------------------------------------------------------

/**
 * Writes a new offline payment entry to IndexedDB.
 *
 * @throws Error if channel is 'upi' — UPI offline entry is rejected at this layer.
 *
 * Per business_rules.md Offline Payment Entry Strategy:
 * "channel ∈ { cash, cheque } only — rejects upi outright"
 */
export async function enqueueOfflinePayment(entry: {
  fee_assignment_id: string;
  channel: "cash" | "cheque";
  amount: number;
  ref_number?: string;
}): Promise<OfflinePaymentEntry> {
  if ((entry.channel as string) === "upi") {
    throw new Error(
      "UPI payments cannot be queued offline. UPI requires a live server connection."
    );
  }

  const db = await openQueue();
  const record: OfflinePaymentEntry = {
    local_id: crypto.randomUUID(),
    fee_assignment_id: entry.fee_assignment_id,
    channel: entry.channel,
    amount: entry.amount,
    ...(entry.ref_number !== undefined ? { ref_number: entry.ref_number } : {}),
    queued_at: new Date().toISOString(),
    status: "queued",
  };

  await db.put(STORE_NAME, record);
  return record;
}

// ---------------------------------------------------------------------------
// getPendingEntries
// ---------------------------------------------------------------------------

/**
 * Returns all entries currently in 'queued' status.
 * Used by the sync trigger (service worker, Session 3) and the "Sync Now" button.
 */
export async function getPendingEntries(): Promise<OfflinePaymentEntry[]> {
  const db = await openQueue();
  return db.getAllFromIndex(STORE_NAME, "by_status", "queued");
}

// ---------------------------------------------------------------------------
// getAllEntries (for the Offline Queue management UI)
// ---------------------------------------------------------------------------

/**
 * Returns ALL entries regardless of status — for the Offline Sync Queue screen.
 */
export async function getAllEntries(): Promise<OfflinePaymentEntry[]> {
  const db = await openQueue();
  return db.getAll(STORE_NAME);
}

// ---------------------------------------------------------------------------
// updateEntryStatus
// ---------------------------------------------------------------------------

/**
 * Transitions an entry's status.
 * Valid transitions per system_architecture.md:
 *   queued → syncing → synced | conflict
 */
export async function updateEntryStatus(
  localId: string,
  status: OfflineEntryStatus
): Promise<void> {
  const db = await openQueue();
  const entry = await db.get(STORE_NAME, localId);
  if (!entry) {
    throw new Error(`Offline queue entry not found: ${localId}`);
  }
  await db.put(STORE_NAME, { ...entry, status });
}

// ---------------------------------------------------------------------------
// removeEntry (after successful sync)
// ---------------------------------------------------------------------------

/**
 * Removes a synced entry from the local queue.
 * Only called after the server confirms a successful recordPayment.
 */
export async function removeEntry(localId: string): Promise<void> {
  const db = await openQueue();
  await db.delete(STORE_NAME, localId);
}
