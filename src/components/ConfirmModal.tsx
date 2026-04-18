"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "확인",
  cancelText = "취소",
  type = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const accentColor = type === 'danger' ? 'orange' : 'green';
  const buttonBg = type === 'danger' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-green-600 hover:bg-green-700 shadow-green-600/20';
  const iconBg = type === 'danger' ? 'bg-orange-50' : 'bg-green-50';
  const iconColor = type === 'danger' ? 'text-orange-500' : 'text-green-600';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onCancel}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-sm bg-white rounded-[32px] font-sans shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="p-8">
            <div className="flex flex-col items-center text-center">
                <div className={`p-4 ${iconBg} rounded-2xl mb-6`}>
                    <AlertTriangle className={`w-8 h-8 ${iconColor}`} />
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">
                    {message}
                </p>

                <div className="flex gap-3 w-full">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-400 bg-gray-50 hover:bg-gray-100 transition-all duration-200"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-[1.5] px-6 py-4 rounded-2xl text-sm font-bold text-white ${buttonBg} shadow-lg active:scale-[0.98] transition-all duration-200`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
