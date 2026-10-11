import React, { useState, useEffect } from 'react';
import { getStudents, getAttendanceByDate, markAttendance, getAttendanceByMonth, deleteAttendance } from '../services/api';
import { Student, Attendance, AttendanceStatus, TherapyType } from '../types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Check, X, Clock, Calendar as CalendarIcon, Download, RotateCcw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import DeleteConfirmModal from './DeleteConfirmModal';
import { ToastContainer, ToastMessage } from './Toast';

const AttendanceTracker = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isManualDate, setIsManualDate] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isManualDate) {
        const today = format(new Date(), 'yyyy-MM-dd');
        if (selectedDate !== today) {
          setSelectedDate(today);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedDate, isManualDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsData, attendanceData] = await Promise.all([
        getStudents(),
        getAttendanceByDate(selectedDate)
      ]);
      setStudents(studentsData);
      
      const attendanceMap: Record<string, Attendance> = {};
      attendanceData.forEach(a => {
        attendanceMap[a.studentId] = a;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error("Failed to load attendance", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleMark = async (studentId: string, studentName: string, status: AttendanceStatus, types: TherapyType[] = []) => {
    try {
      await markAttendance({
        studentId,
        studentName,
        date: selectedDate,
        status,
        therapyTypes: types
      });
      // Optimistic update
      setAttendance(prev => ({
        ...prev,
        [studentId]: {
          studentId,
          studentName,
          date: selectedDate,
          status,
          therapyTypes: types
        }
      }));
    } catch (error) {
      console.error("Failed to mark attendance", error);
    }
  };

  const handleClearSingle = async (studentId: string, studentName: string) => {
    try {
      setAttendance(prev => {
        const copy = { ...prev };
        delete copy[studentId];
        return copy;
      });
      await deleteAttendance(studentId, selectedDate);
      addToast('info', `Attendance record for ${studentName} cleared.`);
    } catch (error) {
      console.error("Failed to clear attendance", error);
      addToast('error', `Failed to clear attendance for ${studentName}.`);
      loadData();
    }
  };

  const handleClearAllForDay = async () => {
    setIsClearing(true);
    try {
      const recordsToClear = Object.keys(attendance);
      setAttendance({});
      setShowClearAllConfirm(false);
      await Promise.all(recordsToClear.map(sid => deleteAttendance(sid, selectedDate)));
      addToast('success', `All attendance for ${selectedDate} has been cleared.`);
    } catch (error) {
      console.error("Failed to clear all attendance", error);
      addToast('error', 'Failed to clear some attendance records.');
      loadData();
    } finally {
      setIsClearing(false);
    }
  };

  const handleTherapyToggle = (studentId: string, studentName: string, status: AttendanceStatus, type: TherapyType, currentTypes: TherapyType[] = []) => {
    let newTypes = [...currentTypes];
    if (newTypes.includes(type)) {
      newTypes = newTypes.filter(t => t !== type);
    } else {
      newTypes.push(type);
    }
    handleMark(studentId, studentName, status, newTypes);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const dateObj = new Date(selectedDate);
      const monthStart = startOfMonth(dateObj);
      const monthEnd = endOfMonth(dateObj);
      
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
      
      const attendanceData = await getAttendanceByMonth(monthStartStr, monthEndStr);
      
      // Group by student
      const dataByStudent: Record<string, any> = {};
      
      // Get all dates in the month for headers
      const daysInMonth = [];
      let currentDay = new Date(monthStart);
      while (currentDay <= monthEnd) {
        daysInMonth.push(format(currentDay, 'yyyy-MM-dd'));
        currentDay.setDate(currentDay.getDate() + 1);
      }
      
      students.forEach(s => {
        const studentRecord: Record<string, any> = {
          'Student Name': s.name,
          'Total Present': 0,
          'Total Absent': 0,
          'Total Late': 0,
        };
        // Initialize all days to empty
        daysInMonth.forEach(day => {
          studentRecord[day] = '-';
        });
        dataByStudent[s.id!] = studentRecord;
      });

      attendanceData.forEach(record => {
        const student = dataByStudent[record.studentId];
        if (student) {
          const therapies = record.therapyTypes?.length ? `\n(${record.therapyTypes.join(', ')})` : (record.therapyType ? `\n(${record.therapyType})` : '');
          student[record.date] = record.status + therapies;
          if (record.status === 'Present') student['Total Present']++;
          if (record.status === 'Absent') student['Total Absent']++;
          if (record.status === 'Late') student['Total Late']++;
        }
      });

      // Prepare headers explicitly to maintain order
      const header = ['Student Name', 'Total Present', 'Total Absent', 'Total Late', ...daysInMonth];

      const ws = XLSX.utils.json_to_sheet(Object.values(dataByStudent), { header });
      
      // Adjust column widths
      const wscols = [
        { wch: 25 }, // Student Name
        { wch: 15 }, // Total Present
        { wch: 15 }, // Total Absent
        { wch: 15 }, // Total Late
        ...daysInMonth.map(() => ({ wch: 18 })) // Dates
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      XLSX.writeFile(wb, `Attendance_${format(dateObj, 'MMM_yyyy')}.xlsx`);
      addToast('success', `Exported attendance spreadsheet for ${format(dateObj, 'MMMM yyyy')}`);
    } catch (error) {
      console.error("Failed to export data", error);
      addToast('error', "Failed to export attendance spreadsheet.");
    } finally {
      setExporting(false);
    }
  };

  const handleMarkAllPresent = async () => {
    try {
      const promises = students.map(student => {
        if (!attendance[student.id!] || attendance[student.id!].status === 'Absent') {
           return handleMark(student.id!, student.name, 'Present', attendance[student.id!]?.therapyTypes || []);
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      addToast('success', `All students marked present for ${selectedDate}.`);
    } catch(error) {
      console.error("Failed to mark all as present");
      addToast('error', "Failed to mark all as present.");
    }
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance & Activity Sessions</h1>
          <p className="mt-2 text-sm text-gray-700">Mark daily attendance and track early development & care activities completed.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap items-center space-x-2 gap-y-2">
          <button
            onClick={handleMarkAllPresent}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark All Present
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          {Object.keys(attendance).length > 0 && (
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center"
              title="Clear all recorded attendance for this date"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear Day
            </button>
          )}
          {selectedDate !== format(new Date(), 'yyyy-MM-dd') && (
            <button
              onClick={() => {
                setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                setIsManualDate(false);
              }}
              className="px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100"
            >
              Go to Today
            </button>
          )}
          <div className="flex items-center space-x-2 bg-white rounded-md shadow-sm border border-gray-300 p-2">
            <CalendarIcon className="h-5 w-5 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => {
                setSelectedDate(e.target.value);
                setIsManualDate(true);
              }}
              className="border-none focus:ring-0 text-sm font-medium text-gray-700"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white shadow rounded-lg p-4 flex gap-8">
        <div>
          <span className="text-gray-500 text-sm block">Total Students</span>
          <span className="text-xl font-bold text-gray-900">{students.length}</span>
        </div>
        <div>
          <span className="text-gray-500 text-sm block">Present Today</span>
          <span className="text-xl font-bold text-green-600">
            {(Object.values(attendance) as Attendance[]).filter(a => a.status === 'Present').length}
          </span>
        </div>
        <div>
          <span className="text-gray-500 text-sm block">Late</span>
          <span className="text-xl font-bold text-yellow-600">
            {(Object.values(attendance) as Attendance[]).filter(a => a.status === 'Late').length}
          </span>
        </div>
        <div>
          <span className="text-gray-500 text-sm block">Absent</span>
          <span className="text-xl font-bold text-red-600">
            {(Object.values(attendance) as Attendance[]).filter(a => a.status === 'Absent').length}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Child / Student</th>
                    <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Activity Session (Optional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr><td colSpan={3} className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-10 text-gray-500">No students enrolled.</td></tr>
                  ) : (
                    students.map((student) => {
                      const record = attendance[student.id!];
                      const currentTherapyTypes = record?.therapyTypes || (record?.therapyType ? [record.therapyType] : []);
                      return (
                        <tr key={student.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{student.name}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 flex justify-center space-x-2">
                            <button
                              onClick={() => handleMark(student.id!, student.name, 'Present', currentTherapyTypes)}
                              className={`p-2 rounded-full ${record?.status === 'Present' ? 'bg-green-100 text-green-600 ring-2 ring-green-600 ring-offset-1' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'}`}
                              title="Present"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleMark(student.id!, student.name, 'Late', currentTherapyTypes)}
                              className={`p-2 rounded-full ${record?.status === 'Late' ? 'bg-yellow-100 text-yellow-600 ring-2 ring-yellow-600 ring-offset-1' : 'bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-500'}`}
                              title="Late"
                            >
                              <Clock className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleMark(student.id!, student.name, 'Absent', currentTherapyTypes)}
                              className={`p-2 rounded-full ${record?.status === 'Absent' ? 'bg-red-100 text-red-600 ring-2 ring-red-600 ring-offset-1' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'}`}
                              title="Absent"
                            >
                              <X className="w-5 h-5" />
                            </button>
                            {record?.status && (
                              <button
                                onClick={() => handleClearSingle(student.id!, student.name)}
                                className="p-2 rounded-full bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 border border-gray-200 transition-colors ml-1"
                                title="Clear / delete attendance for this student today"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {record?.status && record.status !== 'Absent' ? (
                              <div className="flex flex-wrap gap-2">
                                {(["Speech", "OT", "Behavioral"] as TherapyType[]).map(type => {
                                  const displayLabel = type === 'Speech' ? 'Speech & Language' : type === 'OT' ? 'Motor & Sensory Play' : 'Social Learning';
                                  return (
                                    <label key={type} className="inline-flex items-center text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-md cursor-pointer hover:bg-indigo-50/50">
                                      <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        checked={currentTherapyTypes.includes(type)}
                                        onChange={() => handleTherapyToggle(student.id!, student.name, record.status, type, currentTherapyTypes)}
                                      />
                                      <span className="ml-1.5 font-medium text-gray-700">{displayLabel}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Not applicable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showClearAllConfirm}
        title="Clear All Attendance"
        itemName={`Date: ${selectedDate} (${Object.keys(attendance).length} records)`}
        message="Are you sure you want to clear all attendance marks for this day? This action will remove all recorded statuses for this date."
        confirmText="Clear Day Records"
        isDeleting={isClearing}
        onConfirm={handleClearAllForDay}
        onCancel={() => setShowClearAllConfirm(false)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default AttendanceTracker;
