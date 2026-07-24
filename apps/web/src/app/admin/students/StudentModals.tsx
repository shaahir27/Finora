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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1A1C23] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">Add New Student</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#4CAF82]" placeholder="e.g. John Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Class</label>
            <input required type="text" value={className} onChange={e => setClassName(e.target.value)} className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#4CAF82]" placeholder="e.g. 10A" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Admission Number</label>
            <input type="text" value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#4CAF82]" placeholder="e.g. ADM-001" />
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button disabled={isPending} type="submit" className="px-4 py-2 rounded-lg font-medium bg-[#4CAF82] text-white hover:opacity-90 disabled:opacity-50 transition-colors">
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
            // Map CSV rows to student data
            const studentsData = results.data.map((row: any) => ({
              name: row.name || row.Name || row.NAME,
              class: row.class || row.Class || row.CLASS,
              admissionNumber: row.admissionNumber || row.AdmissionNumber || row.admission_number || null,
            })).filter((s) => s.name && s.class); // basic validation

            const { succeeded, failed, skipped } = await bulkImportStudents(schoolId, studentsData);
            alert(`Import complete!\nSucceeded: ${succeeded.length}\nSkipped (exists): ${skipped.length}\nFailed: ${failed.length}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1A1C23] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">Import Students CSV</h2>
        <p className="text-sm text-gray-400 mb-6">CSV must have headers: name, class, admissionNumber</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block w-full cursor-pointer text-center px-4 py-8 bg-white/5 border-2 border-dashed border-white/20 rounded-xl hover:border-[#4CAF82] hover:bg-[#4CAF82]/5 transition-all">
              <span className="text-sm text-gray-300">
                {file ? file.name : "Click to select CSV file"}
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
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button disabled={isPending || !file} type="submit" className="px-4 py-2 rounded-lg font-medium bg-[#4CAF82] text-white hover:opacity-90 disabled:opacity-50 transition-colors">
              {isPending ? "Importing..." : "Import CSV"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
