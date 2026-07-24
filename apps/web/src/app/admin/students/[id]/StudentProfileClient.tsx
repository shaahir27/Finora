"use client";

import { useState } from "react";
import { getStudentProfile, updateStudentStatus, updateStudent } from "@/app/actions/students";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";


export function StudentProfileClient({ schoolId, studentId }: { schoolId: string, studentId: string }) {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("graduated");
  const [balanceDisposition, setBalanceDisposition] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ name: "", class: "", admissionNumber: "" });

  const state = useDataState({
    queryKey: ['studentProfile', schoolId, studentId],
    queryFn: () => getStudentProfile(schoolId, studentId),
  });

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setUpdateError("");
    try {
      await updateStudentStatus(studentId, "admin-123", {
        status: newStatus as any,
        balanceDisposition: balanceDisposition ? (balanceDisposition as any) : undefined
      });
      setShowStatusModal(false);
      // reload the page to refresh data
      window.location.reload();
    } catch (err: any) {
      setUpdateError(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <FiveStateRenderer state={state}>
        {(data) => {
          // Calculate active balance
          let totalBalance = 0;
          for (const a of data.feeAssignments) {
            let pd = 0;
            let wv = 0;
            for (const tx of a.transactions) {
              if (tx.reconciliationStatus === "posted") pd += tx.amount.toNumber();
            }
            for (const w of a.waivers) wv += w.amount.toNumber();
            const bal = a.amount.toNumber() - pd - wv;
            totalBalance += bal > 0 ? bal : 0;
          }

          return (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-text-primary">{data.name}</h1>
                    <span className={`px-2 py-1 text-xs font-semibold uppercase rounded-full ${data.status === 'active' ? 'bg-risk-low' : 'bg-gray-600'} text-white`}>
                      {data.status}
                    </span>
                  </div>
                  <p className="text-text-secondary">Class {data.class} • #{data.admissionNumber}</p>
                </div>
                <div className="flex gap-2">
                  <QuickActionButton label="Change Status" onClick={() => setShowStatusModal(true)} />
                  <QuickActionButton label="Edit Profile" onClick={() => {
                    setEditData({ name: data.name, class: data.class, admissionNumber: data.admissionNumber || "" });
                    setShowEditModal(true);
                  }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-text-secondary uppercase tracking-wider">Total Balance</div>
                  <div className={`text-3xl font-bold ${totalBalance > 0 ? 'text-risk-high' : 'text-risk-low'}`}>
                    ₹{totalBalance}
                  </div>
                </GlassCard>

                {/* Additional metrics could go here */}
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Fee Assignments</h2>
                {data.feeAssignments.map(assignment => (
                  <GlassCard key={assignment.id} weight="list-row">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-text-primary">{assignment.feeType.name}</h4>
                        <p className="text-sm text-text-secondary">Due: {new Date(assignment.dueDate).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-text-primary">₹{assignment.amount.toString()}</p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Status Change Modal */}
              {showStatusModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                  <GlassCard className="w-full max-w-md bg-bg-base">
                    <h2 className="text-xl font-semibold text-text-primary mb-4">Change Student Status</h2>
                    <form onSubmit={handleStatusChange} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">New Status</label>
                        <select 
                          className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary focus:outline-none focus:border-accent-primary-text"
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="graduated">Graduated</option>
                          <option value="transferred">Transferred</option>
                          <option value="dropped">Dropped</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                      
                      {newStatus !== 'active' && totalBalance > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">Balance Disposition</label>
                          <p className="text-xs text-risk-high mb-2">Student has ₹{totalBalance} remaining balance. How should this be handled?</p>
                          <select
                            required
                            className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary focus:outline-none focus:border-accent-primary-text"
                            value={balanceDisposition}
                            onChange={(e) => setBalanceDisposition(e.target.value)}
                          >
                            <option value="">Select action...</option>
                            <option value="write_off">Write-off as Bad Debt (Waive)</option>
                            <option value="send_collections">Send to Collections</option>
                            <option value="hold_documents">Hold Documents Pending Payment</option>
                            <option value="refund_due">Refund Due</option>
                          </select>
                        </div>
                      )}

                      {updateError && (
                        <div className="text-risk-high text-sm p-2 bg-risk-high/10 rounded border border-risk-high/30">
                          {updateError}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-4">
                        <QuickActionButton type="button" label="Cancel" onClick={() => setShowStatusModal(false)} />
                        <QuickActionButton type="submit" label="Save Changes" disabled={updating} className="bg-accent-primary border-none" />
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}

              {/* Edit Profile Modal */}
              {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                  <GlassCard className="w-full max-w-md bg-bg-base">
                    <h2 className="text-xl font-semibold text-text-primary mb-4">Edit Student Profile</h2>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setUpdating(true);
                      setUpdateError("");
                      try {
                        await updateStudent(studentId, editData);
                        setShowEditModal(false);
                        window.location.reload();
                      } catch (err: any) {
                        setUpdateError(err.message || "Failed to edit profile");
                      } finally {
                        setUpdating(false);
                      }
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Full Name</label>
                        <input required type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary focus:outline-none focus:border-accent-primary-text" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Class</label>
                        <input required type="text" value={editData.class} onChange={e => setEditData({...editData, class: e.target.value})} className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary focus:outline-none focus:border-accent-primary-text" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Admission Number</label>
                        <input type="text" value={editData.admissionNumber} onChange={e => setEditData({...editData, admissionNumber: e.target.value})} className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary focus:outline-none focus:border-accent-primary-text" />
                      </div>
                      
                      {updateError && (
                        <div className="text-risk-high text-sm p-2 bg-risk-high/10 rounded border border-risk-high/30">
                          {updateError}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-4">
                        <QuickActionButton type="button" label="Cancel" onClick={() => setShowEditModal(false)} />
                        <QuickActionButton type="submit" label="Save Changes" disabled={updating} className="bg-accent-primary border-none" />
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}
            </>
          );
        }}
      </FiveStateRenderer>
    </div>
  );
}
