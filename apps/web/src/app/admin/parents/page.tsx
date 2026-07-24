"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { createParentAccount, addStudentToParent } from "@/app/actions/parents";
import { getStudents } from "@/app/actions/students";

export default function AddParentPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [schoolId] = useState("123e4567-e89b-12d3-a456-426614174000"); // Mock or fetch from context
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // For the case where phone is already registered
  const [existingUser, setExistingUser] = useState(false);

  useEffect(() => {
    // Fetch all active students to link
    getStudents(schoolId, { status: "active", limit: 1000 }).then(res => {
      setStudents(res.students);
    }).catch(console.error);
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setExistingUser(false);

    try {
      if (selectedStudentIds.length === 0) {
        throw new Error("Please select at least one student to link.");
      }

      await createParentAccount(schoolId, {
        name,
        phone,
        email: email || undefined,
        studentIds: selectedStudentIds,
      });

      setSuccess(true);
      setName("");
      setPhone("");
      setEmail("");
      setSelectedStudentIds([]);
    } catch (err: any) {
      if (err.message.includes("ALREADY_REGISTERED")) {
        setExistingUser(true);
        setError("This phone number is already registered to a parent account.");
      } else {
        setError(err.message || "Failed to create parent account");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudentToExisting = async () => {
    // In a real app, we'd need to look up the parent by phone to get their ID.
    // For this mock, we just show the flow.
    alert("In a full implementation, this would look up the parent user by phone and call addStudentToParent(parentUserId, studentId)");
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Add Parent</h1>
        <p className="text-text-secondary mt-2">Create a new parent account and link students to it.</p>
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Parent Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-border-glass rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary"
                placeholder="Full Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                pattern="^\+[1-9]\d{1,14}$"
                title="Must be E.164 format (e.g. +919876543210)"
                className="w-full bg-white/5 border border-border-glass rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary"
                placeholder="+919876543210"
              />
              <p className="text-xs text-text-secondary mt-1">Must include country code, e.g., +91</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email Address (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-border-glass rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary"
                placeholder="parent@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Link Students *</label>
              <select
                multiple
                value={selectedStudentIds}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setSelectedStudentIds(values);
                }}
                className="w-full bg-white/5 border border-border-glass rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary h-32"
              >
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.class}) {student.admissionNumber ? `- ${student.admissionNumber}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-secondary mt-1">Hold Ctrl/Cmd to select multiple students.</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-risk-high/20 border border-risk-high/30 rounded-md text-text-primary text-sm">
              {error}
              {existingUser && (
                <button 
                  type="button" 
                  onClick={handleAddStudentToExisting}
                  className="block mt-2 text-accent-primary-text underline hover:text-white"
                >
                  Add selected students to existing account instead
                </button>
              )}
            </div>
          )}

          {success && (
            <div className="p-3 bg-risk-low/20 border border-risk-low/30 rounded-md text-text-primary text-sm">
              Parent account created successfully and students linked.
            </div>
          )}

          <div className="pt-4 border-t border-border-glass flex justify-end">
            <button
              type="submit"
              disabled={loading || selectedStudentIds.length === 0}
              className="px-6 py-2 bg-accent-primary text-white rounded-md font-medium hover:bg-opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Parent Account"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
