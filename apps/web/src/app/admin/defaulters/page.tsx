"use client";

import { useEffect, useState } from "react";
import { getDefaulters } from "@/app/actions/defaulters";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { RiskBadge } from "@/components/RiskBadge";

export default function DefaultersPage() {
  const schoolId = "demo-school-id"; // Mocked

  const state = useDataState({
    queryKey: ['defaulters', schoolId],
    queryFn: () => getDefaulters(schoolId),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Defaulter Tracking</h1>
          <p className="text-text-secondary">Students with active, unpaid fee assignments.</p>
        </div>
      </div>

      <FiveStateRenderer state={state}>
        {(data) => {
          if (data.length === 0) {
            return (
              <GlassCard className="text-center p-12">
                <p className="text-text-secondary text-lg">No active defaulters found.</p>
              </GlassCard>
            );
          }

          return (
            <div className="space-y-4">
              {data.map(defaulter => (
                <GlassCard key={defaulter.studentId} weight="list-row" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-text-primary">{defaulter.studentName}</h3>
                      <span className="text-sm text-text-secondary">#{defaulter.admissionNumber}</span>
                      <RiskBadge level={defaulter.riskLevel === 3 ? "high" : defaulter.riskLevel === 2 ? "medium" : "low"} />
                    </div>
                    <p className="text-sm text-text-secondary">
                      Remaining Balance: <span className="font-medium text-text-primary">₹{defaulter.remainingBalance}</span> 
                      {" • "} 
                      {defaulter.maxDaysOverdue} days overdue
                    </p>
                    <p className="text-xs text-text-secondary italic">
                      {defaulter.computedReason}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <QuickActionButton label="Send Reminder" />
                    <QuickActionButton label="Escalate" />
                  </div>
                </GlassCard>
              ))}
            </div>
          );
        }}
      </FiveStateRenderer>
    </div>
  );
}
