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
import { firestoreRepo } from "@/repo/firestoreRepository";
import { Job } from "@/types";

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
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 모든 사용자의 일정을 공유하여 가져옴
      const data = await firestoreRepo.getJobs(currentDate);
      setTasks(data);
    } catch (e) {
      console.error("Load tasks error:", e);
      showToast("일정을 불러오는 중 오류가 발생했습니다.", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user, currentDate]);

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
      
      await firestoreRepo.saveUserSettings(newSettings);
      
      // AppProvider의 상태 갱신 (전체 앱에 반영)
      await refreshSettings(user.uid);
      
      setIsSettingsOpen(false);
      showToast("설정이 저장되었습니다.");
    } catch (e) {
      console.error("Settings save error:", e);
      showToast("설정 저장에 실패했습니다.", "error");
    }
  };

  const handleAddTask = async (task: string, date: string, weather?: string, temp_max?: string | number, temp_min?: string | number, group_id?: string) => {
    if (!user) return;
    try {
      await firestoreRepo.addJob({
        task,
        date,
        is_done: false,
        user_id: user.uid,
        group_id: group_id || "",
        weather: weather || "",
        temp_max: typeof temp_max === 'string' ? parseFloat(temp_max) : temp_max,
        temp_min: typeof temp_min === 'string' ? parseFloat(temp_min) : temp_min,
      });
      showToast("새로운 일정이 등록되었습니다.");
      loadTasks();
    } catch (e) {
      showToast("일정 등록에 실패했습니다.", "error");
    }
  };

  const handleToggleTask = async (id: string, is_done: boolean) => {
    try {
      await firestoreRepo.updateJob(id, { is_done });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done } : t));
    } catch (e) {
      showToast("상태 변경에 실패했습니다.", "error");
    }
  };

  const handleDeleteTask = (id: string) => {
    if (id.includes('.')) return;
    setTaskToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const executeDeleteTask = async () => {
    if (!taskToDelete) return;
    const id = taskToDelete;
    setIsConfirmDeleteOpen(false);
    setTaskToDelete(null);

    const originalTasks = [...tasks];
    setTasks((prev) => prev.filter(t => t.id !== id));
    try {
      await firestoreRepo.deleteJob(id);
      showToast("일정이 삭제되었습니다.");
    } catch (e) {
      setTasks(originalTasks);
      showToast("삭제에 실패했습니다.", "error");
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Job>) => {
    if (id.includes('.')) return;
    const originalTasks = [...tasks];
    
    // UI 즉시 업데이트 (Optimistic Update)
    setTasks((prev) => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    
    try {
      await firestoreRepo.updateJob(id, updates);
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
      <div className="min-h-screen flex items-center justify-center bg-[#f0f9f0]">
        <div className="flex flex-col items-center gap-4">
          <Sprout className="w-12 h-12 text-green-600 animate-bounce" />
          <p className="text-green-700 font-medium">꿀송이농장 준비 중...</p>
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
            <h1 className="text-xl font-bold tracking-tight">{settings?.farm_name || "꿀송이농장"}</h1>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-green-500/10 p-1 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? "bg-[var(--card-bg)] text-green-600 shadow-sm border border-[var(--card-border)]" 
                        : "text-gray-500 hover:text-green-600 hover:bg-green-500/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-500/10 rounded-xl transition-all"
              title="농장 설정"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

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
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-green-600 animate-pulse">
            <Sprout className="w-12 h-12 mb-4 animate-bounce" />
            <p>자라나는 일정을 불러오고 있습니다...</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {activeTab === "daily" && (
              <DailyView 
                tasks={tasks} 
                onAdd={handleAddTask} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask} 
                onUpdate={handleUpdateTask}
              />
            )}
            {activeTab === "weekly" && (
              <WeeklyView 
                tasks={tasks} 
                farmInfo={{
                  name: settings?.farm_name,
                  weekStartsOn: settings?.start_day
                }}
                onAdd={handleAddTask} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask} 
                onUpdate={handleUpdateTask}
              />
            )}
            {activeTab === "monthly" && (
              <MonthlyView 
                tasks={tasks} 
                farmInfo={{
                  name: settings?.farm_name,
                  weekStartsOn: settings?.start_day
                }}
                onAdd={handleAddTask} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask} 
                onUpdate={handleUpdateTask}
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
