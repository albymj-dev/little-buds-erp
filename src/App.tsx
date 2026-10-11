import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TypographyProvider } from './contexts/TypographyContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import StudentsList from './components/StudentsList';
import FeeManagement from './components/FeeManagement';
import AttendanceTracker from './components/AttendanceTracker';
import ReportsFinances from './components/ReportsFinances';
import ActivityLogViewer from './components/ActivityLogViewer';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <TypographyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="students" element={<StudentsList />} />
              <Route path="attendance" element={<AttendanceTracker />} />
              <Route path="fees" element={<FeeManagement />} />
              <Route path="reports" element={<ReportsFinances />} />
              <Route path="activity" element={<ActivityLogViewer />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TypographyProvider>
    </AuthProvider>
  );
}
