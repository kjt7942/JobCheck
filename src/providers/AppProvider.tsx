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
    // 리다이렉트 결과 처리 (구글 리다이렉트 로그인 시)
    const checkRedirect = async () => {
      try {
        await authService.handleRedirectResult();
      } catch (err) {
        console.error("AppProvider: Error handling redirect result", err);
      }
    };
    checkRedirect();

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
    const newSettings = await authService.getSettings(uid);
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

  // 파이어베이스 설정 누락 시 안내 화면
  const { auth, db } = require("@/lib/firebase");
  if (!auth || !db) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">설정이 완료되지 않았습니다</h1>
          <p className="text-gray-600 mb-8">
            Vercel 환경 변수(API Key 등)가 설정되지 않았습니다. <br />
            대시보드에서 파이어베이스 설정을 추가한 후 다시 배포해주세요.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm font-mono text-gray-500 overflow-x-auto">
            NEXT_PUBLIC_FIREBASE_API_KEY <br />
            NEXT_PUBLIC_FIREBASE_PROJECT_ID <br />
            ...
          </div>
        </div>
      </div>
    );
  }

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
