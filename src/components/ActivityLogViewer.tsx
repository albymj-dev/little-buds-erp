import React, { useState, useEffect } from 'react';
import { getActivityLogs, deleteActivityLog, clearActivityLogs, resetAllSoftwareData } from '../services/api';
import { ActivityLog } from '../types';
import { format, parseISO } from 'date-fns';
import { Activity, Clock, User, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';
import { ToastContainer, ToastMessage } from './Toast';

const ActivityLogViewer = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logToDelete, setLogToDelete] = useState<ActivityLog | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);
  const [showResetAllSoftware, setShowResetAllSoftware] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
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

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getActivityLogs(100);
      setLogs(data);
    } catch (error) {
      console.error("Failed to load activity logs", error);
      addToast('error', 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleDeleteSingle = async () => {
    if (!logToDelete?.id) return;
    setIsDeleting(true);
    const target = logToDelete;
    try {
      setLogs(prev => prev.filter(l => l.id !== target.id));
      await deleteActivityLog(target.id);
      setLogToDelete(null);
      addToast('success', 'Activity log entry removed.');
    } catch (error) {
      console.error("Failed to delete log entry", error);
      addToast('error', 'Failed to delete log entry.');
      loadLogs();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllLogs = async () => {
    setIsDeleting(true);
    try {
      setLogs([]);
      setShowClearAll(false);
      await clearActivityLogs();
      addToast('success', 'All activity audit logs have been cleared.');
    } catch (error) {
      console.error("Failed to clear activity logs", error);
      addToast('error', 'Failed to clear activity logs.');
      loadLogs();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetAllSoftware = async () => {
    setIsResetting(true);
    try {
      await resetAllSoftwareData();
      setLogs([]);
      setShowResetAllSoftware(false);
      addToast('success', 'Software reset successfully! All records have been cleared to a brand new state.');
    } catch (error) {
      console.error("Failed to reset software data", error);
      addToast('error', 'Failed to reset software data. Please check network connection.');
      loadLogs();
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Activity className="mr-3 h-6 w-6 text-indigo-600" />
            Activity Log
          </h1>
          <p className="mt-2 text-sm text-gray-700">Track changes made by administrators to ensure accountability.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          {logs.length > 0 && (
            <button
              onClick={() => setShowClearAll(true)}
              className="inline-flex items-center px-3 py-2 border border-red-200 rounded-md shadow-sm text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear All Logs
            </button>
          )}
          <button
            onClick={loadLogs}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {logs.length === 0 ? (
            <li className="px-6 py-12 text-center text-gray-500">No recent activity found.</li>
          ) : (
            logs.map((log) => (
              <li key={log.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 mr-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">{log.action}</p>
                      <p className="text-sm text-gray-500">{log.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-end text-sm text-gray-500 space-y-1">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1 text-gray-400" />
                        {log.userEmail}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-gray-400" />
                        {format(parseISO(log.timestamp), 'PP pp')}
                      </div>
                    </div>
                    <button
                      onClick={() => setLogToDelete(log)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Log Entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-10 bg-white border border-rose-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0 mt-0.5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Reset Software to Brand New State
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Wipe all enrolled students, attendance records, fee invoices, finance transactions, and activity audit logs to start completely fresh.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowResetAllSoftware(true)}
            className="inline-flex items-center justify-center px-4 py-2 border border-rose-300 rounded-md shadow-sm text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 whitespace-nowrap self-start sm:self-center"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset All Data
          </button>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={!!logToDelete}
        title="Delete Activity Log Entry"
        itemName={logToDelete ? `${logToDelete.action}: ${logToDelete.description}` : undefined}
        message="Are you sure you want to delete this log entry from the audit history?"
        confirmText="Delete Entry"
        isDeleting={isDeleting}
        onConfirm={handleDeleteSingle}
        onCancel={() => setLogToDelete(null)}
      />

      <DeleteConfirmModal
        isOpen={showClearAll}
        title="Clear All Activity Logs"
        itemName={`Total: ${logs.length} audit entries`}
        message="Are you sure you want to permanently clear all activity audit history? This action cannot be undone."
        confirmText="Clear All Logs"
        isDeleting={isDeleting}
        onConfirm={handleClearAllLogs}
        onCancel={() => setShowClearAll(false)}
      />

      <DeleteConfirmModal
        isOpen={showResetAllSoftware}
        title="Factory Reset All Software Data"
        itemName="Full Application Clean Slate"
        message="Are you sure you want to wipe ALL students, attendance logs, invoices, and financial records? The software will be reset to a completely new state. This action is irreversible."
        confirmText="Reset Entire Software"
        isDeleting={isResetting}
        onConfirm={handleResetAllSoftware}
        onCancel={() => setShowResetAllSoftware(false)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default ActivityLogViewer;
