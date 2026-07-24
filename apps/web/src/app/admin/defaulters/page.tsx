"use client";

import { useEffect, useState } from "react";
import { getDefaulters, queueRemindersForStudent, escalateDefaulterScore } from "@/app/actions/defaulters";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { RiskBadge } from "@/components/RiskBadge";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export default function DefaultersPage() {
  const schoolId = "demo-school-id"; // Mocked
  const queryClient = useQueryClient();

  const state = useDataState({
    queryKey: ['defaulters', schoolId],
    queryFn: () => getDefaulters(schoolId),
  });

  const handleSendReminder = async (studentId: string) => {
    try {
      const res = await queueRemindersForStudent(schoolId, studentId);
      if (res.queuedCount > 0) {
        toast.success(`${res.queuedCount} reminder(s) queued successfully!`);
      } else {
        toast.error("No overdue assignments to remind for, or reminder already exists.");
      }
    } catch (err) {
      toast.error("Failed to queue reminder.");
    }
  };

  const handleEscalate = async (studentId: string) => {
    try {
      await escalateDefaulterScore(schoolId, studentId);
      toast.success("Student risk level escalated to High!");
      queryClient.invalidateQueries({ queryKey: ['defaulters', schoolId] });
    } catch (err) {
      toast.error("Failed to escalate.");
    }
  };

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
                    <QuickActionButton label="Send Reminder" onClick={() => handleSendReminder(defaulter.studentId)} />
                    <QuickActionButton label="Escalate" onClick={() => handleEscalate(defaulter.studentId)} />
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
