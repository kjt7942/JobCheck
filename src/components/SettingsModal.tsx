"use client";

import { useState, useEffect } from "react";
import { X, Save, MapPin, Home, Sprout, CalendarDays, Sun, Moon, LogOut } from "lucide-react";

interface FarmInfo {
  name: string;
  region: string;
  weekStartsOn?: 0 | 1;
  theme?: 'light' | 'dark';
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmInfo: FarmInfo;
  onSave: (info: FarmInfo) => void;
  onLogout?: () => void;
}

export default function SettingsModal({ isOpen, onClose, farmInfo: initialInfo, onSave, onLogout }: SettingsModalProps) {
  const [info, setInfo] = useState<FarmInfo>(initialInfo);

  useEffect(() => {
    if (!initialInfo) return;

    setInfo({
      ...initialInfo,
      weekStartsOn: initialInfo.weekStartsOn ?? 1,
      theme: initialInfo.theme ?? 'light'
    });
  }, [initialInfo, isOpen]);

  if (!isOpen || !initialInfo) return null;

  const handleSave = () => {
    onSave(info);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[var(--card-bg)] rounded-[32px] font-sans shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 border border-[var(--card-border)]">
        <div className="bg-green-600 px-8 py-10 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold">농장 설정</h2>
          </div>
          <p className="text-green-100 text-sm font-medium">관리 시스템의 기본 설정을 변경합니다.</p>
        </div>

        <div className="p-8 space-y-6">
          {/* Theme Option - NEW */}
          <div className="grid grid-cols-2 gap-3 mb-4">
             <button
                onClick={() => setInfo({ ...info, theme: 'light' })}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all border ${
                  info.theme === 'light' 
                    ? "bg-white border-green-200 text-green-700 shadow-sm ring-2 ring-green-500/20" 
                    : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:text-gray-600"
                }`}
              >
                <Sun className={`w-4 h-4 ${info.theme === 'light' ? "animate-spin-slow" : ""}`} />
                라이트 모드
              </button>
              <button
                onClick={() => setInfo({ ...info, theme: 'dark' })}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all border ${
                  info.theme === 'dark' 
                    ? "bg-gray-800 border-gray-700 text-white shadow-lg ring-2 ring-white/10" 
                    : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:text-gray-600"
                }`}
              >
                <Moon className={`w-4 h-4 ${info.theme === 'dark' ? "animate-pulse" : ""}`} />
                다크 모드
              </button>
          </div>

          {/* Farm Name */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
              <Home className="w-3.5 h-3.5" />
              농장 이름
            </label>
            <input
              type="text"
              value={info.name}
              onChange={(e) => setInfo({ ...info, name: e.target.value })}
              placeholder="예: 푸른 들판 농원"
              className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-2xl px-5 py-4 text-sm font-medium text-[var(--foreground)] focus:outline-none focus:ring-4 focus:ring-green-400/10 focus:border-green-500 transition-all duration-200"
            />
          </div>

          {/* Week Start Day Option */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
              <CalendarDays className="w-3.5 h-3.5" />
              주 시작 요일
            </label>
            <div className="grid grid-cols-2 gap-2 bg-[var(--input-bg)] p-1.5 rounded-2xl border border-[var(--card-border)]">
              <button
                onClick={() => setInfo({ ...info, weekStartsOn: 0 })}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${
                  info.weekStartsOn === 0 
                    ? "bg-[var(--card-bg)] text-green-700 shadow-sm ring-1 ring-black/5" 
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                일요일
              </button>
              <button
                onClick={() => setInfo({ ...info, weekStartsOn: 1 })}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${
                  info.weekStartsOn === 1 
                    ? "bg-[var(--card-bg)] text-green-700 shadow-sm ring-1 ring-black/5" 
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                월요일
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 bg-[var(--input-bg)] hover:bg-gray-200/50 transition-all border border-[var(--card-border)]"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all"
            >
              <Save className="w-4 h-4" />
              저장하기
            </button>
          </div>

          {/* Logout Section */}
          {onLogout && (
            <div className="pt-4 border-t border-[var(--card-border)]">
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all border border-red-500/20"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
