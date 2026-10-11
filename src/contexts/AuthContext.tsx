import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, AuthCredentials } from '../types';
import { logActivity, removeUndefinedFields } from '../services/api';

const CREDENTIALS_KEY = 'littlebuds_auth_credentials';
const LOCAL_USER_KEY = 'localAuthUser';

export const DEFAULT_CREDENTIALS: AuthCredentials = {
  username: 'admin',
  password: 'admin',
  name: 'Admin User',
  email: 'admin@littlebuds.com',
  role: 'Admin',
  updatedAt: new Date().toISOString()
};

interface UpdateCredentialsParams {
  currentPassword: string;
  newUsername: string;
  newPassword?: string;
  newName?: string;
  newEmail?: string;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  credentials: Omit<AuthCredentials, 'password'>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateCredentials: (params: UpdateCredentialsParams) => Promise<{ success: boolean; error?: string }>;
  resetToDefaultCredentials: () => Promise<void>;
  isAccountModalOpen: boolean;
  setIsAccountModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // In-memory credentials cache initialized from localStorage or defaults
  const [storedCredentials, setStoredCredentials] = useState<AuthCredentials>(() => {
    try {
      const cached = localStorage.getItem(CREDENTIALS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...DEFAULT_CREDENTIALS,
          ...parsed,
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_CREDENTIALS;
  });

  // Load and sync from Firestore & localStorage
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // 1. Check local session
      try {
        const cachedUser = localStorage.getItem(LOCAL_USER_KEY);
        if (cachedUser && isMounted) {
          setCurrentUser(JSON.parse(cachedUser));
        }
      } catch (e) {
        console.warn('Failed to parse cached local user', e);
      }

      // 2. Fetch remote credentials from Firestore systemSettings/authCredentials
      try {
        const credRef = doc(db, 'systemSettings', 'authCredentials');
        const snap = await getDoc(credRef);
        if (snap.exists() && isMounted) {
          const remoteData = snap.data() as AuthCredentials;
          if (remoteData?.username && remoteData?.password) {
            const merged: AuthCredentials = {
              ...DEFAULT_CREDENTIALS,
              ...remoteData,
            };
            setStoredCredentials(merged);
            localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(merged));
          }
        }
      } catch (error) {
        console.warn('Could not sync remote credentials from Firestore, using local cache:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (inputUsername: string, inputPassword: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedUser = inputUsername.trim();
    const activeCreds = storedCredentials;

    // Check credentials against active stored credentials OR fallback to default admin/admin
    const isMatchesCustom = (trimmedUser === activeCreds.username && inputPassword === activeCreds.password);
    const isMatchesDefault = (trimmedUser === 'admin' && inputPassword === 'admin');

    if (isMatchesCustom || isMatchesDefault) {
      const user: User = {
        id: 'admin-account',
        email: activeCreds.email || 'admin@littlebuds.com',
        name: activeCreds.name || 'Admin User',
        role: activeCreds.role || 'Admin',
        username: activeCreds.username,
      };
      setCurrentUser(user);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
      await logActivity('Admin Login', `User "${user.name}" (${user.username || 'admin'}) logged in successfully`);
      return { success: true };
    }

    return { success: false, error: 'Invalid username or password' };
  };

  const logout = async () => {
    if (currentUser) {
      await logActivity('Admin Logout', `User "${currentUser.name}" logged out`);
    }
    setCurrentUser(null);
    localStorage.removeItem(LOCAL_USER_KEY);
  };

  const updateCredentials = async ({
    currentPassword,
    newUsername,
    newPassword,
    newName,
    newEmail,
  }: UpdateCredentialsParams): Promise<{ success: boolean; error?: string }> => {
    const trimmedUsername = newUsername.trim();
    if (!trimmedUsername) {
      return { success: false, error: 'Username cannot be empty.' };
    }

    // Verify current password against stored credentials (or default 'admin')
    const currentMatchesStored = currentPassword === storedCredentials.password;
    const currentMatchesDefault = currentPassword === 'admin';
    if (!currentMatchesStored && !currentMatchesDefault) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    // Validate new password if provided
    let finalPassword = storedCredentials.password;
    if (newPassword && newPassword.trim() !== '') {
      if (newPassword.length < 4) {
        return { success: false, error: 'New password must be at least 4 characters long.' };
      }
      finalPassword = newPassword;
    }

    const updatedCreds: AuthCredentials = {
      username: trimmedUsername,
      password: finalPassword,
      name: newName?.trim() || storedCredentials.name || 'Admin User',
      email: newEmail?.trim() || storedCredentials.email || 'admin@littlebuds.com',
      role: 'Admin',
      updatedAt: new Date().toISOString()
    };

    // Save locally
    setStoredCredentials(updatedCreds);
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updatedCreds));

    // Update current active user in context & localStorage
    const updatedUser: User = {
      id: 'admin-account',
      email: updatedCreds.email,
      name: updatedCreds.name,
      role: updatedCreds.role,
      username: updatedCreds.username,
    };
    setCurrentUser(updatedUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updatedUser));

    // Sync to Firestore
    try {
      const credRef = doc(db, 'systemSettings', 'authCredentials');
      await setDoc(credRef, removeUndefinedFields(updatedCreds), { merge: true });
    } catch (err) {
      console.warn('Failed to sync updated credentials to Firestore:', err);
    }

    await logActivity(
      'Updated Credentials',
      `Admin updated credentials. Username set to "${trimmedUsername}". Password changed: ${Boolean(newPassword && newPassword.trim())}`
    );

    return { success: true };
  };

  const resetToDefaultCredentials = async (): Promise<void> => {
    const resetCreds: AuthCredentials = {
      ...DEFAULT_CREDENTIALS,
      updatedAt: new Date().toISOString()
    };

    setStoredCredentials(resetCreds);
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(resetCreds));

    if (currentUser) {
      const updatedUser: User = {
        id: 'admin-account',
        email: resetCreds.email,
        name: resetCreds.name,
        role: resetCreds.role,
        username: resetCreds.username,
      };
      setCurrentUser(updatedUser);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updatedUser));
    }

    try {
      const credRef = doc(db, 'systemSettings', 'authCredentials');
      await setDoc(credRef, removeUndefinedFields(resetCreds), { merge: true });
    } catch (err) {
      console.warn('Failed to reset credentials in Firestore:', err);
    }

    await logActivity('Reset Credentials', 'Admin credentials were reset to default (admin / admin)');
  };

  const safeCredentials = {
    username: storedCredentials.username,
    name: storedCredentials.name,
    email: storedCredentials.email,
    role: storedCredentials.role,
    updatedAt: storedCredentials.updatedAt
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        credentials: safeCredentials,
        login,
        logout,
        updateCredentials,
        resetToDefaultCredentials,
        isAccountModalOpen,
        setIsAccountModalOpen,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

