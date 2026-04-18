"use client";

import { useState, useEffect } from "react";
import { fetchTasks, addTask, Task } from "@/api/client";
import { CalendarDays, Calendar, ListTodo, CalendarRange, Sprout } from "lucide-react";
import DailyView from "@/components/DailyView";
import MonthlyView from "@/components/MonthlyView";
import WeeklyView from "@/components/WeeklyView";

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

  const tabs = [
    { id: "daily", label: "일일 할일", icon: ListTodo },
    { id: "weekly", label: "주간 일정", icon: CalendarDays },
    { id: "monthly", label: "월간 달력", icon: CalendarRange },
    { id: "yearly", label: "연도별 달력", icon: Calendar },
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
            {activeTab === "daily" && <DailyView tasks={tasks} onAdd={handleAddTask} />}
            {activeTab === "weekly" && <WeeklyView tasks={tasks} onAdd={handleAddTask} />}
            {activeTab === "monthly" && <MonthlyView tasks={tasks} onAdd={handleAddTask} />}
            {activeTab === "yearly" && (
              <div className="text-center py-20 text-gray-400">
                연도별 뷰는 준비중입니다!
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
