"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { createStudent, bulkImportStudents } from "@/app/actions/students";

export function AddStudentModal({
  isOpen,
  onClose,
  schoolId,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createStudent(schoolId, { name, class: className, admissionNumber });
        onSuccess();
        onClose();
        setName("");
        setClassName("");
        setAdmissionNumber("");
      } catch (err: any) {
        alert(err.message || "Failed to add student");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[#F4F1EA] border border-border-glass rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <h2 className="text-xl font-bold text-text-primary">Add New Student</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Full Name *</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white border border-border-glass rounded-xl text-text-primary focus:outline-none focus:border-[#0F5A47] text-sm" placeholder="e.g. Rahul Sharma" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Class *</label>
            <input required type="text" value={className} onChange={e => setClassName(e.target.value)} className="w-full px-4 py-2 bg-white border border-border-glass rounded-xl text-text-primary focus:outline-none focus:border-[#0F5A47] text-sm" placeholder="e.g. Class 10A" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Admission Number</label>
            <input type="text" value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} className="w-full px-4 py-2 bg-white border border-border-glass rounded-xl text-text-primary focus:outline-none focus:border-[#0F5A47] text-sm" placeholder="e.g. ADM-1042" />
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-black/5 transition-colors">
              Cancel
            </button>
            <button disabled={isPending} type="submit" className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:opacity-90 disabled:opacity-50 transition-colors shadow-md">
              {isPending ? "Adding..." : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ImportCsvModal({
  isOpen,
  onClose,
  schoolId,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    startTransition(() => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const studentsData = results.data.map((row: any) => ({
              name: row.name || row.Name || row.NAME,
              class: row.class || row.Class || row.CLASS,
              admissionNumber: row.admissionNumber || row.AdmissionNumber || row.admission_number || null,
            })).filter((s) => s.name && s.class);

            const { succeeded, failed, skipped } = await bulkImportStudents(schoolId, studentsData);
            alert(`Import complete!\nSucceeded: ${succeeded.length}\nSkipped: ${skipped.length}\nFailed: ${failed.length}`);
            onSuccess();
            onClose();
            setFile(null);
          } catch (err: any) {
            alert(err.message || "Import failed");
          }
        },
        error: (error) => {
          alert(`CSV Parse Error: ${error.message}`);
        }
      });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[#F4F1EA] border border-border-glass rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <h2 className="text-xl font-bold text-text-primary mb-1">Import Students CSV</h2>
        <p className="text-xs text-text-secondary mb-4">Required CSV columns: name, class, admissionNumber</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block w-full cursor-pointer text-center px-4 py-8 bg-white border-2 border-dashed border-border-glass rounded-2xl hover:border-[#0F5A47] hover:bg-[#0F5A47]/5 transition-all">
              <span className="text-xs font-medium text-text-secondary">
                {file ? file.name : "Click or drag CSV file here"}
              </span>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={e => setFile(e.target.files?.[0] || null)} 
              />
            </label>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-black/5 transition-colors">
              Cancel
            </button>
            <button disabled={isPending || !file} type="submit" className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:opacity-90 disabled:opacity-50 transition-colors shadow-md">
              {isPending ? "Importing..." : "Import CSV"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

