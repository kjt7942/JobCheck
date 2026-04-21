"use client";
console.log("Client: JS file evaluation started");

import { useState, useEffect } from "react";
import { fetchTasks, addTask, toggleTask, deleteTask, updateTask, Task, fetchSettings, updateSettings } from "@/api/client";
import { CalendarDays, Calendar, ListTodo, CalendarRange, Sprout, Settings, LogOut } from "lucide-react";
import DailyView from "@/components/DailyView";
import MonthlyView from "@/components/MonthlyView";
import WeeklyView from "@/components/WeeklyView";
import YearlyView from "@/components/YearlyView";
import SettingsModal from "@/components/SettingsModal";
import ConfirmModal from "@/components/ConfirmModal";
import LoginView from "@/components/LoginView";
import { useApp } from "@/providers/AppProvider";

type Tab = "daily" | "weekly" | "monthly" | "yearly";

export default function Home() {
  const { isAuthenticated, setIsAuthenticated, farmInfo, setFarmInfo, showToast } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const loadTasks = async () => {
    console.log("Client: Initiating loadTasks...");
    setLoading(true);
    try {
      console.log("Client: Calling fetchTasks...");
      const data = await fetchTasks();
      console.log("Client: fetchTasks returned", data.length, "tasks");
      setTasks(data);
    } catch (e) {
      console.error("Client: fetchTasks error:", e);
    }
    setLoading(false);
  };

  const loadSettings = async () => {
    try {
      const settings = await fetchSettings();
      setFarmInfo(settings);
    } catch (e) {
      console.error("Client: fetchSettings error:", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadTasks(), loadSettings()]);
    };
    if (isAuthenticated) {
      init();
    }
  }, [isAuthenticated]);

  const handleLogin = async (password: string) => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem("is_auth", "true");
        return true;
      }
      return false;
    } catch (e) {
      console.error("Auth failed:", e);
      return false;
    }
  };

  const handleSettingsSave = async (info: { name: string; region: string }) => {
    try {
      // Nominatim API를 사용하여 지역명으로 위경도 조회
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(info.region)}&format=json`, {
        headers: { 'User-Agent': 'JobCheckApp/1.0' }
      });
      const data = await response.json();
      
      let lat = 37.5665;
      let lng = 126.9780;

      if (data && data.length > 0) {
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
        console.log(`Geocoding result for ${info.region}:`, lat, lng);
      } else {
        showToast("지역 정보를 찾을 수 없어 기본 위치로 설정됩니다.", "info");
      }

      const newInfo = { ...info, lat, lng };
      setFarmInfo(newInfo);
      
      // Notion API에 저장
      await updateSettings(newInfo);
      setIsSettingsOpen(false);
      showToast("농장 설정이 저장되었습니다.");
    } catch (e) {
      console.error("Settings save failed:", e);
      showToast("설정 저장에 실패했습니다.", "error");
    }
  };

  const handleAddTask = async (title: string, date: string, weather?: string, tmx?: string | number, tmn?: string | number, groupId?: string) => {
    const tempId = Math.random().toString();
    setTasks((prev) => [{ id: tempId, title, completed: false, date, weather: weather || "", tmx, tmn, groupId }, ...prev]);
    // farmInfo의 위경도를 함께 전송 (수동 입력 필드도 포함)
    try {
      await addTask(title, date, farmInfo.lat, farmInfo.lng, weather, tmx, tmn, groupId);
      showToast("새로운 일정이 등록되었습니다.");
    } catch (e) {
      showToast("일정 등록에 실패했습니다.", "error");
    }
    await loadTasks();
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    if (id.includes('.')) return;
    setTasks((prev) => prev.map(t => t.id === id ? { ...t, completed } : t));
    try {
      await toggleTask(id, completed);
    } catch (e) {
      console.error("Toggle failed:", e);
      setTasks((prev) => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
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
      await deleteTask(id);
      showToast("일정이 삭제되었습니다.");
    } catch (e) {
      setTasks(originalTasks);
      showToast("삭제에 실패했습니다.", "error");
    }
  };

  const handleUpdateTask = async (id: string, title?: string, date?: string, weather?: string, tmx?: string | number, tmn?: string | number, groupId?: string) => {
    if (id.includes('.')) return;
    const originalTasks = [...tasks];
    setTasks((prev) => prev.map(t => t.id === id ? { 
      ...t, 
      ...(title && { title }), 
      ...(date && { date }),
      ...(weather !== undefined && { weather }),
      ...(tmx !== undefined && { tmx }),
      ...(tmn !== undefined && { tmn }),
      ...(groupId !== undefined && { groupId })
    } : t));
    try {
      await updateTask(id, { title, date, weather, tmx, tmn, groupId });
    } catch (e) {
      setTasks(originalTasks);
    }
  };

  const handleLogout = () => {
    setIsConfirmLogoutOpen(true);
  };

  const executeLogout = () => {
    sessionStorage.removeItem("is_auth");
    setIsAuthenticated(false);
    setIsConfirmLogoutOpen(false);
  };

  const tabs = [
    { id: "daily", label: "일일 할일", icon: ListTodo },
    { id: "weekly", label: "주간 일정", icon: CalendarDays },
    { id: "monthly", label: "월간 달력", icon: CalendarRange },
    { id: "yearly", label: "연간 일정", icon: Calendar },
  ];

  if (isAuthenticated === null) return null; // 로딩 중에는 아무것도 안 보여줌
  
  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${farmInfo.theme === 'dark' ? 'dark' : ''} bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-green-200`}>
      {/* Header */}
      <header className="bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--card-border)] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => setActiveTab("daily")}
            className="flex items-center gap-2 text-green-700 hover:opacity-70 transition-opacity active:scale-95"
            title="일일 일정으로 이동"
          >
            <Sprout className="w-7 h-7" />
            <h1 className="text-xl font-bold tracking-tight">{farmInfo.name}</h1>
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

            </button>
          </div>
        </div>
      </header>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        farmInfo={farmInfo as any} 
        onSave={handleSettingsSave} 
        onLogout={handleLogout}
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
                farmInfo={farmInfo}
                onAdd={handleAddTask} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask} 
                onUpdate={handleUpdateTask}
              />
            )}
            {activeTab === "monthly" && (
              <MonthlyView 
                tasks={tasks} 
                farmInfo={farmInfo}
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
