"use client";

import { useEffect, useState, useMemo } from "react";
import { GlassCard } from "@/components/GlassCard";
import { getMyChildrenDues, getParentLinkId, getParentSchoolId } from "@/app/actions/parents";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export default function ParentDuesPage() {
  const t = useTranslations("Dues");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dues, setDues] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    const parentUserId = sessionStorage.getItem("finora_parent_user_id");
    if (!parentUserId) return;

    // Cache parentLinkId and schoolId for copilot
    if (!sessionStorage.getItem("finora_parent_link_id")) {
      getParentLinkId(parentUserId).then((id) => {
        if (id) sessionStorage.setItem("finora_parent_link_id", id);
      }).catch(console.error);
    }
    if (!sessionStorage.getItem("finora_school_id")) {
      getParentSchoolId(parentUserId).then((id) => {
        if (id) sessionStorage.setItem("finora_school_id", id);
      }).catch(console.error);
    }

    getMyChildrenDues(parentUserId)
      .then((data) => {
        setDues(data);
        if (data.length > 0) {
          // Default to first student found
          setSelectedStudentId(data[0].studentId);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const students = useMemo(() => {
    const map = new Map<string, string>();
    dues.forEach(d => map.set(d.studentId, d.studentName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [dues]);

  const displayedDues = useMemo(() => {
    if (!selectedStudentId) return [];
    return dues.filter(d => d.studentId === selectedStudentId);
  }, [dues, selectedStudentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(76,175,130,0.4)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-status-posted text-white";
      case "unpaid": return "bg-risk-high text-white";
      case "partially_paid": return "bg-status-cheque-pending text-white";
      case "overdue": return "bg-risk-high text-white";
      default: return "bg-white/10 text-text-primary";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t("title")}</h1>
        <p className="text-text-secondary mt-1">{t("subtitle")}</p>
      </div>

      {students.length > 1 && (
        <div className="flex space-x-2 border-b border-border-glass pb-2">
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStudentId(s.id)}
              className={`px-4 py-2 rounded-t-md transition-colors ${selectedStudentId === s.id ? 'bg-white/10 text-text-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:bg-white/5'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {students.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-text-secondary">No active students linked to this account.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4">
          {displayedDues.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-text-secondary">No dues found for this student.</p>
            </GlassCard>
          ) : (
            displayedDues.map((due) => (
              <GlassCard key={due.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium text-text-primary">{due.feeType}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(due.paymentStatus)}`}>
                      {t(due.paymentStatus)}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {t("due_date")}: {due.dueDate}
                  </p>
                </div>

                <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
                  <div className="flex justify-between md:justify-end gap-6 w-full">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-text-secondary uppercase">{t("amount")}</p>
                      <p className="font-medium text-text-primary">₹{due.amount}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xs text-text-secondary uppercase">{t("remaining")}</p>
                      <p className="font-bold text-accent-primary-text text-lg">₹{due.remainingBalance}</p>
                    </div>
                  </div>

                  {due.remainingBalance > 0 && (
                    <button
                      onClick={() => router.push(`/parent/pay?assignmentId=${due.id}&amount=${due.remainingBalance}`)}
                      className="mt-2 w-full md:w-auto px-6 py-2 bg-accent-primary text-white rounded-md font-medium hover:bg-opacity-90 transition-opacity"
                    >
                      {t("pay_now")}
                    </button>
                  )}
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}
    </div>
  );
}
