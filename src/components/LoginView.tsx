"use client";

import { useState } from "react";
import { Sprout, Lock, ArrowRight, ShieldCheck, Mail, User as UserIcon, UserPlus } from "lucide-react";
import { authService } from "@/services/authService";
import { useApp } from "@/providers/AppProvider";

export default function LoginView() {
  const { showToast } = useApp();
  const [isLogin, setIsLogin] = useState(true); // 로그인/회원가입 모드 전환
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      if (isLogin) {
        // 로그인 로직
        await authService.login(email, password);
        showToast("환영합니다! 로그인에 성공했습니다.");
      } else {
        // 회원가입 로직
        if (!userName) {
          showToast("이름을 입력해주세요.", "error");
          setLoading(false);
          return;
        }
        await authService.signup(email, password, userName);
        showToast(`${userName}님, 환영합니다! 계정이 생성되었습니다.`);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(true);
      let message = "인증에 실패했습니다. 다시 시도해주세요.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = "이메일 또는 비밀번호가 올바르지 않습니다.";
      } else if (err.code === 'auth/email-already-in-use') {
        message = "이미 사용 중인 이메일입니다.";
      } else if (err.code === 'auth/weak-password') {
        message = "비밀번호가 너무 취약합니다. (6자 이상)";
      }
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await authService.loginWithGoogle();
      showToast("구글 계정으로 로그인했습니다.");
    } catch (err: any) {
      console.error("Google Login Error:", err);
      let errorMessage = "구글 로그인에 실패했습니다.";

      if (err.code === 'auth/unauthorized-domain') {
        errorMessage = "승인되지 않은 도메인입니다. Firebase 콘솔 설정을 확인해주세요.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = "로그인 창이 닫혔습니다.";
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = "브라우저에서 팝업이 차단되었습니다. 설정을 확인해주세요.";
      } else if (err.code) {
        errorMessage += ` (오류 코드: ${err.code})`;
      }

      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f9f0] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="bg-white rounded-3xl shadow-2xl shadow-green-900/10 overflow-hidden border border-green-50">
          {/* Header */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              {isLogin ? <ShieldCheck className="w-24 h-24" /> : <UserPlus className="w-24 h-24" />}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Sprout className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">꿀송이농장</h1>
            </div>
            <p className="text-green-50/80">
              {isLogin ? "농장 관리 시스템 접속을 위해 로그인해주세요." : "꿀송이농장의 새로운 식구가 되어보세요!"}
            </p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field (Signup only) */}
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1 flex items-center gap-2">
                    <UserIcon className="w-3 h-3" />
                    사용자 이름
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="대장님 / 아내분 등"
                    className="w-full px-5 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-green-500 transition-all"
                    required
                  />
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 ml-1 flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  이메일 (아이디)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full px-5 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-green-500 transition-all"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 ml-1 flex items-center gap-2">
                  <Lock className="w-3 h-3" />
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-5 py-3 bg-gray-50 border-2 rounded-2xl outline-none transition-all ${error ? "border-red-200 focus:border-red-400 shake" : "border-gray-100 focus:border-green-500"
                    }`}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 mt-4 rounded-2xl font-bold text-lg shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? "로그인하기" : "계정 만들기"}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400 font-bold uppercase tracking-widest">Or</span>
              </div>
            </div>

            {/* Google Login Button */}
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white border-2 border-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-200 transition-all duration-300 disabled:opacity-50 shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google로 로그인
              </button>

              <button
                onClick={() => authService.loginWithGoogleRedirect()}
                disabled={loading}
                type="button"
                className="w-full text-xs text-gray-400 hover:text-green-600 transition-colors font-medium py-1"
              >
                계속 실패한다면? <span className="underline decoration-dotted">리다이렉트 방식으로 로그인</span>
              </button>
            </div>

            {/* Toggle Mode */}
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(false);
                }}
                className="text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
              >
                {isLogin ? "새로운 계정이 필요하신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50/50 border-t border-gray-100 text-center">
            <p className="text-[10px] font-bold text-green-800/40 tracking-[0.2em] uppercase mb-1">
              Protected by Firebase Security
            </p>
            <p className="text-xs text-gray-400 font-medium">
              © {new Date().getFullYear()} 꿀송이농장 작업관리시스템
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
    </div >
  );
}
