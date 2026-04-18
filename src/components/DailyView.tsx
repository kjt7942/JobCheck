"use client";

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { Task } from "@/api/client";
import { Plus, Check, Trash2, Clock, Calendar as CalendarIcon, CheckCircle2, ChevronRight, Activity, Search } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("ko", ko);

export default function DailyView({
  tasks,
  onAdd,
  onToggle,
  onDelete,
}: {
  tasks: Task[];
  onAdd: (title: string, date: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(new Date());

  const now = new Date();
  const todaysTasks = tasks.filter((t) => isSameDay(new Date(t.date), now))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const completedCount = todaysTasks.filter((t) => t.completed).length;
  const totalCount = todaysTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !startDate) return;
    onAdd(newTitle.trim(), startDate.toISOString());
    setNewTitle("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      
      {/* 🚀 Left Area: Task List & Timeline (8 columns) */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between items-start gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Today's Schedule</h2>
            <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-widest">
              {format(now, "yyyy. MM. dd eeee", { locale: ko })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-50 rounded-full flex items-center px-4 py-2 border border-gray-100">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span className="text-sm font-semibold text-gray-600">진행도: {Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Timeline List */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 flex-1 min-h-[500px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-gray-800">일정 목록</h3>
            <div className="text-sm font-medium text-gray-400">
              총 <span className="text-gray-800 font-bold">{totalCount}</span>개의 스케줄
            </div>
          </div>

          <div className="space-y-4">
            {todaysTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">오늘 заплани된 일정이 없습니다.</p>
                <p className="text-sm mt-1">우측 패널에서 새로운 일정을 추가해보세요.</p>
              </div>
            ) : (
              todaysTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    task.completed 
                      ? "bg-gray-50/50 border-gray-100 opacity-60" 
                      : "bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm"
                  }`}
                  onClick={(e) => {
                    // 삭제 버튼 영역 내부 클릭 시 절대 실행 금지 (.delete-btn 클래스 검사)
                    if ((e.target as HTMLElement).closest('.delete-btn')) return;
                    onToggle(task.id, !task.completed);
                  }}
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <span className={`text-sm font-bold ${task.completed ? "text-gray-400" : "text-gray-900"}`}>
                      {format(new Date(task.date), "HH:mm")}
                    </span>
                  </div>

                  {/* Vertical Divider */}
                  <div className={`w-1 h-10 rounded-full ${task.completed ? "bg-gray-200" : "bg-orange-400"}`}></div>

                  <div className="flex-1 min-w-0 pl-2 flex items-center gap-4">
                    <div className="flex-1">
                      <p className={`text-base font-semibold truncate ${task.completed ? "text-gray-400 line-through" : "text-gray-800"}`}>
                        {task.title}
                      </p>
                    </div>

                    {/* Check / Delete Actions */}
                    <div className="flex items-center gap-2 relative z-10">
                       {task.completed ? (
                         <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-500" />
                         </div>
                       ) : (
                         <div 
                           className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-orange-400 transition-colors cursor-pointer"
                           onClick={(e) => {
                             e.stopPropagation();
                             onToggle(task.id, true);
                           }}
                         />
                       )}
                       
                        <button
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            if (window.confirm('이 일정을 정말로 삭제할까요?')) {
                              onDelete(task.id); 
                            }
                          }}
                          className="delete-btn opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all z-20"
                          title="삭제하기"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 📋 Right Area: Input Form & Widgets (4 columns) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Add New Task Widget */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6 font-sans">
            Add New Task
          </h3>
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">일정 내용</label>
              <div className="relative">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 과수원 물주기"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">시간 설정</label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy.MM.dd HH:mm"
                locale="ko"
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition-all focus:bg-white cursor-pointer"
                wrapperClassName="w-full"
              />
            </div>

            <button
              type="submit"
              disabled={!newTitle.trim() || !startDate}
              className="w-full bg-gray-900 hover:bg-black text-white text-sm font-bold py-3.5 rounded-xl transition-all disabled:bg-gray-100 disabled:text-gray-400 flex items-center justify-center gap-2 mt-4 shadow-sm"
            >
              일정 등록하기
            </button>
          </form>
        </div>

        {/* Summary Widget */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
           <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4 text-orange-500">
             <Activity className="w-8 h-8" />
           </div>
           <h4 className="text-lg font-bold text-gray-800 mb-1">훌륭합니다!</h4>
           <p className="text-sm font-medium text-gray-500 mb-6">
             오늘 총 <strong className="text-gray-800">{totalCount}</strong>개의 일정 중<br/>
             <strong className="text-gray-800">{completedCount}</strong>개를 완료하셨습니다.
           </p>
           
           <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-400 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
           </div>
        </div>

      </div>

    </div>
  );
}
