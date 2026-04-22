import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, Circle, Trash2, CalendarDays, Edit2, X, Save, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Job } from "@/types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function WeeklyView({
  tasks,
  farmInfo,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
}: {
  tasks: Job[];
  farmInfo: any;
  onAdd: (task: string, date: string) => void;
  onToggle: (id: string, is_done: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Job>) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);

  const [viewDate, setViewDate] = useState(new Date());

  const startDay = farmInfo?.weekStartsOn ?? 1;
  const weekStart = startOfWeek(viewDate, { weekStartsOn: startDay as any }); 
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goToPreviousWeek = () => setViewDate(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setViewDate(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setViewDate(new Date());

  const startEdit = (job: Job) => {
    setEditingId(job.id!);
    setEditTitle(job.task);
    setEditDate(new Date(job.date));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDate(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editDate) return;
    onUpdate(id, {
      task: editTitle.trim(),
      date: editDate.toISOString(),
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-green-500/10 p-2 rounded-lg text-green-600">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            {format(weekStart, "M월 d일")} ~ {format(addDays(weekStart, 6), "M월 d일")} 일정
          </h2>
        </div>
        
        <div className="flex items-center gap-2 bg-[var(--card-bg)] p-1 rounded-xl border border-[var(--card-border)] shadow-sm">
          <button 
            onClick={goToPreviousWeek}
            className="p-1.5 hover:bg-[var(--input-bg)] rounded-lg transition-all text-gray-400 hover:text-green-600"
            title="이전 주"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {!isSameDay(startOfWeek(new Date(), { weekStartsOn: startDay as any }), weekStart) && (
            <button 
              onClick={goToCurrentWeek}
              className="px-3 py-1 text-[10px] font-black bg-green-500/10 text-green-600 rounded-md hover:bg-green-500/20 transition-all border border-green-500/20"
            >
              이번 주
            </button>
          )}
          <button 
            onClick={goToNextWeek}
            className="p-1.5 hover:bg-[var(--input-bg)] rounded-lg transition-all text-gray-400 hover:text-green-600"
            title="다음 주"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dayTasks = tasks.filter((t) => isSameDay(new Date(t.date), day));
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={day.toISOString()} 
              className={`flex flex-col rounded-2xl border transition-all duration-300 min-h-[300px] ${
                isToday 
                  ? "bg-green-500/5 border-green-500/30 shadow-sm ring-1 ring-green-500/20" 
                  : "bg-[var(--card-bg)] border-[var(--card-border)] hover:border-green-500/30 shadow-sm"
              }`}
            >
              {/* Day Header */}
              <div className={`p-4 border-b ${isToday ? "border-green-500/20" : "border-[var(--card-border)]"}`}>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-green-600" : "text-gray-400"}`}>
                    {format(day, "EEEE", { locale: ko })}
                  </span>
                  <span className={`text-xl font-black ${isToday ? "text-green-600" : "text-[var(--foreground)]"}`}>
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
                      className="group relative bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl p-3 hover:bg-[var(--card-bg)] hover:shadow-md hover:border-green-500/30 transition-all"
                    >
                      {editingId === task.id ? (
                        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                           <input 
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-white border border-green-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-green-400 outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-1">
                             <Clock className="w-3 h-3 text-green-500" />
                             <DatePicker
                               selected={editDate}
                               onChange={(date: Date | null) => setEditDate(date)}
                               showTimeSelect
                               showTimeSelectOnly
                               timeIntervals={15}
                               dateFormat="HH:mm"
                               locale="ko"
                               className="bg-white border border-green-200 rounded-lg px-1 py-0.5 text-[10px] outline-none w-16 cursor-pointer"
                             />
                          </div>
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => handleSaveEdit(task.id)} className="p-1 rounded bg-green-500 text-white hover:bg-green-600"><Save className="w-3 h-3" /></button>
                            <button onClick={cancelEdit} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2" onClick={() => onToggle(task.id!, !task.is_done)}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onToggle(task.id!, !task.is_done); }}
                            className="mt-0.5 transition-colors"
                          >
                            {task.is_done 
                              ? <Check className="w-4 h-4 text-green-500" /> 
                              : <Circle className="w-4 h-4 text-gray-300 group-hover:text-green-400" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-tight truncate ${task.is_done ? "text-gray-400 line-through opacity-50" : "text-[var(--foreground)]"}`}>
                              {task.task}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1 font-mono">
                              {format(new Date(task.date), "HH:mm")}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                              className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-500/10 rounded-md transition-all"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Bottom Navigation */}
      <div className="flex items-center justify-between bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--card-border)] shadow-sm">
        <button 
          onClick={goToPreviousWeek}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 hover:text-green-600 hover:bg-[var(--input-bg)] rounded-xl transition-all group"
        >
          <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          이전 주
        </button>
        <button 
          onClick={goToCurrentWeek}
          className={`px-8 py-2 text-sm font-black rounded-xl transition-all ${
            isSameDay(startOfWeek(new Date(), { weekStartsOn: startDay as any }), weekStart)
              ? "bg-[var(--input-bg)] text-gray-400 cursor-default"
              : "bg-green-600 text-white shadow-md shadow-green-500/20 hover:shadow-lg hover:-translate-y-0.5"
          }`}
          disabled={isSameDay(startOfWeek(new Date(), { weekStartsOn: startDay as any }), weekStart)}
        >
          이번 주
        </button>
        <button 
          onClick={goToNextWeek}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 hover:text-green-600 hover:bg-[var(--input-bg)] rounded-xl transition-all group"
        >
          다음 주
          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
