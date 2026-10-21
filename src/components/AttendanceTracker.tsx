import React, { useState, useEffect, useMemo } from 'react';
import { getStudents, getAttendanceByDate, markAttendance, getAttendanceByMonth, deleteAttendance } from '../services/api';
import { Student, Attendance, AttendanceStatus, TherapyType } from '../types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Check,
  X,
  Clock,
  Calendar as CalendarIcon,
  Download,
  Trash2,
  Plus,
  Sparkles,
  BookOpen,
  Search,
  Filter,
  Layers,
  Settings2,
  Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DeleteConfirmModal from './DeleteConfirmModal';
import { ToastContainer, ToastMessage } from './Toast';

export interface ActivitySessionDef {
  key: string;
  label: string;
  shortLabel: string;
  colorClass: string;
  badgeClass: string;
  aliases: string[];
}

const PREDEFINED_SESSIONS: ActivitySessionDef[] = [
  {
    key: 'Speech',
    label: 'Speech & Language',
    shortLabel: 'Speech',
    colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    aliases: ['Speech', 'Speech & Language', 'Speech & Communication']
  },
  {
    key: 'OT',
    label: 'Motor & Sensory Play',
    shortLabel: 'Motor/OT',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    aliases: ['OT', 'Motor & Sensory Play', 'Motor & Physical Play']
  },
  {
    key: 'Special Education',
    label: 'Special Education',
    shortLabel: 'Sp. Education',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    aliases: ['Special Education', 'Behavioral', 'Social Learning', 'Social & Behavioral']
  }
];

