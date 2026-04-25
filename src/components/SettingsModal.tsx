"use client";

import { useState, useEffect } from "react";
import { X, Save, Home, Sprout, CalendarDays, Sun, Moon, LogOut, Users, Shield, ShieldCheck, Trash2, Loader2, Check, Lock, Unlock, Bell } from "lucide-react";
import { UserSettings } from "@/types";
import { adminService } from "@/services/adminService";
import { useApp } from "@/providers/AppProvider";
import { firestoreRepo } from "@/repo/firestoreRepository";

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
  unreadCount?: number;
}

type Tab = 'general' | 'users';

export default function SettingsModal({ isOpen, onClose, farmInfo: initialInfo, onSave, onLogout, unreadCount = 0 }: SettingsModalProps) {
  const { user, settings, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [info, setInfo] = useState<FarmInfo>(initialInfo);
  const [allUsers, setAllUsers] = useState<UserSettings[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!initialInfo) return;

    setInfo({
      ...initialInfo,
      weekStartsOn: initialInfo.weekStartsOn ?? 1,
      theme: initialInfo.theme ?? 'light'
    });

    // 모달이 열릴 때 일반 탭으로 초기화
    if (isOpen) setActiveTab('general');
  }, [initialInfo, isOpen]);

  // 사용자 리스트 로드 및 알림 읽음 처리
  useEffect(() => {
    if (isOpen && activeTab === 'users' && settings?.role === 'admin') {
      loadUsers();
      // 알림 모두 읽음 처리
      firestoreRepo.markAllNotificationsAsRead();
    }
  }, [isOpen, activeTab, settings?.role]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await adminService.fetchAllUsers();
      setAllUsers(users);
    } catch (error) {
      showToast("사용자 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUpdateUser = async (uid: string, updates: Partial<UserSettings>) => {
    if (!user?.email) return;
    setProcessingUid(uid);
    try {
      await adminService.updateUserAuth(uid, updates, user.email);
      showToast("권한이 업데이트되었습니다.");
      await loadUsers(); // 리스트 갱신
    } catch (error: any) {
      showToast(error.message || "업데이트에 실패했습니다.", "error");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleRemoveUser = async (uid: string) => {
    if (!confirm("이 사용자를 정말 삭제하시겠습니까? 설정 데이터가 모두 삭제됩니다.")) return;
    setProcessingUid(uid);
    try {
      await adminService.removeUser(uid);
      showToast("사용자가 삭제되었습니다.");
      await loadUsers();
    } catch (error: any) {
      showToast(error.message || "삭제에 실패했습니다.", "error");
    } finally {
      setProcessingUid(null);
    }
  };

  if (!isOpen || !initialInfo) return null;

  const handleSave = () => {
    onSave(info);
    onClose();
  };

  const isAdmin = settings?.role === 'admin';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[var(--card-bg)] rounded-[32px] font-sans shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 border border-[var(--card-border)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-green-600 px-8 py-8 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold">농장 설정</h2>
          </div>
          <p className="text-green-100 text-sm font-medium">관리 시스템의 환경 및 권한을 설정합니다.</p>

          {/* Tabs */}
          {isAdmin && (
            <div className="flex gap-2 mt-6 bg-black/10 p-1.5 rounded-2xl w-fit">
              <button
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'general' ? "bg-white text-green-700 shadow-md" : "text-white/70 hover:text-white"
                  }`}
              >
                <Sun className="w-4 h-4" />
                기본 설정
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all relative ${activeTab === 'users' ? "bg-white text-green-700 shadow-md" : "text-white/70 hover:text-white"
                  }`}
              >
                <Users className="w-4 h-4" />
                사용자 관리
                {unreadCount > 0 && activeTab !== 'users' && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full border border-green-600 animate-pulse" />
                )}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              {/* Theme Option */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setInfo({ ...info, theme: 'light' })}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all border ${info.theme === 'light'
                    ? "bg-white border-green-200 text-green-700 shadow-sm ring-2 ring-green-500/20"
                    : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:text-gray-600"
                    }`}
                >
                  <Sun className="w-4 h-4" />
                  라이트 모드
                </button>
                <button
                  onClick={() => setInfo({ ...info, theme: 'dark' })}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all border ${info.theme === 'dark'
                    ? "bg-gray-800 border-gray-700 text-white shadow-lg ring-2 ring-white/10"
                    : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:text-gray-600"
                    }`}
                >
                  <Moon className="w-4 h-4" />
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
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-2xl px-5 py-4 text-sm font-medium text-[var(--foreground)] focus:outline-none focus:ring-4 focus:ring-green-400/10 focus:border-green-500 transition-all"
                />
              </div>

              {/* Week Start Day */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  주 시작 요일
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[var(--input-bg)] p-1.5 rounded-2xl border border-[var(--card-border)]">
                  <button
                    onClick={() => setInfo({ ...info, weekStartsOn: 0 })}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${info.weekStartsOn === 0
                      ? "bg-[var(--card-bg)] text-green-700 shadow-sm ring-1 ring-black/5"
                      : "text-gray-400 hover:text-gray-600"
                      }`}
                  >
                    일요일
                  </button>
                  <button
                    onClick={() => setInfo({ ...info, weekStartsOn: 1 })}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${info.weekStartsOn === 1
                      ? "bg-[var(--card-bg)] text-green-700 shadow-sm ring-1 ring-black/5"
                      : "text-gray-400 hover:text-gray-600"
                      }`}
                  >
                    월요일
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 bg-[var(--input-bg)] hover:bg-gray-200/50 transition-all border border-[var(--card-border)]"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  className="flex-[2] flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg active:scale-[0.98] transition-all"
                >
                  <Save className="w-4 h-4" />
                  저장하기
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center py-20 text-green-600 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-medium">사용자 정보를 불러오는 중...</p>
                </div>
              ) : (
                <>
                  {allUsers.some(u => u.role !== 'admin' && !u.permissions?.canRead) && (
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                      <Bell className="w-5 h-5 text-orange-500" />
                      <p className="text-xs font-bold text-orange-700">권한 승인이 필요한 신규 사용자가 있습니다.</p>
                    </div>
                  )}
                  {allUsers.map((u) => (
                    <div key={u.user_id} className="bg-[var(--input-bg)] border border-[var(--card-border)] rounded-2xl p-5 space-y-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${u.role === 'admin' ? 'bg-orange-500/10 text-orange-600' : 'bg-gray-500/10 text-gray-500'}`}>
                            {u.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{u.user_name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateUser(u.user_id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                            disabled={processingUid === u.user_id}
                            className={`p-2 rounded-xl transition-all ${u.role === 'admin'
                              ? 'bg-orange-500 text-white shadow-lg'
                              : 'bg-white border border-[var(--card-border)] text-gray-400 hover:text-orange-500'
                              }`}
                            title={u.role === 'admin' ? "관리자 권한 해제" : "관리자로 임명"}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveUser(u.user_id)}
                            disabled={processingUid === u.user_id}
                            className="p-2 rounded-xl bg-white border border-[var(--card-border)] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--card-border)]/50">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">권한 설정</p>
                        <div className="flex gap-1.5">
                          {[
                            { key: 'canRead', label: '읽기', icon: u.permissions?.canRead ? Unlock : Lock },
                            { key: 'canWrite', label: '쓰기', icon: u.permissions?.canWrite ? Save : Lock },
                            { key: 'canDelete', label: '삭제', icon: u.permissions?.canDelete ? Trash2 : Lock }
                          ].map((p) => {
                            const Icon = p.icon;
                            const permissions = u.permissions || { canRead: false, canWrite: false, canDelete: false };
                            const hasPermission = (permissions as any)[p.key];
                            return (
                              <button
                                key={p.key}
                                onClick={() => handleUpdateUser(u.user_id, {
                                  permissions: { ...(u.permissions || { canRead: false, canWrite: false, canDelete: false }), [p.key]: !hasPermission }
                                })}
                                disabled={processingUid === u.user_id}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${hasPermission
                                  ? "bg-green-500/10 border-green-500/20 text-green-600"
                                  : "bg-gray-100 border-gray-200 text-gray-400"
                                  }`}
                              >
                                <Icon className="w-3 h-3" />
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Logout button (at the bottom) */}
          {activeTab === 'general' && onLogout && (
            <div className="mt-8 pt-6 border-t border-[var(--card-border)]">
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
