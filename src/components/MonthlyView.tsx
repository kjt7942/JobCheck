import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Job } from "@/types";
import { buildOverrideIndex, getTasksForDate as getTasksForDateShared, isVirtualId, type RecurringScope } from "@/lib/recurrence";
import { Check, Trash2, Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Activity, Edit2, X, Sun, CloudRain, Cloud, CloudSnow, RefreshCw, CalendarRange, Camera, StickyNote } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { compressImage } from "@/utils/imageUtils";
import { authFetch } from "@/lib/firebase";
import { useApp } from "@/providers/AppProvider";
import { FARM_LAT, FARM_LNG } from "@/lib/weather";

registerLocale("ko", ko);

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
  // 현재 src의 로딩 완료 여부 (src가 바뀌면 자동으로 미완료 상태가 됨)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const isLoaded = loadedSrc === src;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--input-bg)] via-gray-200/30 to-[var(--input-bg)] animate-shimmer bg-[length:200%_100%]" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoadedSrc(src)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
};

export default function MonthlyView({
  tasks,
  farmInfo,
  onToggle,
  onDelete,
  onUpdate,
  canWrite = false,
  canDelete = false,
}: {
  tasks: Job[];
  farmInfo: { name?: string; weekStartsOn?: number };
  onToggle: (id: string, is_done: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Job>, newImageFiles?: File[], scope?: RecurringScope) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}) {
  const { settings, dailyWeather, showToast } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedImageInfo, setSelectedImageInfo] = useState<{ urls: string[], index: number } | null>(null);

  // 📝 일정 수정 상태 및 제어 함수들 (스마트 최적화)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editWeather, setEditWeather] = useState("맑음");
  const [editTmx, setEditTmx] = useState<string>("");
  const [editTmn, setEditTmn] = useState<string>("");
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editExistingUrls, setEditExistingUrls] = useState<string[]>([]);
  const [editFeedback, setEditFeedback] = useState("");
  const [editFeedbackTags, setEditFeedbackTags] = useState("");

  // 🔄 반복 일정 중간 규칙 변경용 (편집 대상이 반복 마스터의 가상 일정일 때만 노출)
  const [editRecurrence, setEditRecurrence] = useState<Job["recurrence"] | null>(null);

  // 🔄 반복 일정 수정 옵션 모달 및 펜딩 작업 상태
  const [showRecurrenceUpdateModal, setShowRecurrenceUpdateModal] = useState(false);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<Job> | null>(null);
  const [pendingNewImageFiles, setPendingNewImageFiles] = useState<File[] | undefined>(undefined);


  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // 같은 사진을 다시 골라도 onChange가 동작하도록 초기화
    if (files.length === 0) return;
    let compressedFiles: File[];
    try {
      compressedFiles = await Promise.all(files.map(file => compressImage(file)));
    } catch {
      showToast("사진을 불러오지 못했습니다. 다른 사진(JPG/PNG)으로 시도해 주세요.", "error");
      return;
    }
    const newPreviews = compressedFiles.map(file => URL.createObjectURL(file));
    setEditImageFiles(prev => [...prev, ...compressedFiles]);
    setEditImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setEditImageFiles(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(editImagePreviews[index]);
    setEditImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (url: string) => {
    setEditExistingUrls(prev => prev.filter(u => u !== url));
  };

  const startEdit = (job: Job) => {
    setEditingId(job.id!);
    setEditTitle(job.task);
    setEditDate(new Date(job.date));
    setEditWeather(job.weather || "맑음");
    setEditTmx(job.temp_max != null && !isNaN(Number(job.temp_max)) ? String(job.temp_max) : "");
    setEditTmn(job.temp_min != null && !isNaN(Number(job.temp_min)) ? String(job.temp_min) : "");
    setEditImageFiles([]);
    setEditImagePreviews([]);
    setEditExistingUrls(job.image_urls || []);
    setEditFeedback(job.feedback || "");
    setEditFeedbackTags(job.feedback_tags ? job.feedback_tags.join(", ") : "");
    setEditRecurrence(job.id?.includes(".") && job.recurrence ? { ...job.recurrence } : null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDate(null);
    setEditWeather("맑음");
    setEditTmx("");
    setEditTmn("");
    setEditImageFiles([]);
    setEditImagePreviews([]);
    setEditExistingUrls([]);
    setEditFeedback("");
    setEditFeedbackTags("");
    setEditRecurrence(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editDate) return;
    const updates = {
      task: editTitle.trim(),
      date: editDate.toISOString(),
      weather: editWeather,
      temp_max: editTmx ? parseFloat(editTmx) : null, // 빈칸이면 기존 값 삭제
      temp_min: editTmn ? parseFloat(editTmn) : null,
      image_urls: editExistingUrls,
      feedback: editFeedback.trim() || "",
      feedback_tags: editFeedbackTags
        ? editFeedbackTags.split(",").map(t => t.trim()).filter(t => t !== "")
        : [],
      ...(editRecurrence ? { recurrence: editRecurrence } : {})
    };

    if (isVirtualId(id)) {
      // 가상 일정 수정을 저장할 때는 팝업을 먼저 오픈해 사용자 선택을 유도함
      setPendingUpdateId(id);
      setPendingUpdates(updates);
      setPendingNewImageFiles(editImageFiles);
      setShowRecurrenceUpdateModal(true);
    } else {
      // 일반 단발성 일정일 때는 아무런 대화상자 없이 바로 진행
      onUpdate(id, updates, editImageFiles);
      setEditingId(null);
    }
  };

  const handleRecurrenceUpdateOption = (option: RecurringScope) => {
    if (!pendingUpdateId || !pendingUpdates) return;
    onUpdate(pendingUpdateId, pendingUpdates, pendingNewImageFiles, option);

    // 펜딩 리셋 및 닫기
    setPendingUpdateId(null);
    setPendingUpdates(null);
    setPendingNewImageFiles(undefined);
    setShowRecurrenceUpdateModal(false);
    setEditingId(null);
  };

  const weatherOptions = [
    { label: "맑음", icon: <Sun className="w-4 h-4" /> },
    { label: "흐림", icon: <Cloud className="w-4 h-4" /> },
    { label: "비", icon: <CloudRain className="w-4 h-4" /> },
    { label: "바람", icon: <Activity className="w-4 h-4" /> },
    { label: "눈", icon: <CloudSnow className="w-4 h-4" /> },
  ];

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

  // 📱 메인 화면 달 변경 터치 스와이프 감지 로직 (스마트폰 최적화)
  const [mainTouchStart, setMainTouchStart] = useState<number | null>(null);
  const [mainTouchEnd, setMainTouchEnd] = useState<number | null>(null);

  const onMainTouchStart = (e: React.TouchEvent) => {
    if (selectedImageInfo) return; // 이미지 모달 열림 시 제외
    setMainTouchEnd(null);
    setMainTouchStart(e.targetTouches[0].clientX);
  };

  const onMainTouchMove = (e: React.TouchEvent) => {
    if (selectedImageInfo) return;
    setMainTouchEnd(e.targetTouches[0].clientX);
  };

  const onMainTouchEnd = () => {
    if (selectedImageInfo) return;
    if (!mainTouchStart || !mainTouchEnd) return;
    const distance = mainTouchStart - mainTouchEnd;
    const swipeThreshold = 80; // 너무 민감하게 반응하지 않도록 80px 설정

    if (distance > swipeThreshold) {
      // 왼쪽으로 쓸기 -> 다음달로 이동
      nextMonth();
    } else if (distance < -swipeThreshold) {
      // 오른쪽으로 쓸기 -> 이전달로 이동
      prevMonth();
    }
  };

  // 💻 PC 마우스 드래그 달 변경 감지 로직 (PC 테스트 및 최적화)
  const [mainMouseDown, setMainMouseDown] = useState<number | null>(null);
  const [mainMouseEnd, setMainMouseEnd] = useState<number | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const onMainMouseDown = (e: React.MouseEvent) => {
    if (selectedImageInfo) return;
    const target = e.target as HTMLElement;
    // 클릭이 필요한 인터랙티브 요소는 드래그 대상에서 안전하게 제외
    if (target.closest('input') || target.closest('button') || target.closest('textarea') || target.closest('a')) return;
    
    setIsMouseDown(true);
    setMainMouseEnd(null);
    setMainMouseDown(e.clientX);
  };

  const onMainMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || selectedImageInfo) return;
    setMainMouseEnd(e.clientX);
  };

  const onMainMouseUp = () => {
    if (!isMouseDown) return;
    setIsMouseDown(false);
    
    if (selectedImageInfo) return;
    if (!mainMouseDown || !mainMouseEnd) return;
    
    const distance = mainMouseDown - mainMouseEnd;
    const swipeThreshold = 100; // 마우스 드래그는 살짝 더 묵직하게 100px 설정

    if (distance > swipeThreshold) {
      nextMonth();
    } else if (distance < -swipeThreshold) {
      prevMonth();
    }
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

  // 🚀 반복 일정 엔진(lib/recurrence) — 오버라이드 인덱스는 tasks가 바뀔 때만 재계산
  const overrideIndex = useMemo(() => buildOverrideIndex(tasks), [tasks]);
  const getTasksForDate = (day: Date) => getTasksForDateShared(tasks, day, overrideIndex, dailyWeather);

  const startDay = farmInfo?.weekStartsOn ?? 1;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: startDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: startDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // 달력에 보이는 날짜들의 일정을 한 번에 계산해 캐싱 (달력 셀마다 재계산되지 않도록)
  const tasksByDateMap = useMemo(() => {
    const map = new Map<string, Job[]>();
    calendarDays.forEach(day => {
      map.set(format(day, "yyyy-MM-dd"), getTasksForDate(day));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDays.length, currentDate, overrideIndex, tasks, dailyWeather]);

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const baseWeekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekDays = [
    ...baseWeekDays.slice(startDay),
    ...baseWeekDays.slice(0, startDay)
  ];

  // 선택된 날짜가 현재 달력 범위 안에 있으면 캐시를 재사용하고, 범위 밖(다른 달)이면 직접 계산
  const selectedDayTasks = tasksByDateMap.get(format(selectedDate, "yyyy-MM-dd")) ?? getTasksForDate(selectedDate);

  // 🔮 조회일이 오늘보다 미래인지 여부 판정 (미래 일정 기후 정보 노출 차단용)
  const isSelectedDateFuture = (() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const selStr = format(selectedDate, "yyyy-MM-dd");
    return selStr > todayStr;
  })();

  // 💡 현재 달의 작년(1년 전 동월) 피드백 노트 수집
  const lastYearMonthlyFeedbacks = (() => {
    return tasks.filter(t => {
      if (!t.feedback || t.is_cancelled) return false;
      const taskDate = new Date(t.date);
      return taskDate.getMonth() === currentDate.getMonth() && 
             taskDate.getFullYear() < currentDate.getFullYear();
    });
  })();

  return (
    <div 
      className="space-y-6 animate-in fade-in duration-500 pb-10"
      onTouchStart={onMainTouchStart}
      onTouchMove={onMainTouchMove}
      onTouchEnd={onMainTouchEnd}
      onMouseDown={onMainMouseDown}
      onMouseMove={onMainMouseMove}
      onMouseUp={onMainMouseUp}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-green-500/10 p-2 rounded-lg text-green-600">
            <CalendarRange className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
            {format(currentDate, "yyyy년 M월")}
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-green-500/10 rounded-full transition-colors active:scale-90">
            <ChevronLeft className="w-5 h-5 text-gray-400 hover:text-green-600" />
          </button>
          <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className="px-3 py-1 text-sm font-medium text-green-600 hover:bg-green-500/10 rounded-lg">
            오늘
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-green-500/10 rounded-full transition-colors active:scale-90">
            <ChevronRight className="w-5 h-5 text-gray-400 hover:text-green-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[var(--card-bg)] rounded-2xl md:rounded-3xl shadow-xl shadow-green-900/5 border border-[var(--card-border)] overflow-hidden">
        {/* Day Names */}
        <div className="grid grid-cols-7 bg-[var(--input-bg)] border-b border-[var(--card-border)]">
          {weekDays.map((day) => (
            <div key={day} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-bold text-green-600">
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayTasks = tasksByDateMap.get(format(day, "yyyy-MM-dd")) ?? [];
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`min-h-[60px] md:min-h-[100px] p-1 md:p-2 border-r border-b border-[var(--card-border)] transition-all cursor-pointer hover:bg-green-500/5 ${!isCurrentMonth ? "bg-[var(--input-bg)]/30 opacity-40" : ""
                  } ${isSelected ? "bg-green-500/5 ring-1 ring-inset ring-green-500/30" : ""} ${idx % 7 === 6 ? "border-r-0" : ""}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-row items-center gap-0.5 sm:gap-1 flex-wrap min-w-0">
                    <span className={`text-[10px] md:text-sm font-bold w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full transition-all ${isToday
                      ? "bg-green-600 text-white shadow-lg shadow-green-500/20 scale-105"
                      : isSelected
                        ? "bg-green-500/20 text-green-700"
                        : isCurrentMonth ? "text-[var(--foreground)]" : "text-gray-400 opacity-50"
                      }`}>
                      {format(day, "d")}
                    </span>

                    {/* 🌦️ 월간 달력 일별 날씨 및 최고/최저기온 칩 초밀착 구겨넣기 버전 */}
                    {(() => {
                      const todayStr = format(new Date(), "yyyy-MM-dd");
                      const dayStr = format(day, "yyyy-MM-dd");
                      if (dayStr > todayStr) return null; // 미래 날짜는 날씨 표시 안함

                      const weatherTask = dayTasks.find(t => t.weather || (t.temp_max !== undefined && t.temp_max !== null && !isNaN(Number(t.temp_max))) || (t.temp_min !== undefined && t.temp_min !== null && !isNaN(Number(t.temp_min))));
                      const weatherData = weatherTask ?? dailyWeather[dayStr];
                      if (!weatherData) return null;
                      const rain = weatherData.rain_mm ?? dailyWeather[dayStr]?.rain_mm; // 일정에 없으면 캐시 강수량
                      return (
                        <div className="flex items-center gap-0.5 text-[7.5px] md:text-[9px] text-green-600 font-bold bg-green-500/5 px-0.5 md:px-1 py-0 rounded scale-[0.82] sm:scale-100 origin-left shrink-0 ml-[-2px] sm:ml-0">
                          {weatherData.weather && (
                            <span className="flex items-center">
                              {weatherData.weather.includes("맑음") ? <Sun className="w-2 md:w-2.5 h-2 md:h-2.5 text-amber-500 shrink-0" /> :
                               weatherData.weather.includes("비") ? <CloudRain className="w-2 md:w-2.5 h-2 md:h-2.5 text-blue-500 shrink-0" /> :
                               weatherData.weather.includes("흐림") ? <Cloud className="w-2 md:w-2.5 h-2 md:h-2.5 text-gray-500 shrink-0" /> :
                               weatherData.weather.includes("눈") ? <CloudSnow className="w-2 md:w-2.5 h-2 md:h-2.5 text-blue-300 shrink-0" /> :
                               <Cloud className="w-2 md:w-2.5 h-2 md:h-2.5 shrink-0" />}
                            </span>
                          )}
                          {((weatherData.temp_max !== undefined && weatherData.temp_max !== null && !isNaN(Number(weatherData.temp_max))) ||
                            (weatherData.temp_min !== undefined && weatherData.temp_min !== null && !isNaN(Number(weatherData.temp_min)))) && (
                            <span className="flex items-center font-mono scale-[0.9] pl-0.5 shrink-0 ml-0.5 border-l border-green-500/10">
                              {weatherData.temp_max !== undefined && weatherData.temp_max !== null && !isNaN(Number(weatherData.temp_max)) && <span className="text-red-400 font-black">{weatherData.temp_max}</span>}
                              {weatherData.temp_max !== undefined && weatherData.temp_max !== null && !isNaN(Number(weatherData.temp_max)) &&
                               weatherData.temp_min !== undefined && weatherData.temp_min !== null && !isNaN(Number(weatherData.temp_min)) && <span className="text-gray-400 opacity-40 mx-[0.5px]">/</span>}
                              {weatherData.temp_min !== undefined && weatherData.temp_min !== null && !isNaN(Number(weatherData.temp_min)) && <span className="text-blue-400 font-black">{weatherData.temp_min}</span>}
                            </span>
                          )}
                          {(rain ?? 0) > 0 && <span className="font-mono text-sky-500 ml-0.5 shrink-0">💧{rain}mm</span>}
                        </div>
                      );
                    })()}
                  </div>
                  {dayTasks.length > 0 && (
                    <span className="text-[8px] md:text-[10px] bg-green-500/10 text-green-600 px-1 md:px-1.5 py-0.5 rounded font-bold">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="hidden md:block space-y-1">
                    {dayTasks.slice(0, 3).map((task) => {
                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canWrite) {
                              startEdit(task);
                            }
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md truncate border ${task.is_done
                            ? "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 line-through opacity-50"
                            : "bg-[var(--card-bg)] border-green-500/20 text-green-600 shadow-sm"
                            } ${canWrite ? "cursor-pointer hover:bg-green-500/10 transition-colors" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1 overflow-hidden">
                          <span className="truncate">{task.task}</span>
                          {task.image_urls && task.image_urls.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageInfo({ urls: task.image_urls!, index: 0 });
                              }}
                              className="hover:scale-125 active:scale-90 transition-transform p-0.5 shrink-0"
                              title="사진 보기"
                            >
                              <Camera className="w-2.5 h-2.5 text-green-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                   })}
                  {dayTasks.length > 3 && (
                    <p className="text-[9px] text-gray-400 pl-1">
                      외 {dayTasks.length - 3}개...
                    </p>
                  )}
                </div>

                {/* Mobile Task Dots */}
                <div className="md:hidden flex flex-wrap gap-0.5 mt-1">
                  {dayTasks.slice(0, 4).map((_, i) => (
                    <div key={i} className={`w-1 h-1 rounded-full ${dayTasks[i].is_done ? 'bg-gray-300' : 'bg-green-500'}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 💡 작년 이맘때(동월) 대장님의 개선 노트 요약 아코디언 */}
      {lastYearMonthlyFeedbacks.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 animate-in slide-in-from-top duration-300">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer font-bold text-xs text-orange-600 list-none select-none">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-orange-500" />
                <span>💡 작년 {format(currentDate, "M월")} 농장 개선 조언 ({lastYearMonthlyFeedbacks.length}건)</span>
              </div>
              <span className="text-[10px] text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {lastYearMonthlyFeedbacks.map((t, idx) => (
                <div key={t.id || idx} className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed border-b border-orange-500/5 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-[var(--foreground)]">[{t.task}]</span>
                    <span className="text-[9px] text-gray-400 font-mono">{format(new Date(t.date), "yyyy-MM-dd")}</span>
                  </div>
                  <p>{t.feedback}</p>
                  {t.feedback_tags && t.feedback_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.feedback_tags.map(tag => (
                        <span key={tag} className="bg-orange-500/5 text-orange-600 border border-orange-500/10 px-1 py-0.2 rounded text-[9px] font-bold">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Selected Day Tasks (선택한 날짜의 일정 목록 — 데스크톱에서도 체크/수정/삭제 가능하도록 항상 표시) */}
      <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-green-600" />
            {format(selectedDate, "M월 d일")} 일정
          </h3>
          <span className="text-xs text-gray-400 font-medium">총 {selectedDayTasks.length}건</span>
        </div>

        <div className="space-y-2">
          {selectedDayTasks.length === 0 ? (
            <div className="bg-[var(--card-bg)] rounded-2xl p-6 text-center border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">일정이 없습니다.</p>
            </div>
          ) : (
            selectedDayTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center gap-3 transition-transform ${task.is_done ? 'opacity-60' : ''}`}
              >
                {/* 모바일 체크박스 토글 연동 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canWrite) onToggle(task.id!, !task.is_done);
                  }}
                  disabled={!canWrite}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${task.is_done ? 'bg-green-500 border-green-500' : 'border-gray-200'} ${!canWrite ? 'opacity-50 cursor-default' : 'active:scale-90'}`}
                >
                  {task.is_done && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${task.is_done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {task.task}
                  </p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {format(new Date(task.date), "HH:mm")}
                    {task.image_urls && task.image_urls.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImageInfo({ urls: task.image_urls!, index: 0 });
                        }}
                        className="flex items-center gap-0.5 ml-1 text-green-500 font-bold hover:bg-green-500/10 px-1 rounded transition-colors"
                      >
                        <Camera className="w-3 h-3" />
                        {task.image_urls.length}
                      </button>
                    )}
                  </p>
                </div>
                {!isSelectedDateFuture && (task.weather || 
                  (task.temp_max !== undefined && task.temp_max !== null && !isNaN(Number(task.temp_max))) || 
                  (task.temp_min !== undefined && task.temp_min !== null && !isNaN(Number(task.temp_min)))) && (
                  <div className="flex flex-col items-end gap-0.5 text-[10px] bg-green-500/10 text-green-600 px-2.5 py-1 rounded-xl font-bold shrink-0">
                    {task.weather && (
                      <span className="flex items-center gap-0.5">
                        {task.weather.includes("맑음") ? <Sun className="w-3 h-3 text-amber-500 shrink-0" /> :
                         task.weather.includes("비") ? <CloudRain className="w-3 h-3 text-blue-500 shrink-0" /> :
                         task.weather.includes("흐림") ? <Cloud className="w-3 h-3 text-gray-500 shrink-0" /> :
                         task.weather.includes("눈") ? <CloudSnow className="w-3 h-3 text-blue-300 shrink-0" /> :
                         <Cloud className="w-3 h-3 shrink-0" />}
                        {task.weather}
                      </span>
                    )}
                    {((task.temp_max !== undefined && task.temp_max !== null && !isNaN(Number(task.temp_max))) || 
                      (task.temp_min !== undefined && task.temp_min !== null && !isNaN(Number(task.temp_min)))) && (
                      <span className="flex items-center font-mono text-[9px] mt-0.5">
                        {task.temp_max !== undefined && task.temp_max !== null && !isNaN(Number(task.temp_max)) && <span className="text-red-400">{task.temp_max}℃</span>}
                        {task.temp_max !== undefined && task.temp_max !== null && !isNaN(Number(task.temp_max)) && 
                         task.temp_min !== undefined && task.temp_min !== null && !isNaN(Number(task.temp_min)) && <span className="text-gray-400 opacity-50 mx-0.5">/</span>}
                        {task.temp_min !== undefined && task.temp_min !== null && !isNaN(Number(task.temp_min)) && <span className="text-blue-400">{task.temp_min}℃</span>}
                      </span>
                    )}
                    {(task.rain_mm ?? 0) > 0 && <span className="font-mono text-[9px] mt-0.5 ml-1 text-sky-500">💧{task.rain_mm}mm</span>}
                  </div>
                )}
                {/* 모바일 액션 단추 (수정/삭제) */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {canWrite && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                      className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-all active:scale-90"
                      title="수정"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all active:scale-90"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Monthly Summary Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span>진행 중</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--input-bg)] border border-[var(--card-border)]" />
          <span>완료</span>
        </div>
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

      {/* 📱 모바일 최적화 수정 보텀 시트 모달 */}
      {editingId && (
        <div 
          className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={cancelEdit}
        >
          <div 
            className="w-full max-w-md bg-[var(--card-bg)] rounded-[32px] p-6 shadow-2xl border border-[var(--card-border)] flex flex-col animate-in zoom-in-95 duration-300 max-h-[85vh] md:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)] mb-4">
              <h3 className="text-lg font-extrabold text-[var(--foreground)]">일정 수정</h3>
              <button 
                onClick={cancelEdit}
                className="p-1.5 hover:bg-[var(--input-bg)] rounded-full text-gray-400 hover:text-gray-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form - 내용물만 스크롤 가능하도록 flex-1 및 overflow-y-auto 부여 */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 pb-4 scrollbar-thin">
              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase">일정 내용</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all font-bold"
                />
              </div>

              {/* Date & Time (날짜/시간 변경 완전 분리) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-green-500" /> 날짜 변경
                  </label>
                  <DatePicker
                    selected={editDate}
                    onChange={(date: Date | null) => setEditDate(date)}
                    dateFormat="yyyy.MM.dd"
                    locale="ko"
                    className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] font-bold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all cursor-pointer text-center"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-green-500" /> 시간 변경
                  </label>
                  <DatePicker
                    selected={editDate}
                    onChange={(date: Date | null) => setEditDate(date)}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeCaption="시간"
                    dateFormat="HH:mm"
                    locale="ko"
                    className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] font-bold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all cursor-pointer text-center"
                  />
                </div>
              </div>

              {/* Weather Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase">날씨 선택</label>
                  <button
                    type="button"
                    onClick={async () => {
                      // 🚀 기상청 공식 단기예보 API 연동
                      const lat = settings?.latitude ?? FARM_LAT;
                      const lng = settings?.longitude ?? FARM_LNG;

                      let apiSuccess = false;
                      let autoTempMax = 30;
                      let autoTempMin = 12;
                      let autoWeather = "맑음";

                      try {
                        const apiUrl = `/api/weather?lat=${lat}&lng=${lng}`;

                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 4500); // 4.5초 타임아웃

                        const response = await authFetch(apiUrl, { signal: controller.signal });
                        clearTimeout(id);

                        if (response.ok) {
                          const data = await response.json();
                          if (data.success) {
                            autoTempMax = data.temp_max;
                            autoTempMin = data.temp_min;
                            autoWeather = data.weather;
                            apiSuccess = true;
                          }
                        }
                      } catch (error) {
                        console.warn("기상청 날씨 API 호출 실패:", error);
                      }

                      if (apiSuccess) {
                        setEditTmx(String(autoTempMax));
                        setEditTmn(String(autoTempMin));
                        setEditWeather(autoWeather);
                      } else {
                        alert("⚠️ 기상청 날씨 연동에 실패했습니다. 날씨와 기온을 직접 입력해 주세요!");
                      }
                    }}
                    className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg hover:bg-blue-500/20 transition-all active:scale-95"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> 🌦️ 농장 기상 연동
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {weatherOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setEditWeather(prev => prev === opt.label ? "" : opt.label)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95 ${editWeather === opt.label
                        ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-500/10"
                        : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:border-green-500/30 hover:bg-[var(--card-bg)]"
                        }`}
                    >
                      {opt.icon}
                      <span className="text-[9px] mt-1 font-bold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Temperatures */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">최고 기온</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="-30"
                      max="50"
                      value={editTmx}
                      onChange={(e) => setEditTmx(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2 text-sm text-red-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center font-extrabold"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">℃</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">최저 기온</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="-30"
                      max="50"
                      value={editTmn}
                      onChange={(e) => setEditTmn(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2 text-sm text-blue-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center font-extrabold"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">℃</span>
                  </div>
                </div>
              </div>

              {/* 🔄 반복 주기 변경 (반복 마스터에서 파생된 가상 일정일 때만 노출) */}
              {editRecurrence && (
                <div className="space-y-2 pt-1 border-t border-[var(--card-border)] pt-3">
                  <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 text-green-500" /> 반복 주기 변경
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { label: '매일', value: 'DAILY' },
                      { label: '매주', value: 'WEEKLY' },
                      { label: '격주', value: 'BIWEEKLY' },
                      { label: '매월', value: 'MONTHLY' },
                      { label: '지정', value: 'CUSTOM' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditRecurrence(prev => ({ ...(prev as Job["recurrence"]), type: opt.value } as Job["recurrence"]))}
                        className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${editRecurrence.type === opt.value
                          ? "bg-[var(--foreground)] border-transparent text-[var(--background)] shadow-sm"
                          : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:bg-[var(--card-bg)] hover:border-green-500/30"
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {editRecurrence.type === 'CUSTOM' && (
                    <div className="flex items-center gap-2 bg-green-500/10 p-3 rounded-xl border border-green-500/20">
                      <span className="text-xs font-bold text-green-600">간격:</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={editRecurrence.interval}
                        onChange={(e) => setEditRecurrence(prev => ({ ...(prev as Job["recurrence"]), interval: Number(e.target.value) || 1 } as Job["recurrence"]))}
                        className="w-16 bg-[var(--card-bg)] border border-green-500/30 rounded-lg px-2 py-1 text-sm font-bold text-green-600 outline-none focus:ring-2 focus:ring-green-500/20"
                      />
                      <span className="text-xs font-bold text-green-600">일 마다 반복</span>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    저장 시 &quot;이 일정과 이후 일정 일괄 수정&quot; 또는 &quot;전체 반복 일정 일괄 수정&quot;을 선택해야 반영됩니다.
                  </p>
                </div>
              )}

              {/* Image Attachments */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-gray-400 uppercase">사진 관리</label>
                <div className="flex flex-wrap gap-2">
                  {/* 기존 이미지 */}
                  {editExistingUrls.map((url, idx) => (
                    <div key={`existing-${idx}`} className="relative w-14 h-14 rounded-xl overflow-hidden border border-[var(--card-border)] group">
                      <img
                        src={url}
                        alt="기존 이미지"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(url)}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full transition-opacity shadow-md"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}

                  {/* 신규 이미지 */}
                  {editImagePreviews.map((url, idx) => (
                    <div key={`new-${idx}`} className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-green-500/20 group">
                      <img
                        src={url}
                        alt="신규 이미지"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full transition-opacity shadow-md"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}

                  <label className="w-14 h-14 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--card-border)] hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer">
                    <Camera className="w-5 h-5 text-gray-400" />
                    <span className="text-[8px] text-gray-400 mt-0.5 font-bold">추가</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              </div>

              {/* 🆕 영농 피드백 입력란 */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1 text-orange-500">
                  <span>📝 영농 피드백 (내년에 참고할 점)</span>
                </label>
                <textarea
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  placeholder="올해 작업 중 개선할 점, 실수, 조치 사항 등을 기록해 주세요."
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all font-medium min-h-[70px] resize-y"
                />
              </div>

              {/* 🆕 영농 피드백 태그 입력란 */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-gray-400 uppercase text-orange-500">🏷️ 피드백 태그</label>
                <input
                  type="text"
                  value={editFeedbackTags}
                  onChange={(e) => setEditFeedbackTags(e.target.value)}
                  placeholder="쉼표(,)로 구분하여 입력 (예: 상추, 비료, 장마)"
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
              <button
                onClick={cancelEdit}
                className="flex-1 bg-[var(--input-bg)] hover:bg-gray-200/50 text-gray-500 text-sm font-bold py-3.5 rounded-xl transition-all active:scale-95"
              >
                취소
              </button>
              <button
                onClick={() => handleSaveEdit(editingId)}
                disabled={!editTitle.trim() || !editDate}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-3.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-green-600/20 active:scale-95"
              >
                변경사항 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔄 반복 일정 수정 옵션 선택 모달 */}
      {showRecurrenceUpdateModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 px-4"
          onClick={() => setShowRecurrenceUpdateModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[var(--card-bg)] rounded-[32px] p-6 shadow-2xl border border-[var(--card-border)] flex flex-col space-y-6 animate-in zoom-in-95 duration-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4 text-green-600">
                <RefreshCw className="w-6 h-6 animate-spin-slow" />
              </div>
              <h4 className="text-md font-extrabold text-[var(--foreground)]">반복 일정 수정 옵션</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                이 반복 일정의 변경사항을 어떻게 반영할까요?
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleRecurrenceUpdateOption("single")}
                className="w-full bg-green-600 hover:bg-green-700 text-[var(--background)] text-xs font-black py-3.5 rounded-xl transition-all shadow-md shadow-green-600/10 active-scale"
              >
                📍 이 일정만 수정
              </button>
              <button
                onClick={() => handleRecurrenceUpdateOption("following")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-3.5 rounded-xl transition-all shadow-md shadow-blue-600/10 active-scale"
              >
                ⏭️ 이 일정과 이후 일정 일괄 수정
              </button>
              <button
                onClick={() => handleRecurrenceUpdateOption("all")}
                className="w-full bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 text-xs font-black py-3.5 rounded-xl transition-all active-scale"
              >
                🔄 전체 반복 일정 일괄 수정
              </button>
              <button
                onClick={() => setShowRecurrenceUpdateModal(false)}
                className="w-full bg-[var(--input-bg)] text-gray-500 text-xs font-bold py-3.5 rounded-xl hover:bg-gray-200/50 transition-all active-scale"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
