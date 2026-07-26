"use client";

import { useEffect, useState } from "react";
import { getAllEntries, updateEntryStatus, removeEntry, type OfflinePaymentEntry } from "@/lib/offlineQueue";
import { syncOfflinePayment, getSyncConflicts, resolveSyncConflict } from "@/app/actions/offlineSync";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { OfflineSyncStatusBadge } from "@/components/OfflineSyncStatusBadge";
import { useQuery } from "@tanstack/react-query";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";

export default function OfflineSyncQueuePage() {
  const schoolId = DEMO_SCHOOL_ID;
  const adminId = "admin-123";

  const [localQueue, setLocalQueue] = useState<OfflinePaymentEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Fetch local IndexedDB entries
  const loadLocalQueue = async () => {
    try {
      const entries = await getAllEntries();
      setLocalQueue(entries);
    } catch (err) {
      console.error("Failed to load local offline queue", err);
    }
  };

  useEffect(() => {
    loadLocalQueue();
  }, []);

  // Fetch server conflicts
  const { data: serverConflicts = [], refetch: refetchConflicts } = useQuery({
    queryKey: ['syncConflicts', schoolId],
    queryFn: () => getSyncConflicts(schoolId)
  });

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const entries = await getAllEntries();
      const queued = entries.filter(e => e.status === "queued" || e.status === "conflict");

      for (const entry of queued) {
        await updateEntryStatus(entry.local_id, "syncing");
        loadLocalQueue();

        const res = await syncOfflinePayment(
          entry.local_id,
          entry.fee_assignment_id,
          entry.channel,
          entry.amount,
          entry.queued_at,
          adminId,
          schoolId,
          entry.ref_number
        );

        if (res.success) {
          await removeEntry(entry.local_id);
        } else {
          await updateEntryStatus(entry.local_id, "conflict");
        }
      }
      
      await loadLocalQueue();
      await refetchConflicts();
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveConflict = async (conflictId: string, action: "discarded" | "reentered_adjusted") => {
    const reason = prompt(`Reason for resolving as ${action}:`);
    if (!reason) return;

    setResolvingId(conflictId);
    try {
      await resolveSyncConflict(conflictId, adminId, action, reason);
      await refetchConflicts();
    } catch (err: any) {
      alert("Failed to resolve conflict: " + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Offline Sync Queue</h1>
          <p className="text-text-secondary">Manage pending local payments and resolve server sync conflicts.</p>
        </div>
        <QuickActionButton 
          label={syncing ? "Syncing..." : "Sync Now"} 
          onClick={handleSyncNow} 
          disabled={syncing} 
          className="bg-accent-primary border-none"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">Local Pending Queue (This Device)</h2>
        {localQueue.length === 0 ? (
          <GlassCard className="text-center p-8">
            <p className="text-text-secondary">No pending offline payments on this device.</p>
          </GlassCard>
        ) : (
          localQueue.map(entry => (
            <GlassCard key={entry.local_id} weight="list-row" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-text-primary uppercase">{entry.channel}</span>
                  <span className="text-text-primary font-medium">₹{entry.amount}</span>
                  <OfflineSyncStatusBadge status={entry.status} />
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Queued: {new Date(entry.queued_at).toLocaleString()}
                </p>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary mt-8">Server Sync Conflicts (School-Wide)</h2>
        {serverConflicts.length === 0 ? (
          <GlassCard className="text-center p-8">
            <p className="text-text-secondary">No unresolved sync conflicts.</p>
          </GlassCard>
        ) : (
          serverConflicts.map(conflict => (
            <GlassCard key={conflict.id} weight="list-row" className="border-risk-high/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-text-primary uppercase">{conflict.channel}</span>
                    <span className="text-text-primary font-medium">₹{conflict.amount.toString()}</span>
                    <OfflineSyncStatusBadge status="conflict" />
                  </div>
                  <p className="text-sm text-risk-high font-medium mt-1">
                    Error: {conflict.conflictReason}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    Submitted by Admin {conflict.submittedBy?.email || conflict.submittedById} • {new Date(conflict.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <QuickActionButton 
                    label="Discard" 
                    onClick={() => handleResolveConflict(conflict.id, "discarded")} 
                    disabled={resolvingId === conflict.id}
                  />
                  <QuickActionButton 
                    label="Mark Re-entered" 
                    onClick={() => handleResolveConflict(conflict.id, "reentered_adjusted")} 
                    disabled={resolvingId === conflict.id}
                  />
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
