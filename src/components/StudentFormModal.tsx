import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { addStudent, updateStudent, deleteStudent } from '../services/api';
import { X, Trash2, AlertCircle } from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';

interface Props {
  student?: Student;
  onClose: () => void;
  onSave: () => void;
}

const StudentFormModal: React.FC<Props> = ({ student, onClose, onSave }) => {
  const [formData, setFormData] = useState<Omit<Student, 'id' | 'createdAt'>>({
    name: '',
    dob: '',
    guardianName: '',
    guardianContact: '',
    admissionDate: new Date().toISOString().split('T')[0],
    primaryDiagnosis: '',
    medicalHistory: '',
    allergies: '',
    iepGoals: '',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        dob: student.dob,
        guardianName: student.guardianName,
        guardianContact: student.guardianContact,
        admissionDate: student.admissionDate,
        primaryDiagnosis: student.developmentalFocus || student.primaryDiagnosis || '',
        medicalHistory: student.careNotes || student.medicalHistory || '',
        allergies: student.allergies || '',
        iepGoals: student.learningGoals || student.iepGoals || '',
      });
    }
  }, [student]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const payload = {
        ...formData,
        developmentalFocus: formData.primaryDiagnosis,
        careNotes: formData.medicalHistory,
        learningGoals: formData.iepGoals,
      };
      if (student?.id) {
        await updateStudent(student.id, payload);
      } else {
        await addStudent(payload);
      }
      onSave();
    } catch (error: any) {
      console.error("Error saving student:", error);
      setErrorMessage(error?.message || "Failed to save student. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!student?.id) return;
    setIsDeleting(true);
    try {
      await deleteStudent(student.id);
      setShowDeleteConfirm(false);
      onSave();
    } catch (error: any) {
      console.error("Error deleting student:", error);
      setErrorMessage(error?.message || "Failed to delete student.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto"
        onClick={() => !loading && onClose()}
      >
        <div 
          className="relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {student ? 'Edit Student Profile' : 'Add New Student'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Fill out personal, guardian and developmental information.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
              <X className="h-6 w-6" />
            </button>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                <input type="text" name="name" required value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth *</label>
                <input type="date" name="dob" required value={formData.dob} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Guardian Name *</label>
                <input type="text" name="guardianName" required value={formData.guardianName} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Guardian Contact (Phone/WhatsApp) *</label>
                <input type="text" name="guardianContact" required value={formData.guardianContact} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Admission Date *</label>
                <input type="date" name="admissionDate" required value={formData.admissionDate} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Developmental Focus / Learning Profile</label>
                <input type="text" name="primaryDiagnosis" placeholder="e.g. Early Literacy, Social Communication, Creative Play" value={formData.primaryDiagnosis} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Care Notes & Special Instructions</label>
                <textarea name="medicalHistory" rows={2} placeholder="Any dietary routines, nap schedules, calming preferences, or pediatrician notes..." value={formData.medicalHistory} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Allergies & Dietary Restrictions</label>
                <textarea name="allergies" rows={1} placeholder="Food allergies, dust, sensory triggers, etc." value={formData.allergies} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Developmental Milestones & Learning Goals</label>
                <textarea name="iepGoals" rows={3} placeholder="Current developmental milestones, social learning objectives..." value={formData.iepGoals} onChange={handleChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border py-2 px-3" />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3">
              <div>
                {student?.id && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1.5 rounded-md hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete Student
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg border border-transparent bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : student ? 'Update Profile' : 'Save Student'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Student Profile"
        itemName={student?.name}
        message="Are you sure you want to permanently delete this student record? This cannot be undone."
        confirmText="Yes, Delete"
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

export default StudentFormModal;
