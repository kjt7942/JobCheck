"use client";

import { useState, useEffect } from "react";
import { fetchTasks, addTask, toggleTask, deleteTask, Task } from "@/api/client";
import { CalendarDays, Calendar, ListTodo, CalendarRange, Sprout } from "lucide-react";
import DailyView from "@/components/DailyView";
import MonthlyView from "@/components/MonthlyView";
import WeeklyView from "@/components/WeeklyView";
import YearlyView from "@/components/YearlyView";

type Tab = "daily" | "weekly" | "monthly" | "yearly";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("daily");

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleAddTask = async (title: string, date: string) => {
    const tempId = Math.random().toString();
    setTasks((prev) => [{ id: tempId, title, completed: false, date }, ...prev]);
    await addTask(title, date);
    await loadTasks(); // Refresh to get real ID
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    // 임시 ID(숫자 형태)인 경우 서버 요청 방지
    if (id.includes('.')) {
      console.warn("Task is still being created. Please wait.");
      return;
    }
    setTasks((prev) => prev.map(t => t.id === id ? { ...t, completed } : t));
    try {
      await toggleTask(id, completed);
    } catch (e) {
      console.error("Toggle failed:", e);
      // 복구 로직 (에러 시 다시 원래 상태로)
      setTasks((prev) => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
      alert("일정 상태를 변경하는 데 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (id.includes('.')) {
      console.warn("Task is still being created. Please wait.");
      return;
    }
    const confirmed = confirm("이 일정을 정말로 삭제할까요?");
    if (!confirmed) return;

    const originalTasks = [...tasks];
    setTasks((prev) => prev.filter(t => t.id !== id));
    try {
      await deleteTask(id);
    } catch (e) {
      console.error("Delete failed:", e);
      setTasks(originalTasks);
      alert("일정 삭제에 실패했습니다.");
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
            <h1 className="text-xl font-bold tracking-tight">농장 일정 (JobCheck)</h1>
          </div>
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
        </div>
      </header>

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
              />
            )}
            {activeTab === "weekly" && (
              <WeeklyView 
                tasks={tasks} 
                onAdd={handleAddTask} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask} 
              />
            )}
            {activeTab === "monthly" && (
              <MonthlyView 
                tasks={tasks} 
                onAdd={handleAddTask} 
                onToggle={handleToggleTask} 
                onDelete={handleDeleteTask} 
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
