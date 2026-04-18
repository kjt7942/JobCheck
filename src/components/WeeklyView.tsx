import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, Circle, Trash2, CalendarDays } from "lucide-react";

export default function WeeklyView({
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
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // 월요일 시작

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-green-100 p-2 rounded-lg text-green-700">
          <CalendarDays className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">이번 주 주간 일정</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dayTasks = tasks.filter((t) => isSameDay(new Date(t.date), day));
          const isToday = isSameDay(day, today);

          return (
            <div 
              key={day.toISOString()} 
              className={`flex flex-col rounded-2xl border transition-all duration-300 min-h-[300px] ${
                isToday 
                  ? "bg-green-50/50 border-green-200 shadow-sm ring-1 ring-green-100" 
                  : "bg-white border-gray-100 hover:border-green-100 shadow-sm"
              }`}
            >
              {/* Day Header */}
              <div className={`p-4 border-b ${isToday ? "border-green-100" : "border-gray-50"}`}>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-green-600" : "text-gray-400"}`}>
                    {format(day, "EEEE", { locale: ko })}
                  </span>
                  <span className={`text-xl font-black ${isToday ? "text-green-800" : "text-gray-700"}`}>
                    {format(day, "d")}
                  </span>
                </div>
              </div>

              {/* Day Body */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[400px]">
                {dayTasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-10 opacity-20 group">
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300" />
                  </div>
                ) : (
                  dayTasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((task) => (
                    <div 
                      key={task.id}
                      className="group relative bg-white/50 border border-green-50/50 rounded-xl p-3 hover:bg-white hover:shadow-md hover:border-green-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onToggle(task.id, !task.completed); }}
                          className="mt-0.5 transition-colors"
                        >
                          {task.completed 
                            ? <Check className="w-4 h-4 text-green-500" /> 
                            : <Circle className="w-4 h-4 text-gray-300 group-hover:text-green-400" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight truncate ${task.completed ? "text-gray-400 line-through" : "text-gray-700"}`}>
                            {task.title}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">
                            {format(new Date(task.date), "HH:mm")}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
