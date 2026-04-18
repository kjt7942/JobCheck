"use client";

import { useState, useEffect } from "react";
import { X, Save, MapPin, Home, Sprout } from "lucide-react";

interface FarmInfo {
  name: string;
  region: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmInfo: FarmInfo;
  onSave: (info: FarmInfo) => void;
}

export default function SettingsModal({ isOpen, onClose, farmInfo: initialInfo, onSave }: SettingsModalProps) {
  const [info, setInfo] = useState<FarmInfo>(initialInfo);

  useEffect(() => {
    setInfo(initialInfo);
  }, [initialInfo, isOpen]);

  if (!isOpen) return null;

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
      <div className="relative w-full max-w-md bg-white rounded-[32px] font-sans shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
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
          <p className="text-green-100 text-sm font-medium">우리 농장의 정보를 입력해주세요.</p>
        </div>

        <div className="p-8 space-y-8">
          {/* Farm Name */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
              <Home className="w-3.5 h-3.5" />
              농장 이름
            </label>
            <div className="relative group">
              <input
                type="text"
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                placeholder="예: 푸른 들판 농원"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-400/10 focus:border-green-500 focus:bg-white transition-all duration-200"
              />
            </div>
          </div>

          {/* Region */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
              <MapPin className="w-3.5 h-3.5" />
              지역 설정 (읍/면/동 단위)
            </label>
            <div className="relative">
              <input
                type="text"
                value={info.region}
                onChange={(e) => setInfo({ ...info, region: e.target.value })}
                placeholder="예: 서울특별시 중구 소공동"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-400/10 focus:border-green-500 focus:bg-white transition-all duration-200"
              />
              <p className="mt-2 text-[11px] text-gray-400 leading-relaxed font-medium ml-1">
                * 입력된 지역의 위치를 기반으로 날씨 정보를 가져옵니다.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all duration-200"
            >
              <Save className="w-4 h-4" />
              저장하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
