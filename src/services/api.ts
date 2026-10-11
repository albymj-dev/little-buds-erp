import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Student, Fee, Attendance, FinanceTransaction, ActivityLog } from '../types';

/**
 * Recursively removes all keys with undefined values from an object or array.
 * Firebase Firestore throws an error ("Unsupported field value: undefined")
 * if any field in an object or nested map is undefined.
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
          cleaned[key] = removeUndefinedFields(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned as T;
  }
  return obj;
}

export const logActivity = async (action: string, description: string): Promise<void> => {
  try {
    let userEmail = 'admin@littlebuds.com';
    try {
      const stored = localStorage.getItem('localAuthUser');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.email) userEmail = u.email;
      }
    } catch {
      // fallback
    }
    if (auth.currentUser?.email) {
      userEmail = auth.currentUser.email;
    }

    await addDoc(collection(db, 'activityLogs'), {
      action,
      description,
      userEmail,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

export const getActivityLogs = async (limitCount: number = 50): Promise<ActivityLog[]> => {
  const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
};

// Students
export const getStudents = async (): Promise<Student[]> => {
  const q = query(collection(db, 'students'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
};

export const addStudent = async (student: Omit<Student, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'students'), removeUndefinedFields({
    ...student,
    createdAt: new Date().toISOString()
  }));
  await logActivity('Added Student', `Added new student: ${student.name}`);
  return docRef.id;
};

export const updateStudent = async (id: string, data: Partial<Student>): Promise<void> => {
  await updateDoc(doc(db, 'students', id), removeUndefinedFields(data));
  await logActivity('Updated Student', `Updated student details for ID: ${id}`);
};

export const deleteStudent = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'students', id));
  await logActivity('Deleted Student', `Deleted student with ID: ${id}`);
};

export const deleteFee = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'fees', id));
  await logActivity('Deleted Fee', `Deleted fee with ID: ${id}`);
};

// Fees
export const getFees = async (): Promise<Fee[]> => {
  const q = query(collection(db, 'fees'), orderBy('dueDate', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fee));
};

export const addFee = async (fee: Omit<Fee, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'fees'), removeUndefinedFields({
    ...fee,
    createdAt: new Date().toISOString()
  }));
  await logActivity('Added Fee', `Added a fee of ₹${fee.amount} for student: ${fee.studentName}`);
  return docRef.id;
};

export const updateFeeStatus = async (id: string, status: Fee['status'], amountPaid: number, paymentMode?: string): Promise<void> => {
  const updatePayload: Record<string, any> = { status, amountPaid };
  if (paymentMode !== undefined && paymentMode !== '') {
    updatePayload.paymentMode = paymentMode;
  }
  await updateDoc(doc(db, 'fees', id), removeUndefinedFields(updatePayload));
  await logActivity('Updated Fee Status', `Updated fee ID ${id} to status: ${status}${paymentMode ? ` [Mode: ${paymentMode}]` : ''}`);
};

// Attendance
export const getAttendanceByMonth = async (monthStart: string, monthEnd: string): Promise<Attendance[]> => {
  const q = query(
    collection(db, 'attendance'),
    where('date', '>=', monthStart),
    where('date', '<=', monthEnd)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
};

export const getAttendanceByDate = async (date: string): Promise<Attendance[]> => {
  const q = query(collection(db, 'attendance'), where('date', '==', date));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
};

export const getAttendanceByStudent = async (studentId: string): Promise<Attendance[]> => {
  const q = query(collection(db, 'attendance'), where('studentId', '==', studentId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
};

export const markAttendance = async (attendance: Omit<Attendance, 'id'>): Promise<void> => {
  // Check if exists for this date and student
  const q = query(collection(db, 'attendance'), where('studentId', '==', attendance.studentId), where('date', '==', attendance.date));
  const snapshot = await getDocs(q);
  
  const cleanedData = removeUndefinedFields({ ...attendance }) as any;
  if (cleanedData.therapyType === '') delete cleanedData.therapyType;
  if (cleanedData.notes === '') delete cleanedData.notes;

  if (snapshot.empty) {
    await addDoc(collection(db, 'attendance'), {
      ...cleanedData,
      createdAt: new Date().toISOString()
    });
    await logActivity('Marked Attendance', `Marked ${attendance.studentName} as ${attendance.status} for ${attendance.date}`);
  } else {
    await updateDoc(doc(db, 'attendance', snapshot.docs[0].id), cleanedData);
    await logActivity('Updated Attendance', `Updated attendance for ${attendance.studentName} as ${attendance.status} for ${attendance.date}`);
  }
};

export const getTransactions = async (): Promise<FinanceTransaction[]> => {
  const q = query(collection(db, 'finances'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinanceTransaction));
};

export const addTransaction = async (transaction: Omit<FinanceTransaction, 'id'>): Promise<string> => {
  const rawData: any = {
    ...transaction,
    createdAt: new Date().toISOString()
  };

  if (rawData.partnerName === '') delete rawData.partnerName;
  if (rawData.paymentMode === '') delete rawData.paymentMode;

  // Fully remove any undefined values anywhere in transaction (e.g. depositDetails, assetDetails)
  const dataToSave: any = removeUndefinedFields(rawData);

  const docRef = await addDoc(collection(db, 'finances'), dataToSave);
  let logCategory = `${transaction.type} (${transaction.category})`;
  if (transaction.type === 'Asset' || transaction.purchaseType === 'Asset') {
    logCategory = `Asset Purchase: ${transaction.assetDetails?.assetName || transaction.category}`;
  } else if (transaction.type === 'Investment' || transaction.purchaseType === 'Investment') {
    logCategory = `Partner Capital: ${transaction.partnerName || 'Partner'} (₹${transaction.amount})`;
  } else if (transaction.type === 'Deposit' || transaction.purchaseType === 'Deposit') {
    logCategory = `Security Deposit: ${transaction.depositDetails?.payeeName || transaction.category}`;
  }
  await logActivity('Added Transaction', `Added transaction of ₹${transaction.amount} for ${logCategory}`);
  return docRef.id;
};

export const updateTransaction = async (id: string, data: Partial<FinanceTransaction>): Promise<void> => {
  const rawData: any = { ...data };
  delete rawData.id;
  if (rawData.partnerName === '') delete rawData.partnerName;
  if (rawData.paymentMode === '') delete rawData.paymentMode;

  const dataToUpdate = removeUndefinedFields(rawData);
  await updateDoc(doc(db, 'finances', id), dataToUpdate);
  await logActivity('Updated Transaction', `Updated transaction ID: ${id}`);
};

export const deleteTransaction = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'finances', id));
  await logActivity('Deleted Transaction', `Deleted transaction with ID: ${id}`);
};

export const deleteAttendance = async (studentId: string, date: string): Promise<void> => {
  const q = query(collection(db, 'attendance'), where('studentId', '==', studentId), where('date', '==', date));
  const snapshot = await getDocs(q);
  const deletes = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletes);
  await logActivity('Cleared Attendance', `Cleared attendance for student ID: ${studentId} on ${date}`);
};

export const deleteActivityLog = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'activityLogs', id));
};

export const clearActivityLogs = async (): Promise<void> => {
  const q = query(collection(db, 'activityLogs'), limit(150));
  const snapshot = await getDocs(q);
  const deletes = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletes);
};

export const resetAllSoftwareData = async (): Promise<void> => {
  const collections = ['students', 'fees', 'attendance', 'finances', 'activityLogs'];
  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    const deletes = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletes);
  }
};

