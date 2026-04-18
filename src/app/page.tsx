"use client";
console.log("Client: JS file evaluation started");

import { useState, useEffect } from "react";
import { fetchTasks, addTask, toggleTask, deleteTask, updateTask, Task, fetchSettings, updateSettings } from "@/api/client";
import { CalendarDays, Calendar, ListTodo, CalendarRange, Sprout, Settings } from "lucide-react";
import DailyView from "@/components/DailyView";
import MonthlyView from "@/components/MonthlyView";
import WeeklyView from "@/components/WeeklyView";
import YearlyView from "@/components/YearlyView";
import SettingsModal from "@/components/SettingsModal";

type Tab = "daily" | "weekly" | "monthly" | "yearly";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [farmInfo, setFarmInfo] = useState<{ name: string; region: string; lat: number; lng: number }>({ 
    name: "우리 농장", 
    region: "서울",
    lat: 37.5665,
    lng: 126.9780
  });

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
    init();
  }, []);

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
        alert("지역 정보를 찾을 수 없어 기본 위치(서울)로 설정됩니다.");
      }

      const newInfo = { ...info, lat, lng };
      setFarmInfo(newInfo);
      
      // Notion API에 저장
      await updateSettings(newInfo);
      setIsSettingsOpen(false);
    } catch (e) {
      console.error("Settings save failed:", e);
      alert("설정 저장에 실패했습니다.");
    }
  };

  const handleAddTask = async (title: string, date: string, weather?: string, tmx?: string | number, tmn?: string | number) => {
    const tempId = Math.random().toString();
    setTasks((prev) => [{ id: tempId, title, completed: false, date, weather: weather || "", tmx, tmn }, ...prev]);
    // farmInfo의 위경도를 함께 전송 (수동 입력 필드도 포함)
    await addTask(title, date, farmInfo.lat, farmInfo.lng, weather, tmx, tmn);
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

  const handleDeleteTask = async (id: string) => {
    if (id.includes('.')) return;
    const confirmed = confirm("이 일정을 정말로 삭제할까요?");
    if (!confirmed) return;
    const originalTasks = [...tasks];
    setTasks((prev) => prev.filter(t => t.id !== id));
    try {
      await deleteTask(id);
    } catch (e) {
      setTasks(originalTasks);
    }
  };

  const handleUpdateTask = async (id: string, title?: string, date?: string) => {
    if (id.includes('.')) return;
    const originalTasks = [...tasks];
    setTasks((prev) => prev.map(t => t.id === id ? { ...t, ...(title && { title }), ...(date && { date }) } : t));
    try {
      await updateTask(id, { title, date });
    } catch (e) {
      setTasks(originalTasks);
    }
  };

  const tabs = [
    { id: "daily", label: "일일 할일", icon: ListTodo },
    { id: "weekly", label: "주간 일정", icon: CalendarDays },
    { id: "monthly", label: "월간 달력", icon: CalendarRange },
    { id: "yearly", label: "연간 일정", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-[#f9fdf8] text-gray-800 font-sans selection:bg-green-200">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700">
            <Sprout className="w-7 h-7" />
            <h1 className="text-xl font-bold tracking-tight">{farmInfo.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-green-50/50 p-1 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? "bg-white text-green-700 shadow-sm border border-green-100/50" 
                        : "text-gray-500 hover:text-green-600 hover:bg-green-50"
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
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
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
        farmInfo={farmInfo as any} 
        onSave={handleSettingsSave} 
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
                onAdd={handleAddTask} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask} 
                onUpdate={handleUpdateTask}
              />
            )}
            {activeTab === "monthly" && (
              <MonthlyView 
                tasks={tasks} 
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
