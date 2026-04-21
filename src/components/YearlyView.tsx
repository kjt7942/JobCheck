import { format, startOfYear, eachMonthOfInterval, isSameMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarRange, Target, CheckCircle2, Sprout } from "lucide-react";
import { Task } from "@/api/client";

export default function YearlyView({
  tasks,
}: {
  tasks: Task[];
}) {
  const currentYear = new Date().getFullYear();
  const yearStart = startOfYear(new Date());
  const months = eachMonthOfInterval({
    start: yearStart,
    end: new Date(currentYear, 11, 31),
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
          const completedCount = monthTasks.filter((t) => t.completed).length;
          const progress = monthTasks.length > 0 ? (completedCount / monthTasks.length) * 100 : 0;

          return (
            <div 
              key={month.toISOString()} 
              className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
            >
              {/* Month Header */}
              <div className="p-5 border-b border-[var(--card-border)] bg-gradient-to-br from-[var(--card-bg)] to-[var(--input-bg)]/30">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-2xl font-black text-green-600">
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
                            <div className={`w-1 h-1 rounded-full ${task.completed ? "bg-gray-500/50" : "bg-green-500"}`} />
                            <span className={`text-xs truncate font-medium ${task.completed ? "text-gray-500 line-through" : "text-[var(--foreground)]"}`}>
                              {task.title}
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

      {/* Yearly Summary Legend */}
      <div className="bg-green-800 text-white rounded-3xl p-8 shadow-2xl shadow-green-900/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div>
            <h3 className="text-xl font-black mb-1">2026년 농사 성적표</h3>
            <p className="text-green-100/70 text-sm">성실한 대장님의 한 해가 기록되고 있습니다.</p>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black">{tasks.length}</span>
              <span className="text-[10px] uppercase font-bold text-green-200">총 일정</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black">{tasks.filter(t => t.completed).length}</span>
              <span className="text-[10px] uppercase font-bold text-green-200">완료됨</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black">
                {Math.round((tasks.filter(t => t.completed).length / (tasks.length || 1)) * 100)}%
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
