import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarRange, Sprout } from "lucide-react";
import { useState } from "react";
import { Task } from "@/api/client";

export default function MonthlyView({
  tasks,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
}: {
  tasks: Task[];
  onAdd: (title: string, date: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title?: string, date?: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const weekDays = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg text-green-700">
            <CalendarRange className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {format(currentDate, "yyyy년 M월")}
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-green-50 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg">
            오늘
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-green-50 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl shadow-xl shadow-green-900/5 border border-green-50 overflow-hidden">
        {/* Day Names */}
        <div className="grid grid-cols-7 bg-green-50/50 border-b border-green-100">
          {weekDays.map((day) => (
            <div key={day} className="py-3 text-center text-xs font-bold text-green-700">
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayTasks = tasks.filter((t) => isSameDay(new Date(t.date), day));
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] p-2 border-r border-b border-green-50 transition-colors hover:bg-green-50/30 group ${
                  !isCurrentMonth ? "bg-gray-50/30" : ""
                } ${idx % 7 === 6 ? "border-r-0" : ""}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                    isToday 
                      ? "bg-green-600 text-white shadow-md shadow-green-200" 
                      : isCurrentMonth ? "text-gray-700" : "text-gray-300"
                  }`}>
                    {format(day, "d")}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md font-bold">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div 
                      key={task.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md truncate border ${
                        task.completed 
                          ? "bg-gray-100 border-gray-200 text-gray-400 line-through" 
                          : "bg-white border-green-100 text-green-800 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 overflow-hidden">
                        <span className="truncate">{task.title}</span>
                        {(task.weather || task.tmx !== undefined) && (
                          <span className="flex items-center gap-0.5 shrink-0 opacity-80 scale-90 origin-right">
                             {task.weather?.includes("비") ? "🌧️" : task.weather?.includes("맑음") ? "☀️" : task.weather?.includes("흐림") ? "☁️" : ""}
                             {task.tmx && <span className="text-[8px] font-mono">{task.tmx}°</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-[9px] text-gray-400 pl-1">
                      외 {dayTasks.length - 3}개...
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Summary Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span>진행 중</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          <span>완료</span>
        </div>
      </div>
    </div>
  );
}
