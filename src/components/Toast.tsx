"use client";

import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useApp } from "@/providers/AppProvider";

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl backdrop-blur-md 
            animate-in slide-in-from-right-10 fade-in duration-300
            ${toast.type === "success" ? "bg-green-600/90 text-white shadow-green-900/10" : ""}
            ${toast.type === "error" ? "bg-red-600/90 text-white shadow-red-900/10" : ""}
            ${toast.type === "info" ? "bg-blue-600/90 text-white shadow-blue-900/10" : ""}
          `}
        >
          <div className="flex-shrink-0">
            {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-green-100" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-100" />}
            {toast.type === "info" && <Info className="w-5 h-5 text-blue-100" />}
          </div>
          
          <p className="text-sm font-bold min-w-[200px] leading-tight">
            {toast.message}
          </p>

          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
          
          {/* Progress Bar Animation */}
          <div className="absolute bottom-0 left-0 h-1 bg-white/20 rounded-b-2xl overflow-hidden pointer-events-none w-full">
             <div className="h-full bg-white/40 animate-out slide-out-to-left fill-mode-forwards duration-[3000ms]" />
          </div>
        </div>
      ))}
    </div>
  );
}
