"use client";

import { useState } from "react";
import { getStudents } from "@/app/actions/students";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";

export default function StudentsDirectoryPage() {
  const schoolId = "demo-school-id"; // Mocked
  const [search, setSearch] = useState("");

  const state = useDataState({
    queryKey: ['students', schoolId, search],
    queryFn: () => getStudents(schoolId, { search, limit: 50 }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Student Directory</h1>
          <p className="text-text-secondary">Manage students and their accounts.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search by name or admission #" 
            className="px-4 py-2 rounded-md border border-border-glass bg-surface-glass text-text-primary focus:outline-none focus:border-accent-primary-text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <QuickActionButton label="Import CSV" />
          <QuickActionButton label="Add Student" />
        </div>
      </div>

      <FiveStateRenderer state={state}>
        {(data) => {
          if (data.students.length === 0) {
            return (
              <GlassCard className="text-center p-12">
                <p className="text-text-secondary text-lg">No students found.</p>
              </GlassCard>
            );
          }

          return (
            <div className="space-y-4">
              {data.students.map(student => (
                <GlassCard key={student.id} weight="list-row" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-text-primary">{student.name}</h3>
                      <span className="text-sm text-text-secondary">#{student.admissionNumber}</span>
                      {student.status !== "active" && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-gray-500 text-white">
                          {student.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">
                      Class: {student.class}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-text-secondary uppercase tracking-wide">Balance</p>
                      <p className={`font-medium ${student.totalBalance > 0 ? "text-risk-high" : "text-risk-low"}`}>
                        ₹{student.totalBalance}
                      </p>
                    </div>
                    <a href={`/admin/students/${student.id}`} className="text-accent-primary-text hover:underline text-sm font-medium">
                      View Profile &rarr;
                    </a>
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
