"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Task } from "@/api/client";
import { Plus, Check, Circle, TreePine } from "lucide-react";

export default function DailyView({
  tasks,
  onAdd,
}: {
  tasks: Task[];
  onAdd: (title: string, date: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todaysTasks = tasks.filter((t) => t.date.startsWith(todayStr));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim(), new Date().toISOString());
    setNewTitle("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {format(new Date(), "M월 d일 (EEEE)", { locale: ko })}
          </h2>
          <p className="text-gray-500 mt-1">오늘의 농장 할일은 무엇인가요?</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-green-50 p-2 sm:p-6">
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="예) 토마토 모종 심기..."
            className="flex-1 border-0 bg-green-50/50 rounded-xl px-4 py-3 text-gray-700 placeholder-green-300 focus:ring-2 focus:ring-green-400 focus:bg-white transition-all outline-none"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-5 rounded-xl font-medium transition-all flex items-center gap-2 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span className="hidden sm:inline">추가하기</span>
          </button>
        </form>

        <div className="space-y-3">
          {todaysTasks.length === 0 ? (
             <div className="py-12 flex flex-col items-center justify-center text-center">
             <div className="bg-green-50 p-4 rounded-full mb-3 text-green-400">
               <TreePine className="w-8 h-8" />
             </div>
             <p className="text-gray-500">오늘은 계획된 일정이 없네요.<br/>새로운 작업을 추가해보세요!</p>
           </div>
          ) : (
            todaysTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-green-100 hover:bg-green-50/30 transition-all"
              >
                <button className="flex-shrink-0 text-green-500/50 hover:text-green-500 transition-colors">
                  {task.completed ? <Check className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6" />}
                </button>
                <span className={`flex-1 text-lg ${task.completed ? "text-gray-400 line-through" : "text-gray-700"}`}>
                  {task.title}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
