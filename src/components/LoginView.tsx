"use client";

import { useState } from "react";
import { Sprout, Lock, ArrowRight, ShieldCheck } from "lucide-react";

interface LoginViewProps {
  onLogin: (password: string) => Promise<boolean>;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    
    const success = await onLogin(password);
    if (!success) {
      setError(true);
      setPassword("");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f0f9f0] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="bg-white rounded-3xl shadow-2xl shadow-green-900/10 overflow-hidden border border-green-50">
          {/* Header */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck className="w-24 h-24" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Sprout className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">꿀송이농장</h1>
            </div>
            <p className="text-green-50/80">농장 관리 시스템 접속을 위해 비밀번호를 입력해주세요.</p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600 ml-1 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  비밀번호
                </label>
                <div className="relative group">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-5 py-4 bg-gray-50 border-2 rounded-2xl outline-none transition-all duration-300 focus:bg-white ${
                      error 
                        ? "border-red-200 focus:border-red-400 shake" 
                        : "border-gray-100 focus:border-green-500 group-hover:border-gray-200"
                    }`}
                    autoFocus
                  />
                  {error && (
                    <p className="text-red-500 text-xs mt-2 ml-1 animate-in slide-in-from-top-1">
                      비밀번호가 올바르지 않습니다. 다시 시도해주세요.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    시스템 접속하기
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50/50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © 2026 하네스 엔지니어링 시스템 • 무단 접속 금지
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
