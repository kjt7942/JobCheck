import { useState } from "react";
import { format, startOfYear, eachMonthOfInterval, isSameMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarRange, Target, CheckCircle2, Sprout, X, Clock } from "lucide-react";
import { Job } from "@/types";

export default function YearlyView({
  tasks,
}: {
  tasks: Job[];
}) {
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const currentYear = new Date().getFullYear();
  const yearStart = startOfYear(new Date());
  const months = eachMonthOfInterval({
    start: yearStart,
    end: new Date(currentYear, 11, 31),
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-green-500/10 p-2 rounded-xl text-green-600">
          <CalendarRange className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">{currentYear}년 농장 연간 계획</h2>
          <p className="text-sm text-gray-400">올 한 해의 농사 흐름을 한눈에 확인하세요.</p>
        </div>
      </div>

      {/* 12 Months Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {months.map((month) => {
          const monthTasks = tasks.filter((t) => isSameMonth(new Date(t.date), month));
          const completedCount = monthTasks.filter((t) => t.is_done).length;
          const progress = monthTasks.length > 0 ? (completedCount / monthTasks.length) * 100 : 0;
          const isSelected = selectedMonth && isSameMonth(month, selectedMonth);

          return (
            <div 
              key={month.toISOString()} 
              onClick={() => setSelectedMonth(month)}
              className={`bg-[var(--card-bg)] rounded-3xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group cursor-pointer relative ${
                isSelected ? "border-green-500 ring-2 ring-green-500/20" : "border-[var(--card-border)]"
              }`}
            >
              {/* Month Header */}
              <div className={`p-5 border-b transition-colors ${
                isSelected ? "bg-green-500/5 border-green-500/20" : "border-[var(--card-border)] bg-gradient-to-br from-[var(--card-bg)] to-[var(--input-bg)]/30"
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-2xl font-black ${isSelected ? "text-green-600" : "text-green-600"}`}>
                    {format(month, "M월")}
                  </span>
                  <div className="bg-[var(--input-bg)] px-2 py-1 rounded-lg border border-[var(--card-border)] shadow-sm text-[var(--foreground)]">
                    <span className="text-xs font-bold text-green-600">
                      {monthTasks.length}건
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                  <span className="uppercase tracking-wider">
                    {format(month, "MMMM", { locale: ko })}
                  </span>
                </div>
              </div>

              {/* Month Body */}
              <div className="p-5 space-y-4">
                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-gray-400">완료율</span>
                    <span className="text-green-600">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--input-bg)] rounded-full overflow-hidden border border-[var(--card-border)]">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Top Tasks Summary */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                    <Target className="w-3 h-3" />
                    <span>주요 활동</span>
                  </div>
                  <div className="min-h-[60px]">
                    {monthTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-4 opacity-10">
                        <Sprout className="w-6 h-6 text-green-300" />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {monthTasks.slice(0, 2).map((task) => (
                          <div key={task.id} className="flex items-center gap-2 group/task">
                            <div className={`w-1 h-1 rounded-full ${task.is_done ? "bg-gray-500/50" : "bg-green-500"}`} />
                            <span className={`text-xs truncate font-medium ${task.is_done ? "text-gray-500 line-through" : "text-[var(--foreground)]"}`}>
                              {task.task}
                            </span>
                          </div>
                        ))}
                        {monthTasks.length > 2 && (
                          <p className="text-[9px] text-gray-400 pl-3">외 {monthTasks.length - 2}개 일정 더 있음...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Indicator */}
              {monthTasks.length > 0 && progress === 100 && (
                <div className="absolute top-2 right-2 scale-110">
                  <CheckCircle2 className="w-5 h-5 text-green-500 fill-[var(--card-bg)]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Month Detailed List */}
      {selectedMonth && (
        <div className="bg-[var(--card-bg)] rounded-[2.5rem] border border-[var(--card-border)] shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
          {/* List Header */}
          <div className="p-8 border-b border-[var(--card-border)] flex justify-between items-center bg-gradient-to-r from-green-600/5 via-transparent to-transparent">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-6 bg-green-500 rounded-full" />
                <h3 className="text-2xl font-black text-[var(--foreground)]">
                  {format(selectedMonth, "yyyy년 M월")} 전체 일정 목록
                </h3>
              </div>
              <p className="text-sm text-gray-400 ml-4 font-medium">
                총 {tasks.filter(t => isSameMonth(new Date(t.date), selectedMonth)).length}개의 기록이 날짜순으로 나열되어 있습니다.
              </p>
            </div>
            <button 
              onClick={() => setSelectedMonth(null)}
              className="p-3 hover:bg-[var(--input-bg)] rounded-2xl transition-all duration-200 text-gray-400 hover:text-[var(--foreground)]"
              title="목록 닫기"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* List Body */}
          <div className="p-8 space-y-4">
            {tasks
              .filter(t => isSameMonth(new Date(t.date), selectedMonth))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((task) => (
                <div 
                  key={task.id}
                  className="flex items-center gap-5 p-5 rounded-3xl border border-[var(--card-border)] bg-[var(--input-bg)]/30 hover:bg-[var(--input-bg)]/50 transition-all duration-200 group"
                >
                  <div className="flex flex-col items-center justify-center min-w-[56px] h-14 bg-green-500/10 rounded-2xl text-green-600 border border-green-500/20 shadow-sm">
                    <span className="text-lg font-black leading-none">{format(new Date(task.date), "d")}</span>
                    <span className="text-[10px] font-bold leading-none mt-1 opacity-70 uppercase">{format(new Date(task.date), "EEE", { locale: ko })}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-400 bg-[var(--card-bg)] px-2 py-0.5 rounded-lg border border-[var(--card-border)] shadow-sm">
                        <Clock className="w-3 h-3" />
                        {format(new Date(task.date), "HH:mm")}
                      </span>
                      {task.is_done && (
                        <span className="text-[10px] font-black text-green-600 bg-green-500/10 px-2 py-0.5 rounded-lg border border-green-500/20 tracking-wider">DONE</span>
                      )}
                    </div>
                    <h4 className={`text-base font-bold truncate transition-all duration-300 ${task.is_done ? "text-gray-400 line-through decoration-2" : "text-[var(--foreground)]"}`}>
                      {task.task}
                    </h4>
                  </div>
                </div>
              ))}
            {tasks.filter(t => isSameMonth(new Date(t.date), selectedMonth)).length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 opacity-30">
                <Sprout className="w-16 h-16 mb-4" />
                <p className="text-lg font-bold">기록된 일정이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Yearly Summary Legend */}
      <div className="bg-green-800 text-white rounded-3xl p-8 shadow-2xl shadow-green-900/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div>
            <h3 className="text-xl font-black mb-1">{currentYear}년 농사 성적표</h3>
            <p className="text-green-100/70 text-sm">성실한 대장님의 한 해가 기록되고 있습니다.</p>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black">{tasks.length}</span>
              <span className="text-[10px] uppercase font-bold text-green-200">총 일정</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black">{tasks.filter(t => t.is_done).length}</span>
              <span className="text-[10px] uppercase font-bold text-green-200">완료됨</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black">
                {Math.round((tasks.filter(t => t.is_done).length / (tasks.length || 1)) * 100)}%
              </span>
              <span className="text-[10px] uppercase font-bold text-green-200">평균 달성률</span>
            </div>
          </div>
        </div>
        {/* Background Decorative Sprout */}
        <Sprout className="absolute -right-10 -bottom-10 w-48 h-48 text-white/5 rotate-12" />
      </div>
    </div>
  );
}
