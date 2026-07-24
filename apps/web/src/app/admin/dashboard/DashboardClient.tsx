"use client";

import { useEffect, useState } from "react";
import { getLedgerSnapshot } from "@/app/actions/ledger";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { MetricCard } from "@/components/MetricCard";
import { ChannelBarChart } from "@/components/ChannelBarChart";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function DashboardClient({ schoolId }: { schoolId: string }) {
  const [realtimeLive, setRealtimeLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const router = useRouter();

  // Subscribe to realtime updates on the transactions table
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `school_id=eq.${schoolId}` },
        () => {
          // Trigger a re-fetch by updating state
          setLastUpdate(Date.now());
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeLive(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setRealtimeLive(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId]);

  const state = useDataState({
    queryKey: ['ledgerSnapshot', schoolId, lastUpdate],
    queryFn: () => getLedgerSnapshot(schoolId, { limit: 10 }),
    isRealtimeLive: realtimeLive,
  });

  const handleExport = () => {
    if (state.status === "success" && state.data) {
      const csvData = [
        ["Metric", "Value"],
        ["Collected Today", state.data.totalCollected],
        ["Outstanding Dues", state.data.outstandingDuesTotal],
        ["Flagged Transactions", state.data.reconciliationStats.flaggedCount]
      ].map(e => e.join(",")).join("\\n");
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Dashboard data exported");
    } else {
      toast.error("Data not loaded yet");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
          <p className="text-text-secondary">Financial overview and real-time metrics.</p>
        </div>
        <div className="flex gap-2">
          <QuickActionButton label="Mark Paid" onClick={() => router.push("/admin/ledger")} />
          <QuickActionButton label="Export" onClick={handleExport} />
        </div>
      </div>

      <FiveStateRenderer state={state}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                label="Collected Today" 
                value={`₹${data.totalCollected}`} 
                deltaText="+12% from yesterday"
                isPositiveDelta={true}
              />
              <MetricCard 
                label="Outstanding Dues" 
                value={`₹${data.outstandingDuesTotal}`} 
                deltaText="Action required"
                isPositiveDelta={false}
              />
              <MetricCard 
                label="Reconciliation Status" 
                value={`${data.reconciliationStats.matchPercentage}%`} 
                deltaText={`${data.reconciliationStats.flaggedCount} flagged transactions`}
                isPositiveDelta={data.reconciliationStats.flaggedCount === 0}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChannelBarChart data={data.revenueByChannel} />
              </div>
              <div>
                <GlassCard className="h-64 flex flex-col items-center justify-center text-center">
                  <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">Recent Transactions</h3>
                  <p className="text-text-secondary text-sm">
                    {data.transactions.length} recent records loaded.
                  </p>
                  <a href="/admin/ledger" className="mt-4 text-accent-primary-text hover:underline text-sm font-medium">
                    View Full Ledger &rarr;
                  </a>
                </GlassCard>
              </div>
            </div>
          </div>
        )}
      </FiveStateRenderer>
    </div>
  );
}
