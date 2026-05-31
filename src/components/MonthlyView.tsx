import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Job } from "@/types";
import { Plus, Check, Trash2, Clock, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Activity, Search, Edit2, X, Save, Sun, CloudRain, Cloud, CloudSnow, RefreshCw, CalendarDays, CalendarRange, Camera } from "lucide-react";

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

export default function MonthlyView({
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
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

  // 🚀 월간 달력용 실시간 가상 일정 복원 렌더링 엔진 (오버라이드, 취소 필터링 완벽 적용)
  const getTasksForDate = (targetDate: Date) => {
    const list: Job[] = [];
    const instancesByGroupDate = new Map<string, Job>();
    const cancelledByGroupDate = new Set<string>();

    // 1. 실제 인스턴스 및 취소 처리된 건들을 사전 분류하여 Map/Set에 저장
    tasks.forEach(t => {
      if (t.is_instance && t.instance_date) {
        const key = `${t.group_id}_${t.instance_date}`;
        instancesByGroupDate.set(key, t);
      }
      if (t.is_cancelled && t.instance_date) {
        const key = `${t.group_id}_${t.instance_date}`;
        cancelledByGroupDate.add(key);
      }
    });

    const targetDateStr = format(targetDate, "yyyy-MM-dd");

    // 2. 전체 DB 데이터를 순회하며 오늘 보여줄 일정 계산
    tasks.forEach(t => {
      // 2-1. 개별 변경된 인스턴스나 삭제 기록은 직접 삽입 보류
      // -> 단, 날짜가 수정된 단독 인스턴스는 날짜가 맞으면 보여줘야 함!
      if (t.is_instance || t.is_cancelled) {
        if (t.is_instance && !t.is_cancelled && format(new Date(t.date), "yyyy-MM-dd") === targetDateStr) {
          if (!list.some(existing => existing.id === t.id)) {
            list.push(t);
          }
        }
        return;
      }

      // 2-2. 일반 일정 (반복 설정이 없음) -> 단순 날짜 비교 (타임존 오류 원천 차단)
      if (!t.recurrence) {
        if (format(new Date(t.date), "yyyy-MM-dd") === targetDateStr) {
          list.push(t);
        }
        return;
      }

      // 2-3. 반복 마스터 일정 -> 동적 가상 일정 연산
      const masterStartDate = new Date(t.date);
      const masterEndDate = new Date(t.recurrence.end_date);
      
      // 조회일이 반복 범위(시작일~종료일) 밖이면 노출 대상 아님
      const viewDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const startDateOnly = new Date(masterStartDate.getFullYear(), masterStartDate.getMonth(), masterStartDate.getDate());
      const endDateOnly = new Date(masterEndDate.getFullYear(), masterEndDate.getMonth(), masterEndDate.getDate());

      if (viewDateOnly < startDateOnly || viewDateOnly > endDateOnly) {
        return;
      }

      // 예외 인스턴스(오늘 날짜에 삭제된 건이 있는지) 체크
      const key = `${t.group_id}_${targetDateStr}`;
      if (cancelledByGroupDate.has(key)) {
        return; // 삭제 처리 완료 -> 화면 노출 건너뜀
      }

      // 가상 일정 오버라이드 체크 (이미 값을 수정해서 실제 인스턴스로 바뀐 게 있는지)
      const instanceOverride = instancesByGroupDate.get(key);
      if (instanceOverride) {
        // 단, 인스턴스의 실제 날짜가 오늘(targetDateStr)과 같을 때만 오늘 리스트에 담는다!
        if (format(new Date(instanceOverride.date), "yyyy-MM-dd") === targetDateStr) {
          list.push(instanceOverride);
        }
        return;
      }

      // 주기에 따라 오늘 렌더링할 것인지 수학적 연산
      let shouldRender = false;
      const diffDays = Math.floor((viewDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0) {
        const type = t.recurrence.type;
        const interval = t.recurrence.interval || 1;

        if (type === "DAILY") {
          shouldRender = (diffDays % interval === 0);
        } else if (type === "WEEKLY") {
          shouldRender = (diffDays % (7 * interval) === 0);
        } else if (type === "BIWEEKLY") {
          shouldRender = (diffDays % (14 * interval) === 0);
        } else if (type === "MONTHLY") {
          const targetMonthDays = (viewDateOnly.getFullYear() - startDateOnly.getFullYear()) * 12 + (viewDateOnly.getMonth() - startDateOnly.getMonth());
          shouldRender = (targetMonthDays % interval === 0 && viewDateOnly.getDate() === startDateOnly.getDate());
        } else if (type === "CUSTOM") {
          shouldRender = (diffDays % interval === 0);
        }
      }

      if (shouldRender) {
        // 가상 일정 렌더링용 객체 조립 (가상 ID 생성)
        list.push({
          ...t,
          id: `${t.id}.${targetDateStr}`, // virtual id
          date: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
          instance_date: targetDateStr
        });
      }
    });

    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const startDay = farmInfo?.weekStartsOn ?? 1;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: startDay as any });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: startDay as any });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const baseWeekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekDays = [
    ...baseWeekDays.slice(startDay),
    ...baseWeekDays.slice(0, startDay)
  ];

  const selectedDayTasks = getTasksForDate(selectedDate);

  // 🔮 조회일이 오늘보다 미래인지 여부 판정 (미래 일정 기후 정보 노출 차단용)
  const isSelectedDateFuture = (() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const selStr = format(selectedDate, "yyyy-MM-dd");
    return selStr > todayStr;
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
            const dayTasks = getTasksForDate(day);
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

                      const weatherTask = dayTasks.find(t => t.weather || t.temp_max !== undefined || t.temp_min !== undefined);
                      if (!weatherTask) return null;
                      return (
                        <div className="flex items-center gap-0.5 text-[7.5px] md:text-[9px] text-green-600 font-bold bg-green-500/5 px-0.5 md:px-1 py-0 rounded scale-[0.82] sm:scale-100 origin-left shrink-0 ml-[-2px] sm:ml-0">
                          {weatherTask.weather && (
                            <span className="flex items-center">
                              {weatherTask.weather.includes("맑음") ? <Sun className="w-2 md:w-2.5 h-2 md:h-2.5 text-amber-500 shrink-0" /> :
                               weatherTask.weather.includes("비") ? <CloudRain className="w-2 md:w-2.5 h-2 md:h-2.5 text-blue-500 shrink-0" /> :
                               weatherTask.weather.includes("흐림") ? <Cloud className="w-2 md:w-2.5 h-2 md:h-2.5 text-gray-500 shrink-0" /> :
                               weatherTask.weather.includes("눈") ? <CloudSnow className="w-2 md:w-2.5 h-2 md:h-2.5 text-blue-300 shrink-0" /> :
                               <Cloud className="w-2 md:w-2.5 h-2 md:h-2.5 shrink-0" />}
                            </span>
                          )}
                          {(weatherTask.temp_max !== undefined || weatherTask.temp_min !== undefined) && (
                            <span className="flex items-center font-mono scale-[0.9] pl-0.5 shrink-0 ml-0.5 border-l border-green-500/10">
                              {weatherTask.temp_max !== undefined && <span className="text-red-400 font-black">{weatherTask.temp_max}</span>}
                              {weatherTask.temp_max !== undefined && weatherTask.temp_min !== undefined && <span className="text-gray-400 opacity-40 mx-[0.5px]">/</span>}
                              {weatherTask.temp_min !== undefined && <span className="text-blue-400 font-black">{weatherTask.temp_min}</span>}
                            </span>
                          )}
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
                    {dayTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          if (task.image_urls && task.image_urls.length > 0) {
                            e.stopPropagation();
                            setSelectedImageInfo({ urls: task.image_urls, index: 0 });
                          }
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md truncate border ${task.is_done
                          ? "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 line-through opacity-50"
                          : "bg-[var(--card-bg)] border-green-500/20 text-green-600 shadow-sm"
                          } ${task.image_urls && task.image_urls.length > 0 ? "cursor-pointer hover:bg-green-500/10 transition-colors" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1 overflow-hidden">
                          <span className="truncate">{task.task}</span>
                          {task.image_urls && task.image_urls.length > 0 && <Camera className="w-2.5 h-2.5 text-green-500 shrink-0" />}
                        </div>
                      </div>
                    ))}
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

      {/* Selected Day Tasks (Mobile Optimized List) */}
      <div className="md:hidden space-y-4 animate-in slide-in-from-bottom-2 duration-300">
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
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${task.is_done ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
                  {task.is_done && <Check className="w-3 h-3 text-white" />}
                </div>
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
                {!isSelectedDateFuture && (task.weather || task.temp_max !== undefined || task.temp_min !== undefined) && (
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
                    {(task.temp_max !== undefined || task.temp_min !== undefined) && (
                      <span className="flex items-center font-mono text-[9px] mt-0.5">
                        {task.temp_max !== undefined && <span className="text-red-400">{task.temp_max}℃</span>}
                        {task.temp_max !== undefined && task.temp_min !== undefined && <span className="text-gray-400 opacity-50 mx-0.5">/</span>}
                        {task.temp_min !== undefined && <span className="text-blue-400">{task.temp_min}℃</span>}
                      </span>
                    )}
                  </div>
                )}
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
    </div>
  );
}
