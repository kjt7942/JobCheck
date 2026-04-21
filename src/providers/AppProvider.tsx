"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { FarmSettings } from "@/api/client";

// --- Types ---
type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface AppContextType {
  // Auth
  isAuthenticated: boolean | null;
  setIsAuthenticated: (val: boolean) => void;
  // Settings
  farmInfo: FarmSettings;
  setFarmInfo: (info: FarmSettings) => void;
  // Toasts
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

// --- Context ---
const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Provider ---
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean | null>(null);
  const [farmInfo, setFarmInfo] = useState<FarmSettings>({
    name: "우리 농장",
    region: "서울",
    lat: 37.5665,
    lng: 126.9780,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Auth Sync
  useEffect(() => {
    const auth = sessionStorage.getItem("is_auth");
    setIsAuthenticatedState(auth === "true");
  }, []);

  const setIsAuthenticated = (val: boolean) => {
    setIsAuthenticatedState(val);
    if (val) sessionStorage.setItem("is_auth", "true");
    else sessionStorage.removeItem("is_auth");
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
    isAuthenticated,
    setIsAuthenticated,
    farmInfo,
    setFarmInfo,
    toasts,
    showToast,
    removeToast,
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
