import React, { useEffect, useState } from 'react';
import { getStudents, getFees, getAttendanceByDate } from '../services/api';
import { Student, Fee, Attendance } from '../types';
import { Users, CreditCard, Activity, Calendar as CalendarIcon, Search, FileText, ArrowUpRight, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import StudentReportModal from './StudentReportModal';
import { LittleBudsLogo } from './Logo';
import { useTypography } from '../contexts/TypographyContext';
import { StyledWordText } from './StyledWordText';

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    elementFontSizes,
    accentColor,
    secondaryAccentColor,
    brandTitleWords,
    brandSubtitleWords,
    setIsCustomizerOpen,
  } = useTypography();

  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingFees: 0,
    presentToday: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [diagnosisFilter, setDiagnosisFilter] = useState('');
  const [monthYearFilter, setMonthYearFilter] = useState('');
  
  // Modal state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsData, fees, attendance] = await Promise.all([
          getStudents(),
          getFees(),
          getAttendanceByDate(format(new Date(), 'yyyy-MM-dd')),
        ]);

        const pendingFees = fees.filter(f => f.status === 'Pending' || f.status === 'Overdue').reduce((acc, curr) => acc + (curr.amount - curr.amountPaid), 0);
        const presentToday = attendance.filter(a => a.status === 'Present').length;

        setStudents(studentsData);
        setStats({
          totalStudents: studentsData.length,
          pendingFees,
          presentToday,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.guardianContact.includes(searchTerm);
    const matchesDiagnosis = diagnosisFilter ? s.primaryDiagnosis?.toLowerCase().includes(diagnosisFilter.toLowerCase()) : true;
    
    let matchesDate = true;
    if (monthYearFilter) {
      // Month year filter format: YYYY-MM
      matchesDate = s.admissionDate.startsWith(monthYearFilter);
    }

    return matchesSearch && matchesDiagnosis && matchesDate;
  });

  const uniqueDiagnoses = Array.from(new Set(students.map(s => s.primaryDiagnosis).filter(Boolean)));

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center space-y-4">
        <LittleBudsLogo className="w-12 h-12 animate-pulse" />
        <p className="text-sm font-semibold text-stone-500">Loading Centre Dashboard...</p>
      </div>
    );
  }

  const cards = [
    {
      name: 'Total Enrolled Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'text-[#0284C7]',
      bg: 'bg-[#E0F2FE]',
      border: 'border-sky-200',
      badge: 'Active Registry'
    },
    {
      name: 'Pending Fee Dues',
      value: `₹${stats.pendingFees.toLocaleString('en-IN')}`,
      icon: CreditCard,
      color: 'text-[#E53935]',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      badge: 'Action Required'
    },
    {
      name: "Today's Attendance",
      value: stats.presentToday,
      icon: Activity,
      color: 'text-[#558B2F]',
      bg: 'bg-[#ECFCCB]',
      border: 'border-lime-200',
      badge: 'Live Today'
    },
  ];

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Brand Hero Welcome Banner */}
      <div className="bg-linear-to-r from-emerald-800 via-[#365314] to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Warm golden arc glow in background */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 rounded-full border-16 border-[#F5A623]/20 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-white rounded-2xl shadow-md shrink-0">
              <LittleBudsLogo className="w-14 h-14" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <StyledWordText
                  words={brandTitleWords}
                  fontSize={elementFontSizes.brandTitle + 6}
                  className="font-black tracking-tight"
                />
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-stone-950 shadow-xs"
                  style={{ backgroundColor: secondaryAccentColor }}
                >
                  Centre Portal
                </span>
              </div>
              <div className="mt-1">
                <StyledWordText
                  words={brandSubtitleWords}
                  fontSize={elementFontSizes.brandSubtitle}
                  className="font-medium text-stone-200"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-bold text-white/95 hover:text-white bg-white/15 hover:bg-white/25 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/20 transition-all shadow-xs"
              title="Customize Word & Letter Colors"
            >
              <Palette className="w-4 h-4" style={{ color: secondaryAccentColor }} />
              <span>Colours & Fonts</span>
            </button>
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-200 bg-emerald-950/60 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-emerald-700/50">
              <CalendarIcon className="w-4 h-4" style={{ color: secondaryAccentColor }} />
              <span>{format(new Date(), 'EEEE, dd MMMM yyyy')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards using Logo Colors */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.name}
            className={`bg-white rounded-2xl p-6 border ${card.border} shadow-xs hover:shadow-md transition-shadow relative overflow-hidden`}
          >
            <div className="flex items-center justify-between">
              <span
                className="font-bold text-stone-500 uppercase tracking-wider"
                style={{ fontSize: `${elementFontSizes.kpiLabel}px` }}
              >
                {card.name}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.bg} ${card.color}`}>
                {card.badge}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span
                className="font-extrabold text-stone-900"
                style={{ fontSize: `${elementFontSizes.kpiValue}px` }}
              >
                {card.value}
              </span>
              <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                <card.icon className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Quick Actions with Warm Accents */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-200/80 p-6">
        <h2 className="text-sm font-bold text-stone-900 mb-4 flex items-center tracking-wide uppercase">
          <CalendarIcon className="mr-2 h-4 w-4 text-[#F5A623]" />
          Operations Shortcuts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
           <button 
             onClick={() => navigate('/students')}
             className="group p-4 border border-stone-200 rounded-xl text-left bg-stone-50/50 hover:bg-[#F7FEE7] hover:border-lime-300 transition-all flex items-center justify-between">
             <div>
               <p className="text-xs font-bold text-stone-900 group-hover:text-[#365314]">Enroll Student</p>
               <p className="text-[11px] text-stone-500">Add intake profile</p>
             </div>
             <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#65A30D] transition-colors" />
           </button>
           <button 
             onClick={() => navigate('/attendance')}
             className="group p-4 border border-stone-200 rounded-xl text-left bg-stone-50/50 hover:bg-[#E0F2FE] hover:border-sky-300 transition-all flex items-center justify-between">
             <div>
               <p className="text-xs font-bold text-stone-900 group-hover:text-sky-900">Mark Attendance</p>
               <p className="text-[11px] text-stone-500">Track daily sessions</p>
             </div>
             <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-sky-600 transition-colors" />
           </button>
           <button 
             onClick={() => navigate('/fees')}
             className="group p-4 border border-stone-200 rounded-xl text-left bg-stone-50/50 hover:bg-rose-50 hover:border-rose-300 transition-all flex items-center justify-between">
             <div>
               <p className="text-xs font-bold text-stone-900 group-hover:text-rose-900">Fees & Invoices</p>
               <p className="text-[11px] text-stone-500">Collect dues & print</p>
             </div>
             <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-rose-600 transition-colors" />
           </button>
           <button 
             onClick={() => navigate('/reports')}
             className="group p-4 border border-stone-200 rounded-xl text-left bg-stone-50/50 hover:bg-amber-50 hover:border-amber-300 transition-all flex items-center justify-between">
             <div>
               <p className="text-xs font-bold text-stone-900 group-hover:text-amber-900">Partner & Finance</p>
               <p className="text-[11px] text-stone-500">Ledgers, P&L, Capital</p>
             </div>
             <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-amber-600 transition-colors" />
           </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-stone-900 tracking-tight">Active Students Registry</h2>
          <span className="text-xs font-semibold text-stone-500">{filteredStudents.length} students listed</span>
        </div>
        
        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-stone-200/80 flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-1/3">
            <label className="block text-xs font-bold text-stone-700 mb-1 uppercase tracking-wider">Search Name / Phone</label>
            <div className="relative rounded-xl shadow-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-stone-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-xl border-stone-300 pl-10 focus:border-[#74B72E] focus:ring-[#74B72E] text-xs border py-2.5 px-3"
                placeholder="Student or parent..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-xs font-bold text-stone-700 mb-1 uppercase tracking-wider">Developmental Focus</label>
            <select
              className="block w-full rounded-xl border-stone-300 focus:border-[#74B72E] focus:ring-[#74B72E] text-xs border py-2.5 px-3 bg-white"
              value={diagnosisFilter}
              onChange={e => setDiagnosisFilter(e.target.value)}
            >
              <option value="">All Learning Profiles</option>
              {uniqueDiagnoses.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-xs font-bold text-stone-700 mb-1 uppercase tracking-wider">Admission Month</label>
            <input
              type="month"
              className="block w-full rounded-xl border-stone-300 focus:border-[#74B72E] focus:ring-[#74B72E] text-xs border py-2 px-3 bg-white"
              value={monthYearFilter}
              onChange={e => setMonthYearFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white shadow-xs rounded-2xl border border-stone-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">Student Info</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">Guardian Contact</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">Developmental Focus</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">Admission Date</th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-stone-500">
                      No students found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-stone-900">{student.name}</div>
                        <div className="text-xs text-stone-500">DOB: {student.dob}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-stone-900">{student.guardianName}</div>
                        <div className="text-xs text-stone-500 font-mono">{student.guardianContact}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 inline-flex text-xs font-bold rounded-full bg-[#ECFCCB] text-[#365314] border border-[#D9F99D]">
                          {student.developmentalFocus || student.primaryDiagnosis || 'Early Childhood Learning'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-stone-600">
                        {student.admissionDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                        <button 
                          onClick={() => setSelectedStudent(student)}
                          className="text-[#558B2F] hover:text-[#365314] hover:underline inline-flex items-center"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" /> View Report
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

      {selectedStudent && (
        <StudentReportModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
};

export default Dashboard;

