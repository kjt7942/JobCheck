"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import { authService } from "@/services/authService";
import { UserSettings } from "@/types";

// --- Types ---
type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface AppContextType {
  // Auth & User
  user: User | null;
  settings: UserSettings | null;
  loading: boolean;
  // Toasts
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  // Actions
  logout: () => Promise<void>;
  refreshSettings: (uid: string) => Promise<void>;
}

// --- Context ---
const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Provider ---
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Auth Sync with Firebase
  useEffect(() => {
    const unsubscribe = authService.subscribeAuthStatus((user, settings) => {
      setUser(user);
      setSettings(settings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await authService.logout();
      showToast("로그아웃 되었습니다.");
    } catch (error) {
      showToast("로그아웃 중 오류가 발생했습니다.", "error");
    }
  };

  const refreshSettings = async (uid: string) => {
    // 설정만 다시 불러오고 싶을 때 사용
    const { firestoreRepo } = await import("@/repo/firestoreRepository");
    const newSettings = await firestoreRepo.getUserSettings(uid);
    setSettings(newSettings);
  };

  // Toast Logic
  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = {
    user,
    settings,
    loading,
    toasts,
    showToast,
    removeToast,
    logout,
    refreshSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// --- Hook ---
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
