"use client";
console.log("Client: JS file evaluation started");

import { useState, useEffect } from "react";
import { CalendarDays, Calendar, ListTodo, CalendarRange, Sprout, Settings, LogOut } from "lucide-react";
import DailyView from "@/components/DailyView";
import MonthlyView from "@/components/MonthlyView";
import WeeklyView from "@/components/WeeklyView";
import YearlyView from "@/components/YearlyView";
import SettingsModal from "@/components/SettingsModal";
import ConfirmModal from "@/components/ConfirmModal";
import LoginView from "@/components/LoginView";
import { useApp } from "@/providers/AppProvider";
import { jobService } from "@/services/jobService";
import { authService } from "@/services/authService";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { Job, UserSettings } from "@/types";

type Tab = "daily" | "weekly" | "monthly" | "yearly";

export default function Home() {
  const { user, settings, loading: authLoading, logout, showToast, refreshSettings } = useApp();
  const [tasks, setTasks] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || authLoading) return;

    // 권한 체크: 관리자이거나 읽기 권한이 있을 때만 구독 시작
    const canRead = settings?.role === 'admin' || settings?.permissions?.canRead;

    if (!canRead) {
      setTasks([]);
      setLoading(false);
      return;
    }

    let unsubscribeJobs: (() => void) | undefined;
    let unsubscribeNotifs: (() => void) | undefined;

    const startSubscription = async () => {
      setLoading(true);
      unsubscribeJobs = await jobService.subscribeJobs((data) => {
        setTasks(data);
        setLoading(false);
      }); // 전체 일정을 실시간 구독

      // 관리자라면 알림 구독 추가
      if (settings?.role === 'admin') {
        unsubscribeNotifs = firestoreRepo.subscribeUnreadCount((count: number) => {
          setUnreadCount(count);
        });
      }
    };

    startSubscription();

    return () => {
      if (unsubscribeJobs) unsubscribeJobs();
      if (unsubscribeNotifs) unsubscribeNotifs();
    };
  }, [user, settings, authLoading]);

  const handleSettingsSave = async (info: any) => {
    if (!user || !settings) return;
    try {
      // UI 필드(name, weekStartsOn)를 DB 필드(farm_name, start_day)로 매핑
      const newSettings: UserSettings = {
        ...settings,
        farm_name: info.name,
        start_day: info.weekStartsOn,
        theme: info.theme,
        updated_at: Date.now()
      };

      await authService.updateSettings(newSettings);

      // AppProvider의 상태 갱신 (전체 앱에 반영)
      await refreshSettings(user.uid);

      setIsSettingsOpen(false);
      showToast("설정이 저장되었습니다.");
    } catch (e) {
      console.error("Settings save error:", e);
      showToast("설정 저장에 실패했습니다.", "error");
    }
  };

  const handleAddTask = async (task: string, date: string, weather?: string, temp_max?: string | number, temp_min?: string | number, group_id?: string, imageFiles?: File[]) => {
    if (!user) return;

    // 권한 체크
    const canWrite = settings?.role === 'admin' || settings?.permissions?.canWrite;
    if (!canWrite) {
      showToast("일정을 등록할 권한이 없습니다.", "error");
      return;
    }

    try {
      await jobService.createJob({
        task,
        date,
        is_done: false,
        user_id: user.uid,
        group_id: group_id || "",
        weather: weather || "",
        temp_max: typeof temp_max === 'string' ? parseFloat(temp_max) : temp_max,
        temp_min: typeof temp_min === 'string' ? parseFloat(temp_min) : temp_min,
      }, imageFiles);
      showToast("새로운 일정이 등록되었습니다.");
    } catch (e) {
      showToast("일정 등록에 실패했습니다.", "error");
    }
  };

  const handleToggleTask = async (id: string, is_done: boolean) => {
    // 권한 체크
    const canWrite = settings?.role === 'admin' || settings?.permissions?.canWrite;
    if (!canWrite) {
      showToast("수정 권한이 없습니다.", "error");
      return;
    }

    try {
      await jobService.toggleTaskDone(id, is_done);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done } : t));
    } catch (e) {
      showToast("상태 변경에 실패했습니다.", "error");
    }
  };

  const handleDeleteTask = (id: string) => {
    if (id.includes('.')) return;

    // 권한 체크
    const canDelete = settings?.role === 'admin' || settings?.permissions?.canDelete;
    if (!canDelete) {
      showToast("삭제 권한이 없습니다.", "error");
      return;
    }

    setTaskToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const executeDeleteTask = async () => {
    if (!taskToDelete) return;

    // 최종 권한 체크 (재확인)
    const canDelete = settings?.role === 'admin' || settings?.permissions?.canDelete;
    if (!canDelete) {
      showToast("삭제 권한이 없습니다.", "error");
      setIsConfirmDeleteOpen(false);
      setTaskToDelete(null);
      return;
    }

    const id = taskToDelete;
    setIsConfirmDeleteOpen(false);
    setTaskToDelete(null);

    const originalTasks = [...tasks];
    setTasks((prev) => prev.filter(t => t.id !== id));
    try {
      await jobService.deleteJob(id);
      showToast("일정이 삭제되었습니다.");
    } catch (e) {
      setTasks(originalTasks);
      showToast("삭제에 실패했습니다.", "error");
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Job>, newImageFiles?: File[]) => {
    if (id.includes('.')) return;

    // 권한 체크
    const canWrite = settings?.role === 'admin' || settings?.permissions?.canWrite;
    if (!canWrite) {
      showToast("수정 권한이 없습니다.", "error");
      return;
    }

    const originalTasks = [...tasks];

    // UI 즉시 업데이트 (Optimistic Update)
    setTasks((prev) => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    try {
      await jobService.updateJob(id, updates, newImageFiles);
    } catch (e) {
      setTasks(originalTasks);
      showToast("수정에 실패했습니다.", "error");
    }
  };

  const executeLogout = async () => {
    setIsConfirmLogoutOpen(false);
    await logout();
  };

  const tabs = [
    { id: "daily", label: "일일 할일", icon: ListTodo },
    { id: "weekly", label: "주간 일정", icon: CalendarDays },
    { id: "monthly", label: "월간 달력", icon: CalendarRange },
    { id: "yearly", label: "연간 일정", icon: Calendar },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <Sprout className="w-12 h-12 text-green-600 animate-bounce" />
          <p className="loading-text font-bold animate-pulse tracking-tight">꿀송이농장 준비 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${settings?.theme === 'dark' ? 'dark' : ''} bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-green-200`}>
      {/* Header */}
      <header className="bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--card-border)] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("daily")}
            className="flex items-center gap-2 text-green-700 hover:opacity-70 transition-opacity active:scale-95"
            title="일일 일정으로 이동"
          >
            <Sprout className="w-7 h-7" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">{settings?.farm_name || "꿀송이농장"}</h1>
          </button>

          <div className="flex items-center gap-2">
            {/* Desktop Tabs */}
            <div className="hidden md:flex gap-1 bg-green-500/10 p-1 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                      ? "bg-[var(--card-bg)] text-green-600 shadow-sm border border-[var(--card-border)]"
                      : "text-gray-500 hover:text-green-600 hover:bg-green-500/10"
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-500/10 rounded-xl transition-all"
                title="농장 설정"
              >
                <Settings className="w-5 h-5" />
              </button>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--header-bg)] backdrop-blur-xl border-t border-[var(--card-border)] px-6 py-3 z-[100] flex items-center justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${isActive ? "text-green-600" : "text-gray-400"
                }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-green-500/10' : ''}`}>
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : 'scale-100'}`} />
              </div>
              <span className="text-[10px] font-bold">{tab.label.replace(' 일정', '').replace(' 달력', '').replace(' 할일', '')}</span>
              {isActive && (
                <div className="absolute -top-3 w-1 h-1 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        farmInfo={{
          name: settings?.farm_name ?? "꿀송이농장",
          region: settings?.location ?? "경상북도 문경시",
          weekStartsOn: (settings?.start_day as 0 | 1) ?? 1,
          theme: (settings?.theme as 'light' | 'dark') ?? 'light'
        }}
        onSave={handleSettingsSave}
        onLogout={() => setIsConfirmLogoutOpen(true)}
        unreadCount={unreadCount}
      />

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        title="일정 삭제"
        message="이 일정을 정말로 삭제할까요? 삭제된 내용은 복구할 수 없습니다."
        confirmText="삭제하기"
        cancelText="취소"
        onConfirm={executeDeleteTask}
        onCancel={() => {
          setIsConfirmDeleteOpen(false);
          setTaskToDelete(null);
        }}
      />

      <ConfirmModal
        isOpen={isConfirmLogoutOpen}
        title="로그아웃"
        message="정말 로그아웃 하시겠습니까? 다시 접속하려면 비밀번호가 필요합니다."
        confirmText="로그아웃"
        cancelText="계속 작업하기"
        onConfirm={executeLogout}
        onCancel={() => setIsConfirmLogoutOpen(false)}
      />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {!settings?.permissions?.canRead && settings?.role !== 'admin' ? (
          <div className="flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-500">
            <div className="p-6 bg-orange-500/10 rounded-[32px] mb-6">
              <Settings className="w-12 h-12 text-orange-500 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold mb-2">접근 권한이 없습니다</h3>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
              농장 일정을 보기 위해서는 관리자의 승인이 필요합니다. <br />
              관리자에게 문의해 주세요.
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="mt-8 px-8 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
            >
              설정 확인
            </button>
          </div>
        ) : loading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-green-600 animate-pulse">
            <Sprout className="w-12 h-12 mb-4 animate-bounce" />
            <p>자라나는 일정을 불러오고 있습니다...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === "daily" && (
              <DailyView
                tasks={tasks}
                onAdd={handleAddTask}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                canWrite={settings?.role === 'admin' || settings?.permissions?.canWrite}
                canDelete={settings?.role === 'admin' || settings?.permissions?.canDelete}
              />
            )}

            {activeTab === "weekly" && (
              <WeeklyView
                tasks={tasks}
                farmInfo={{
                  name: settings?.farm_name,
                  weekStartsOn: settings?.start_day ?? 1
                }}
                onAdd={handleAddTask}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                canWrite={settings?.role === 'admin' || settings?.permissions?.canWrite}
                canDelete={settings?.role === 'admin' || settings?.permissions?.canDelete}
              />
            )}

            {activeTab === "monthly" && (
              <MonthlyView
                tasks={tasks}
                farmInfo={{
                  name: settings?.farm_name,
                  weekStartsOn: settings?.start_day ?? 1
                }}
                onAdd={handleAddTask}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                canWrite={settings?.role === 'admin' || settings?.permissions?.canWrite}
                canDelete={settings?.role === 'admin' || settings?.permissions?.canDelete}
              />
            )}

            {activeTab === "yearly" && (
              <YearlyView
                tasks={tasks}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
