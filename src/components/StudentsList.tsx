import React, { useState, useEffect } from 'react';
import { getStudents, deleteStudent } from '../services/api';
import { Student } from '../types';
import { Plus, Search, FileText, Trash2, Award, ClipboardList } from 'lucide-react';
import StudentFormModal from './StudentFormModal';
import StudentReportModal from './StudentReportModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { ToastContainer, ToastMessage } from './Toast';

const StudentsList = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>();
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (error) {
      console.error("Failed to load students", error);
      addToast('error', 'Failed to load students list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    const deletedId = studentToDelete.id;
    const deletedName = studentToDelete.name;

    try {
      // Optimistic update
      setStudents(prev => prev.filter(s => s.id !== deletedId));
      await deleteStudent(deletedId);
      setStudentToDelete(null);
      addToast('success', `Student "${deletedName}" has been deleted.`);
    } catch (error) {
      console.error("Failed to delete student", error);
      addToast('error', `Failed to delete "${deletedName}". Please try again.`);
      loadStudents(); // Revert on failure
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.guardianName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Children & Students</h1>
          <p className="mt-2 text-sm text-gray-700">A directory of all enrolled children including their developmental focus, care notes, and guardian details.</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:flex-none">
          <button
            onClick={() => {
              setSelectedStudent(undefined);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative rounded-md shadow-sm max-w-sm w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 px-3 border"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Guardian</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Developmental Focus</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Admission Date</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-500">No students found</td></tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{student.name}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {student.guardianName}
                          <div className="text-xs text-gray-400">{student.guardianContact}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold leading-5 text-indigo-700 border border-indigo-100">
                            {student.developmentalFocus || student.primaryDiagnosis || 'Early Childhood Learning'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{student.admissionDate}</td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2 flex justify-end items-center">
                          <button
                            onClick={() => setReportStudent(student)}
                            className="text-[#558B2F] hover:text-[#3e6820] bg-emerald-50 hover:bg-emerald-100/70 px-2.5 py-1.5 rounded-lg inline-flex items-center text-xs font-bold transition-colors"
                            title="Generate Comprehensive Student Progress & Attendance Report"
                          >
                            <ClipboardList className="w-3.5 h-3.5 mr-1" /> Report
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1.5 rounded-lg inline-flex items-center text-xs font-bold transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1" /> View/Edit
                          </button>
                          <button
                            onClick={() => setStudentToDelete({id: student.id!, name: student.name})}
                            className="text-red-600 hover:text-red-900 hover:bg-red-50 p-1.5 rounded-lg inline-flex items-center transition-colors"
                            title="Delete Student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {isModalOpen && (
        <StudentFormModal 
          student={selectedStudent} 
          onClose={() => setIsModalOpen(false)} 
          onSave={() => {
            setIsModalOpen(false);
            loadStudents();
          }} 
        />
      )}

      {reportStudent && (
        <StudentReportModal
          student={reportStudent}
          onClose={() => setReportStudent(null)}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!studentToDelete}
        title="Delete Student Record"
        itemName={studentToDelete?.name}
        message="Are you sure you want to delete this student? All historical attendance and fee details associated with this student will remain in records, but the student profile will be removed."
        confirmText="Delete Student"
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setStudentToDelete(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default StudentsList;
