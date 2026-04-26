import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, Circle, Trash2, CalendarDays, Edit2, X, Save, Clock, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { useState, useEffect } from "react";
import { Job } from "@/types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// 🎨 스켈레톤 UI 포함 이미지 컴포넌트
const ImageWithSkeleton = ({ src, alt, className, onClick, onTouchStart, onTouchMove, onTouchEnd }: { 
  src: string, 
  alt: string, 
  className?: string, 
  onClick?: React.MouseEventHandler,
  onTouchStart?: React.TouchEventHandler,
  onTouchMove?: React.TouchEventHandler,
  onTouchEnd?: React.TouchEventHandler
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--input-bg)] via-gray-200/30 to-[var(--input-bg)] animate-shimmer bg-[length:200%_100%]" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
};

export default function WeeklyView({
  tasks,
  farmInfo,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  canWrite = false,
  canDelete = false,
}: {
  tasks: Job[];
  farmInfo: any;
  onAdd: (task: string, date: string) => void;
  onToggle: (id: string, is_done: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Job>) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedImageInfo, setSelectedImageInfo] = useState<{ urls: string[], index: number } | null>(null);

  // 이미지 슬라이드 이동 로직
  const goToNextImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (!selectedImageInfo) return;
    const { urls, index } = selectedImageInfo;
    setSelectedImageInfo({ urls, index: index < urls.length - 1 ? index + 1 : 0 });
  };

  const goToPrevImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (!selectedImageInfo) return;
    const { urls, index } = selectedImageInfo;
    setSelectedImageInfo({ urls, index: index > 0 ? index - 1 : urls.length - 1 });
  };

  // 스와이프 감지 로직
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) goToNextImage();
    if (distance < -minSwipeDistance) goToPrevImage();
  };

  // 🔒 모달 오픈 시 배경 스크롤 방지
  useEffect(() => {
    if (selectedImageInfo) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedImageInfo]);

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
              className={`flex flex-col rounded-2xl border transition-all duration-300 min-h-[300px] ${isToday
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
                            <button onClick={() => handleSaveEdit(task.id!)} className="p-1 rounded bg-green-500 text-white hover:bg-green-600"><Save className="w-3 h-3" /></button>
                            <button onClick={cancelEdit} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 transition-colors ${task.is_done ? "text-green-500" : "text-gray-300"}`}>
                            {task.is_done
                              ? <Check className="w-4 h-4" />
                              : <Circle className="w-4 h-4" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold leading-tight truncate flex items-center gap-1 ${task.is_done ? "text-gray-400 line-through opacity-50" : "text-[var(--foreground)]"}`}>
                              {task.task}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-gray-400 font-mono">
                                {format(new Date(task.date), "HH:mm")}
                              </p>
                              {task.image_urls && task.image_urls.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageInfo({ urls: task.image_urls!, index: 0 });
                                  }}
                                  className="flex items-center gap-0.5 text-green-500 font-bold hover:bg-green-500/10 px-1 rounded transition-all active:scale-95"
                                >
                                  <Camera className="w-3 h-3" />
                                  <span className="text-[10px]">{task.image_urls.length}</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {canWrite && (
                              <button
                                onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                                className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-500/10 rounded-md transition-all"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
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
          className={`px-8 py-2 text-sm font-black rounded-xl transition-all ${isSameDay(startOfWeek(new Date(), { weekStartsOn: startDay as any }), weekStart)
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

      {/* 🖼️ Image Modal */}
      {selectedImageInfo && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setSelectedImageInfo(null)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Top Bar: Counter & Close */}
          <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-[110] bg-gradient-to-b from-black/50 to-transparent">
            <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-white text-xs font-bold font-mono">
              {selectedImageInfo.index + 1} / {selectedImageInfo.urls.length}
            </div>
            <button
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-95"
              onClick={() => setSelectedImageInfo(null)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Image Container */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Navigation Buttons */}
            {selectedImageInfo.urls.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 z-[110] group active:scale-90 transition-all"
                >
                  <div className="p-3 sm:p-5 bg-black/40 hover:bg-black/60 text-white rounded-full border border-white/20 backdrop-blur-md transition-all shadow-xl">
                    <ChevronLeft className="w-6 h-6 sm:w-10 sm:h-10 group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 z-[110] group active:scale-90 transition-all"
                >
                  <div className="p-3 sm:p-5 bg-black/40 hover:bg-black/60 text-white rounded-full border border-white/20 backdrop-blur-md transition-all shadow-xl">
                    <ChevronRight className="w-6 h-6 sm:w-10 sm:h-10 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </>
            )}

            <div className="relative max-w-4xl w-full h-full flex items-center justify-center overflow-hidden">
              <ImageWithSkeleton
                src={selectedImageInfo.urls[selectedImageInfo.index]}
                alt="확대 이미지"
                className="max-w-full max-h-full rounded-lg shadow-2xl transition-all duration-300 min-w-[200px] min-h-[200px]"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
