import React, { useEffect, useState } from 'react';
import { Student, Attendance, Fee } from '../types';
import { getAttendanceByStudent, getFees } from '../services/api';
import { X, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  student: Student;
  onClose: () => void;
}

const StudentReportModal: React.FC<Props> = ({ student, onClose }) => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [attData, allFees] = await Promise.all([
          getAttendanceByStudent(student.id!),
          getFees()
        ]);
        
        setAttendance(attData);
        setFees(allFees.filter(f => f.studentId === student.id));
      } catch (error) {
        console.error("Failed to load student report data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [student.id]);

  const exportReport = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text('Little Buds Child Care Centre', 14, 20);
    
    doc.setFontSize(16);
    doc.text('Child Comprehensive Report', 14, 30);
    
    doc.setFontSize(12);
    doc.text(`Name: ${student.name}`, 14, 40);
    doc.text(`DOB: ${student.dob}`, 14, 46);
    doc.text(`Guardian: ${student.guardianName} (${student.guardianContact})`, 14, 52);
    doc.text(`Admission Date: ${student.admissionDate}`, 14, 58);
    doc.text(`Developmental Focus: ${student.developmentalFocus || student.primaryDiagnosis || 'Early Childhood Learning'}`, 14, 64);
    
    let yPos = 74;
    
    doc.setFontSize(14);
    doc.text('Fee History', 14, yPos);
    
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Type', 'Due Date', 'Status', 'Amount (Rs)', 'Paid (Rs)']],
      body: fees.map(f => [f.type, f.dueDate, f.status, f.amount, f.amountPaid]),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(14);
    doc.text('Recent Attendance & Activity (Last 30 records)', 14, yPos);
    
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Date', 'Status', 'Program / Activity']],
      body: attendance.slice(0, 30).map(a => [a.date, a.status, a.therapyTypes?.join(', ') || a.therapyType || 'Daycare / Play']),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });
    
    doc.save(`Report_${student.name.replace(/ /g, '_')}.pdf`);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Paid': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Paid</span>;
      case 'Pending': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>;
      case 'Overdue': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Overdue</span>;
      case 'Partially Paid': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Partial</span>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="relative z-10 w-full max-w-4xl transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all flex flex-col max-h-[90vh]">
          <div className="bg-white px-4 py-4 border-b border-gray-200 sm:px-6 flex justify-between items-center shrink-0">
            <h3 className="text-xl font-semibold text-gray-900">
              Student Report: {student.name}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
            {loading ? (
              <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : (
              <div className="space-y-6">
                {/* Profile Overview */}
                <div className="bg-white p-4 shadow rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 border-b pb-2 mb-3">Profile Overview</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Guardian:</span> {student.guardianName}</div>
                    <div><span className="text-gray-500">Contact:</span> {student.guardianContact}</div>
                    <div><span className="text-gray-500">DOB:</span> {student.dob}</div>
                    <div><span className="text-gray-500">Admission:</span> {student.admissionDate}</div>
                    <div><span className="text-gray-500">Developmental Focus:</span> {student.developmentalFocus || student.primaryDiagnosis || 'Early Childhood Learning'}</div>
                    <div className="md:col-span-2"><span className="text-gray-500">Allergies & Dietary:</span> {student.allergies || 'None'}</div>
                    <div className="md:col-span-2"><span className="text-gray-500">Learning Goals:</span> {student.learningGoals || student.iepGoals || 'General Development'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Fee History */}
                  <div className="bg-white p-4 shadow rounded-lg flex flex-col">
                    <h4 className="text-md font-medium text-gray-900 border-b pb-2 mb-3">Fee History</h4>
                    <div className="flex-1 overflow-y-auto max-h-64">
                      {fees.length === 0 ? <p className="text-sm text-gray-500">No fees recorded.</p> : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {fees.map(f => (
                              <tr key={f.id}>
                                <td className="px-3 py-2 text-sm text-gray-900">{f.type}</td>
                                <td className="px-3 py-2 text-sm text-gray-500">{f.dueDate}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">₹{f.amount}</td>
                                <td className="px-3 py-2 text-sm">{getStatusBadge(f.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Attendance History */}
                  <div className="bg-white p-4 shadow rounded-lg flex flex-col">
                    <h4 className="text-md font-medium text-gray-900 border-b pb-2 mb-3">Recent Attendance</h4>
                    <div className="flex-1 overflow-y-auto max-h-64">
                      {attendance.length === 0 ? <p className="text-sm text-gray-500">No attendance recorded.</p> : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program / Activity</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {attendance.map(a => (
                              <tr key={a.id}>
                                <td className="px-3 py-2 text-sm text-gray-900">{a.date}</td>
                                <td className="px-3 py-2 text-sm">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${a.status === 'Present' ? 'bg-green-100 text-green-800' : a.status === 'Absent' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {a.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500">{a.therapyTypes?.join(', ') || a.therapyType || 'Daycare / Play'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 shrink-0 border-t border-gray-200">
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentReportModal;