const SUGGESTED_CUSTOM_ACTIVITIES = [
  'Art & Craft',
  'Music & Movement',
  'Physiotherapy',
  'Life Skills',
  'Yoga & Calming',
  'Reading & Phonics',
  'Early Numeracy',
  'Hydrotherapy',
  'Computer & Tech Play'
];

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

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('all');

  // Custom Activity Sessions
  const [customSessions, setCustomSessions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('custom_activity_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse custom_activity_sessions', e);
    }
    return ['Art & Craft', 'Music & Movement'];
  });

  // Modal / panel for managing sessions
  const [showManageSessionsModal, setShowManageSessionsModal] = useState(false);
  const [newSessionInput, setNewSessionInput] = useState('');

  // Inline row quick-add popover tracking
  const [inlineAddStudentId, setInlineAddStudentId] = useState<string | null>(null);
  const [inlineSessionInput, setInlineSessionInput] = useState('');

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

  // Save custom sessions to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('custom_activity_sessions', JSON.stringify(customSessions));
    } catch (e) {
      console.error('Failed to save custom_activity_sessions', e);
    }
  }, [customSessions]);

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

      // Auto-discover any custom session names already stored in attendance records
      const allRecordedSessions: string[] = [];
      attendanceData.forEach(a => {
        if (a.therapyTypes && a.therapyTypes.length > 0) {
          a.therapyTypes.forEach(t => t && allRecordedSessions.push(String(t).trim()));
        } else if (a.therapyType) {
          allRecordedSessions.push(String(a.therapyType).trim());
        }
      });

      const predefinedKeysAndAliases = PREDEFINED_SESSIONS.flatMap(s => [s.key, s.label, ...s.aliases]);
      const discoveredCustom = Array.from(
        new Set(allRecordedSessions.filter(s => s && !predefinedKeysAndAliases.includes(s)))
      );

      if (discoveredCustom.length > 0) {
        setCustomSessions(prev => {
          const merged = Array.from(new Set([...prev, ...discoveredCustom]));
          return merged;
        });
      }
    } catch (error) {
      console.error('Failed to load attendance', error);
      addToast('error', 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleMark = async (
    studentId: string,
    studentName: string,
    status: AttendanceStatus,
    types: (TherapyType | string)[] = []
  ) => {
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
      console.error('Failed to mark attendance', error);
      addToast('error', `Failed to record attendance for ${studentName}.`);
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
      console.error('Failed to clear attendance', error);
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
      console.error('Failed to clear all attendance', error);
      addToast('error', 'Failed to clear some attendance records.');
      loadData();
    } finally {
      setIsClearing(false);
    }
  };

  // Helper to check if a session is currently active for a student
  const isSessionChecked = (
    currentTypes: (TherapyType | string)[],
    session: ActivitySessionDef | string
  ): boolean => {
    if (typeof session === 'string') {
      return currentTypes.some(t => String(t).trim().toLowerCase() === session.trim().toLowerCase());
    }
    const allAliases = [session.key, session.label, ...session.aliases].map(a => a.toLowerCase());
    return currentTypes.some(t => allAliases.includes(String(t).trim().toLowerCase()));
  };

  // Toggle predefined or custom session
  const handleSessionToggle = (
    studentId: string,
    studentName: string,
    status: AttendanceStatus,
    session: ActivitySessionDef | string,
    currentTypes: (TherapyType | string)[] = []
  ) => {
    let updated = [...currentTypes];
    if (typeof session === 'string') {
      const sessionClean = session.trim();
      const exists = updated.some(t => String(t).trim().toLowerCase() === sessionClean.toLowerCase());
      if (exists) {
        updated = updated.filter(t => String(t).trim().toLowerCase() !== sessionClean.toLowerCase());
      } else {
        updated.push(sessionClean);
      }
    } else {
      const allAliases = [session.key, session.label, ...session.aliases].map(a => a.toLowerCase());
      const hasIt = updated.some(t => allAliases.includes(String(t).trim().toLowerCase()));
      if (hasIt) {
        updated = updated.filter(t => !allAliases.includes(String(t).trim().toLowerCase()));
      } else {
        // Always store clean standard key ('Special Education', 'Speech', 'OT')
        updated.push(session.key);
      }
    }

    handleMark(studentId, studentName, status, updated);
  };

  // Add a new custom session definition globally
  const handleAddCustomSession = (sessionName: string) => {
    const trimmed = sessionName.trim();
    if (!trimmed) {
      addToast('error', 'Please enter a valid activity session name.');
      return false;
    }

    // Check if duplicate of predefined
    const predefinedMatch = PREDEFINED_SESSIONS.find(
      s => s.label.toLowerCase() === trimmed.toLowerCase() || s.key.toLowerCase() === trimmed.toLowerCase()
    );
    if (predefinedMatch) {
      addToast('info', `"${predefinedMatch.label}" is already available as a standard session.`);
      return false;
    }

    // Check duplicate in customSessions
    const exists = customSessions.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      addToast('info', `Session "${trimmed}" is already in your activity list.`);
      return true; // Return true so inline selector can select it
    }

    setCustomSessions(prev => [...prev, trimmed]);
    addToast('success', `Added custom activity session: "${trimmed}"`);
    return true;
  };

  // Remove a custom session definition from the quick list
  const handleRemoveCustomSession = (sessionName: string) => {
    setCustomSessions(prev => prev.filter(c => c !== sessionName));
    addToast('info', `Removed "${sessionName}" from custom activity options.`);
  };

  // Quick add from row
  const handleInlineAddSession = (student: Student) => {
    const trimmed = inlineSessionInput.trim();
    if (!trimmed) return;

    // Ensure it exists in customSessions
    handleAddCustomSession(trimmed);

    // Toggle it on for this student
    const record = attendance[student.id!];
    const status = record?.status && record.status !== 'Absent' ? record.status : 'Present';
    const currentTypes = record?.therapyTypes || (record?.therapyType ? [record.therapyType] : []);

    const existsOnStudent = currentTypes.some(t => String(t).trim().toLowerCase() === trimmed.toLowerCase());
    if (!existsOnStudent) {
      const updated = [...currentTypes, trimmed];
      handleMark(student.id!, student.name, status, updated);
      addToast('success', `Assigned "${trimmed}" to ${student.name}`);
    }

    setInlineSessionInput('');
    setInlineAddStudentId(null);
  };

  // Format session label for display / export
  const formatSessionLabel = (t: string | TherapyType): string => {
    const str = String(t).trim();
    if (str === 'Speech' || str === 'Speech & Language' || str === 'Speech & Communication') return 'Speech & Language';
    if (str === 'OT' || str === 'Motor & Sensory Play' || str === 'Motor & Physical Play') return 'Motor & Sensory Play';
    if (str === 'Behavioral' || str === 'Social Learning' || str === 'Social & Behavioral' || str === 'Special Education') {
      return 'Special Education';
    }
    return str;
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
      const daysInMonth: string[] = [];
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
          'Total Late': 0
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
          const sessionsList = record.therapyTypes?.length
            ? record.therapyTypes.map(formatSessionLabel).join(', ')
            : record.therapyType
            ? formatSessionLabel(record.therapyType)
            : '';

          const therapiesStr = sessionsList ? `\n(${sessionsList})` : '';
          student[record.date] = record.status + therapiesStr;
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
        ...daysInMonth.map(() => ({ wch: 20 })) // Dates
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `Attendance_${format(dateObj, 'MMM_yyyy')}.xlsx`);
      addToast('success', `Exported attendance spreadsheet for ${format(dateObj, 'MMMM yyyy')}`);
    } catch (error) {
      console.error('Failed to export data', error);
      addToast('error', 'Failed to export attendance spreadsheet.');
    } finally {
      setExporting(false);
    }
  };

  const handleMarkAllPresent = async () => {
    try {
      const promises = students.map(student => {
        if (!attendance[student.id!] || attendance[student.id!].status === 'Absent') {
          return handleMark(
            student.id!,
            student.name,
            'Present',
            attendance[student.id!]?.therapyTypes || []
          );
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      addToast('success', `All students marked present for ${selectedDate}.`);
    } catch (error) {
      console.error('Failed to mark all as present', error);
      addToast('error', 'Failed to mark all as present.');
    }
  };

  // Filter students based on search query and session filter
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Search filter
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.guardianName && student.guardianName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (student.address && student.address.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Session filter
      if (sessionFilter === 'all') return true;

      const record = attendance[student.id!];
      if (!record || record.status === 'Absent') return false;

      const currentTypes = record.therapyTypes || (record.therapyType ? [record.therapyType] : []);

      if (sessionFilter === 'Speech') {
        return isSessionChecked(currentTypes, PREDEFINED_SESSIONS[0]);
      }
      if (sessionFilter === 'OT') {
        return isSessionChecked(currentTypes, PREDEFINED_SESSIONS[1]);
      }
      if (sessionFilter === 'Special Education') {
        return isSessionChecked(currentTypes, PREDEFINED_SESSIONS[2]);
      }

      // Custom session match
      return currentTypes.some(t => String(t).trim().toLowerCase() === sessionFilter.toLowerCase());
    });
  }, [students, attendance, searchQuery, sessionFilter]);

  // Session attendance counters for today
  const sessionCounters = useMemo(() => {
    const counts: Record<string, number> = {
      Speech: 0,
      OT: 0,
      'Special Education': 0
    };
    customSessions.forEach(c => {
      counts[c] = 0;
    });

    (Object.values(attendance) as Attendance[]).forEach(record => {
      if (record.status === 'Absent') return;
      const currentTypes = record.therapyTypes || (record.therapyType ? [record.therapyType] : []);

      if (isSessionChecked(currentTypes, PREDEFINED_SESSIONS[0])) counts['Speech']++;
      if (isSessionChecked(currentTypes, PREDEFINED_SESSIONS[1])) counts['OT']++;
      if (isSessionChecked(currentTypes, PREDEFINED_SESSIONS[2])) counts['Special Education']++;

      customSessions.forEach(c => {
        if (currentTypes.some(t => String(t).trim().toLowerCase() === c.trim().toLowerCase())) {
          counts[c] = (counts[c] || 0) + 1;
        }
      });
    });

    return counts;
  }, [attendance, customSessions]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Header & Main Actions */}
      <div className="sm:flex sm:items-center sm:justify-between border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Attendance & Activity Sessions</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              Live Tracker
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Mark daily attendance and assign early learning, sensory play, special education, and custom activity sessions.
          </p>
        </div>

        <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowManageSessionsModal(true)}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center shadow-sm"
            title="Configure and add custom activity sessions"
          >
            <Settings2 className="w-4 h-4 mr-1.5 text-slate-500" />
            Manage Activity Sessions
          </button>

          <button
            onClick={handleMarkAllPresent}
            className="px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center shadow-sm"
          >
            <Check className="w-4 h-4 mr-1.5" />
            Mark All Present
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>

          {Object.keys(attendance).length > 0 && (
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center"
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
              className="px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
            >
              Today
            </button>
          )}

          <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm border border-gray-300 px-3 py-1.5">
            <CalendarIcon className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => {
                setSelectedDate(e.target.value);
                setIsManualDate(true);
              }}
              className="border-none focus:ring-0 text-sm font-medium text-gray-700 p-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Total Students</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{students.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider block">Present Today</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">
            {(Object.values(attendance) as Attendance[]).filter(a => a.status === 'Present').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-amber-600 uppercase tracking-wider block">Late Arrivals</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {(Object.values(attendance) as Attendance[]).filter(a => a.status === 'Late').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-rose-600 uppercase tracking-wider block">Absent</span>
          <span className="text-2xl font-bold text-rose-600 mt-1 block">
            {(Object.values(attendance) as Attendance[]).filter(a => a.status === 'Absent').length}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl shadow-sm border border-indigo-100">
          <span className="text-xs font-medium text-indigo-700 uppercase tracking-wider block flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Sessions Today
          </span>
          <span className="text-2xl font-bold text-indigo-900 mt-1 block">
            {Object.values(sessionCounters).reduce<number>((a, b) => a + (Number(b) || 0), 0)}
          </span>
        </div>
      </div>

      {/* Activity Session Quick Tally & Pills */}
      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5" /> Activity Tally:
          </span>

          {/* Speech */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            Speech & Lang: <strong>{sessionCounters['Speech'] || 0}</strong>
          </span>

          {/* Motor / Sensory */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            Motor & Sensory: <strong>{sessionCounters['OT'] || 0}</strong>
          </span>

          {/* Special Education */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            Special Education: <strong>{sessionCounters['Special Education'] || 0}</strong>
          </span>

          {/* Custom Sessions */}
          {customSessions.map(c => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200"
            >
              <Tag className="w-3 h-3 text-amber-600" />
              {c}: <strong>{sessionCounters[c] || 0}</strong>
            </span>
          ))}
        </div>

        <button
          onClick={() => setShowManageSessionsModal(true)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2 rounded hover:bg-indigo-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Custom Session
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search students by name, guardian, address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-xs font-medium text-gray-500 shrink-0">Filter Activity:</span>
          <select
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
            className="text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Students ({students.length})</option>
            <option value="Speech">Speech & Language ({sessionCounters['Speech'] || 0})</option>
            <option value="OT">Motor & Sensory Play ({sessionCounters['OT'] || 0})</option>
            <option value="Special Education">Special Education ({sessionCounters['Special Education'] || 0})</option>
            {customSessions.map(c => (
              <option key={c} value={c}>
                {c} ({sessionCounters[c] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance & Activity Sessions Table */}
      <div className="mt-4 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-xl bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sm:pl-6 w-1/4">
                      Child / Student
                    </th>
                    <th className="px-3 py-3.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-44">
                      Attendance Status
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center justify-between">
                        <span>Activity Sessions (Check All That Apply)</span>
                        <button
                          type="button"
                          onClick={() => setShowManageSessionsModal(true)}
                          className="text-xs font-normal text-indigo-600 hover:text-indigo-800 flex items-center gap-1 lowercase"
                        >
                          <Plus className="w-3 h-3" /> add session
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                          <span>Loading attendance records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-gray-500">
                        {students.length === 0 ? (
                          'No students enrolled yet.'
                        ) : (
                          <div>
                            <p className="font-medium text-gray-700">No students matching your filter.</p>
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setSessionFilter('all');
                              }}
                              className="mt-2 text-xs text-indigo-600 hover:underline"
                            >
                              Reset filters
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const record = attendance[student.id!];
                      const isPresentOrLate = record?.status === 'Present' || record?.status === 'Late';
                      const currentTherapyTypes =
                        record?.therapyTypes || (record?.therapyType ? [record.therapyType] : []);

                      const isInlineAddOpen = inlineAddStudentId === student.id;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Student Info */}
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div className="font-semibold text-gray-900">{student.name}</div>
                            {student.guardianName && (
                              <div className="text-xs text-gray-500">
                                Guardian: {student.guardianName}
                                {student.address && (
                                  <span className="text-gray-400 block truncate max-w-xs" title={student.address}>
                                    📍 {student.address}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status Actions */}
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                            <div className="inline-flex items-center gap-1.5 p-1 bg-gray-50 rounded-full border border-gray-200">
                              <button
                                onClick={() => handleMark(student.id!, student.name, 'Present', currentTherapyTypes)}
                                className={`p-1.5 rounded-full transition-all ${
                                  record?.status === 'Present'
                                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1'
                                    : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                                title="Mark Present"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleMark(student.id!, student.name, 'Late', currentTherapyTypes)}
                                className={`p-1.5 rounded-full transition-all ${
                                  record?.status === 'Late'
                                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500 ring-offset-1'
                                    : 'text-gray-400 hover:bg-amber-50 hover:text-amber-600'
                                }`}
                                title="Mark Late"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleMark(student.id!, student.name, 'Absent', [])}
                                className={`p-1.5 rounded-full transition-all ${
                                  record?.status === 'Absent'
                                    ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600 ring-offset-1'
                                    : 'text-gray-400 hover:bg-rose-50 hover:text-rose-600'
                                }`}
                                title="Mark Absent"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              {record?.status && (
                                <button
                                  onClick={() => handleClearSingle(student.id!, student.name)}
                                  className="p-1.5 rounded-full text-gray-400 hover:bg-gray-200 hover:text-red-600 transition-colors"
                                  title="Clear attendance mark for today"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            {record?.status && (
                              <div className="mt-1">
                                <span
                                  className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                                    record.status === 'Present'
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : record.status === 'Late'
                                      ? 'text-amber-700 bg-amber-50'
                                      : 'text-rose-700 bg-rose-50'
                                  }`}
                                >
                                  {record.status}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Activity Sessions Column */}
                          <td className="px-4 py-4 text-sm">
                            {isPresentOrLate ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Predefined Activity Sessions */}
                                {PREDEFINED_SESSIONS.map(session => {
                                  const checked = isSessionChecked(currentTherapyTypes, session);
                                  return (
                                    <label
                                      key={session.key}
                                      className={`inline-flex items-center text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                                        checked
                                          ? `${session.badgeClass} ring-1 ring-offset-0 shadow-sm font-semibold`
                                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-0 mr-1.5 h-3.5 w-3.5 cursor-pointer"
                                        checked={checked}
                                        onChange={() =>
                                          handleSessionToggle(
                                            student.id!,
                                            student.name,
                                            record.status,
                                            session,
                                            currentTherapyTypes
                                          )
                                        }
                                      />
                                      <span>{session.label}</span>
                                    </label>
                                  );
                                })}

                                {/* Custom Activity Sessions */}
                                {customSessions.map(customSession => {
                                  const checked = isSessionChecked(currentTherapyTypes, customSession);
                                  return (
                                    <label
                                      key={customSession}
                                      className={`inline-flex items-center text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                                        checked
                                          ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-300 shadow-sm font-semibold'
                                          : 'bg-white border-amber-200/80 text-amber-800 hover:bg-amber-50/50'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="rounded border-amber-400 text-amber-600 shadow-sm focus:ring-0 mr-1.5 h-3.5 w-3.5 cursor-pointer"
                                        checked={checked}
                                        onChange={() =>
                                          handleSessionToggle(
                                            student.id!,
                                            student.name,
                                            record.status,
                                            customSession,
                                            currentTherapyTypes
                                          )
                                        }
                                      />
                                      <span>{customSession}</span>
                                    </label>
                                  );
                                })}

                                {/* Any other one-off sessions present on this student but not in customSessions */}
                                {currentTherapyTypes
                                  .filter(t => {
                                    if (!t) return false;
                                    const str = String(t).trim();
                                    const isPredefined = PREDEFINED_SESSIONS.some(
                                      s => [s.key, s.label, ...s.aliases].map(a => a.toLowerCase()).includes(str.toLowerCase())
                                    );
                                    if (isPredefined) return false;
                                    const isCustom = customSessions.some(c => c.toLowerCase() === str.toLowerCase());
                                    return !isCustom;
                                  })
                                  .map(extra => {
                                    const extraStr = String(extra).trim();
                                    return (
                                      <span
                                        key={extraStr}
                                        className="inline-flex items-center text-xs px-2.5 py-1.5 rounded-lg bg-teal-100 text-teal-800 border border-teal-300 font-semibold"
                                      >
                                        <span>{extraStr}</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSessionToggle(
                                              student.id!,
                                              student.name,
                                              record.status,
                                              extraStr,
                                              currentTherapyTypes
                                            )
                                          }
                                          className="ml-1 text-teal-600 hover:text-teal-900"
                                          title="Remove this session"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    );
                                  })}

                                {/* Quick inline "+ Custom" button & popover */}
                                <div className="relative inline-block">
                                  {!isInlineAddOpen ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInlineAddStudentId(student.id!);
                                        setInlineSessionInput('');
                                      }}
                                      className="inline-flex items-center text-xs px-2 py-1 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
                                      title="Add custom session for this student"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Custom
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded-lg shadow-md p-1 z-10">
                                      <input
                                        type="text"
                                        autoFocus
                                        placeholder="Activity name (e.g. Art)..."
                                        value={inlineSessionInput}
                                        onChange={e => setInlineSessionInput(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleInlineAddSession(student);
                                          } else if (e.key === 'Escape') {
                                            setInlineAddStudentId(null);
                                          }
                                        }}
                                        className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleInlineAddSession(student)}
                                        className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-medium"
                                      >
                                        Add
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setInlineAddStudentId(null)}
                                        className="text-xs text-gray-400 hover:text-gray-600 p-1"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : record?.status === 'Absent' ? (
                              <span className="text-xs text-rose-500 italic">Student absent - sessions disabled</span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Mark attendance to record sessions</span>
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

      {/* Modal: Add & Manage Custom Activity Sessions */}
      {showManageSessionsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Manage Activity Sessions</h3>
                  <p className="text-xs text-gray-500">Configure standard and custom activities for daily attendance</p>
                </div>
              </div>
              <button
                onClick={() => setShowManageSessionsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Standard Sessions (Read Only) */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Standard Activity Sessions
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {PREDEFINED_SESSIONS.map(s => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.badgeClass}`}></span>
                      <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider bg-gray-200/60 px-2 py-0.5 rounded">
                      Core Session
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Sessions Section */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Custom Activity Sessions ({customSessions.length})
              </h4>

              {/* Add Input */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (handleAddCustomSession(newSessionInput)) {
                    setNewSessionInput('');
                  }
                }}
                className="flex gap-2 mb-3"
              >
                <input
                  type="text"
                  placeholder="Enter activity name (e.g. Art & Craft, Yoga)..."
                  value={newSessionInput}
                  onChange={e => setNewSessionInput(e.target.value)}
                  className="flex-1 text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </form>

              {/* Quick Suggestion Chips */}
              <div className="mb-4">
                <span className="text-[11px] text-gray-400 block mb-1">Click to quickly add popular activities:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_CUSTOM_ACTIVITIES.filter(
                    sugg => !customSessions.some(c => c.toLowerCase() === sugg.toLowerCase())
                  ).map(sugg => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => handleAddCustomSession(sugg)}
                      className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-indigo-500" />
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Custom Sessions List */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {customSessions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2 text-center">
                    No custom sessions configured yet. Type above to add one.
                  </p>
                ) : (
                  customSessions.map(c => (
                    <div
                      key={c}
                      className="flex items-center justify-between p-2 rounded-lg border border-amber-200 bg-amber-50/40 hover:bg-amber-50"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-sm font-medium text-amber-950">{c}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomSession(c)}
                        className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                        title="Delete this custom session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 border-t border-gray-200 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowManageSessionsModal(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Attendance Confirmation */}
      <DeleteConfirmModal
        isOpen={showClearAllConfirm}
        title="Clear All Attendance"
        itemName={`Date: ${selectedDate} (${Object.keys(attendance).length} records)`}
        message="Are you sure you want to clear all attendance marks for this day? This action will remove all recorded statuses and activity sessions for this date."
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
