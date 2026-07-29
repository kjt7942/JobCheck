import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Job } from "@/types";
import { Plus, Check, Trash2, Clock, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Activity, Search, Edit2, X, Save, Sun, CloudRain, Cloud, CloudSnow, RefreshCw, CalendarDays, CalendarRange, Camera, StickyNote } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { compressImage } from "@/utils/imageUtils";
import { useApp } from "@/providers/AppProvider";

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
  onAdd: (
    task: string, 
    date: string, 
    weather?: string, 
    temp_max?: string | number, 
    temp_min?: string | number, 
    group_id?: string, 
    imageFiles?: File[],
    recurrence?: any,
    is_instance?: boolean,
    instance_date?: string,
    is_cancelled?: boolean,
    is_done?: boolean
  ) => void;
  onToggle: (id: string, is_done: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Job>, newImageFiles?: File[]) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}) {
  const { settings, dailyWeather } = useApp();
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

  // 🔄 반복 일정 수정 옵션 모달 및 펜딩 작업 상태
  const [showRecurrenceUpdateModal, setShowRecurrenceUpdateModal] = useState(false);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<Job> | null>(null);
  const [pendingNewImageFiles, setPendingNewImageFiles] = useState<File[] | undefined>(undefined);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const compressedFiles = await Promise.all(
      files.map(file => compressImage(file))
    );
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
    setEditTmx(job.temp_max ? String(job.temp_max) : "");
    setEditTmn(job.temp_min ? String(job.temp_min) : "");
    setEditImageFiles([]);
    setEditImagePreviews([]);
    setEditExistingUrls(job.image_urls || []);
    setEditFeedback(job.feedback || "");
    setEditFeedbackTags(job.feedback_tags ? job.feedback_tags.join(", ") : "");
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
  };

  // 가상 일정 id("마스터ID.YYYY-MM-DD")에서 인스턴스 날짜를 로컬 타임존 기준으로 안전하게 파싱
  const parseInstanceDate = (instDate: string, hours: number, minutes: number) => {
    const [y, m, d] = instDate.split('-').map(Number);
    return new Date(y, m - 1, d, hours, minutes);
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editDate) return;
    const updates = {
      task: editTitle.trim(),
      date: editDate.toISOString(),
      weather: editWeather,
      temp_max: editTmx ? parseFloat(editTmx) : undefined,
      temp_min: editTmn ? parseFloat(editTmn) : undefined,
      image_urls: editExistingUrls,
      feedback: editFeedback.trim() || "",
      feedback_tags: editFeedbackTags
        ? editFeedbackTags.split(",").map(t => t.trim()).filter(t => t !== "")
        : []
    };

    if (id.includes('.')) {
      // 가상 일정 수정을 저장할 때는 팝업을 먼저 오픈해 사용자 선택을 유도함
      setPendingUpdateId(id);
      setPendingUpdates(updates);
      setPendingNewImageFiles(editImageFiles);
      setShowRecurrenceUpdateModal(true);
    } else {
      // 일반 단발성 일정일 때는 아무런 대화상자 없이 바로 진행
      handleUpdateClick(id, updates, editImageFiles);
      setEditingId(null);
    }
  };

  // 🚀 CRUD 가로채기(Interceptor) 함수들 (가상 일정을 실제 인스턴스 문서로 변환)
  const handleToggleClick = (id: string, is_done: boolean) => {
    if (id.includes('.')) {
      // 1. 가상 일정의 토글 -> 실제 변경 인스턴스 문서를 DB에 신규 작성
      const [masterId, instDate] = id.split('.');
      const masterTask = tasks.find(t => t.id === masterId);
      if (masterTask) {
        const masterStartDate = new Date(masterTask.date);
        // 그날의 자동 수집된 날씨 캐시가 있으면 마스터의 정적 기본값 대신 사용 (매일 수동 업데이트 불필요)
        const cachedWeather = dailyWeather[instDate];
        onAdd(
          masterTask.task,
          parseInstanceDate(instDate, masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
          cachedWeather?.weather ?? masterTask.weather ?? "",
          cachedWeather?.temp_max ?? masterTask.temp_max,
          cachedWeather?.temp_min ?? masterTask.temp_min,
          masterTask.group_id,
          undefined, // 이미지 파일 없음
          undefined, // recurrence 없음
          true,      // is_instance = true
          instDate,  // instance_date = instDate
          false,     // is_cancelled = false
          is_done    // 🆕 완료 여부 즉시 저장
        );
      }
    } else {
      // 2. 일반 일정 토글
      onToggle(id, is_done);
    }
  };

  const handleDeleteClick = (id: string) => {
    if (id.includes('.')) {
      // 1. 가상 일정의 단일 삭제 -> is_cancelled = true 인 인스턴스를 하나 DB에 씀
      const [masterId, instDate] = id.split('.');
      const masterTask = tasks.find(t => t.id === masterId);
      if (masterTask) {
        const masterStartDate = new Date(masterTask.date);
        onAdd(
          masterTask.task,
          parseInstanceDate(instDate, masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
          masterTask.weather || "",
          masterTask.temp_max,
          masterTask.temp_min,
          masterTask.group_id,
          undefined,
          undefined,
          false,
          instDate,
          true // is_cancelled = true
        );
      }
    } else {
      // 2. 일반 일정 삭제
      onDelete(id);
    }
  };

  const handleUpdateClick = (id: string, updates: Partial<Job>, newImageFiles?: File[]) => {
    if (id.includes('.')) {
      // 1. 가상 일정의 정보 수정 -> 수정된 값을 기반으로 신규 인스턴스 작성
      const [masterId, instDate] = id.split('.');
      const masterTask = tasks.find(t => t.id === masterId);
      if (masterTask) {
        const masterStartDate = new Date(masterTask.date);
        onAdd(
          updates.task || masterTask.task,
          updates.date || parseInstanceDate(instDate, masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
          updates.weather !== undefined ? updates.weather : masterTask.weather,
          updates.temp_max !== undefined ? Number(updates.temp_max) : masterTask.temp_max,
          updates.temp_min !== undefined ? Number(updates.temp_min) : masterTask.temp_min,
          masterTask.group_id,
          newImageFiles,
          undefined,
          true, // is_instance = true
          instDate,
          false // is_cancelled = false
        );
      }
    } else {
      // 2. 일반 일정 수정
      onUpdate(id, updates, newImageFiles);
    }
  };

  const handleRecurrenceUpdateOption = (option: "single" | "all" | "following") => {
    if (!pendingUpdateId || !pendingUpdates) return;

    const [masterId, instDate] = pendingUpdateId.split('.');
    const masterTask = tasks.find(t => t.id === masterId);

    if (!masterTask) return;

    if (option === "single") {
      // 1. 이 일정만 수정
      handleUpdateClick(pendingUpdateId, pendingUpdates, pendingNewImageFiles);
    } else if (option === "all") {
      // 2. 전체 반복 일정(마스터) 수정
      const originalMasterDate = new Date(masterTask.date);

      if (pendingUpdates.date) {
        const editDateTime = new Date(pendingUpdates.date);
        originalMasterDate.setHours(editDateTime.getHours());
        originalMasterDate.setMinutes(editDateTime.getMinutes());
      }

      const masterUpdates = {
        ...pendingUpdates,
        date: originalMasterDate.toISOString()
      };

      onUpdate(masterId, masterUpdates, pendingNewImageFiles);
    } else if (option === "following") {
      // 3. 이 일정과 이후 일정 일괄 수정
      // 3-1. 기존 마스터의 종료일을 이 인스턴스 직전일(어제)로 단축하여 마스터 자르기
      const targetDate = parseInstanceDate(instDate, 0, 0);
      const yesterday = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);

      const prevRecurrence = {
        type: masterTask.recurrence!.type,
        interval: masterTask.recurrence!.interval || 1,
        end_date: yesterday.toISOString()
      };

      // 기존 마스터 일정의 반복 범위를 과거로 잘라서 업데이트
      onUpdate(masterId, { recurrence: prevRecurrence });

      // 3-2. 이 인스턴스 날짜부터 기존 종료일까지의 신규 마스터 일정을 추가 발행
      const newGroupId = `rec_${Date.now()}`;
      const newRecurrence = {
        type: masterTask.recurrence!.type,
        interval: masterTask.recurrence!.interval || 1,
        end_date: masterTask.recurrence!.end_date // 원래 기존 마스터의 종료일까지 유지
      };

      const masterStartDate = new Date(masterTask.date);
      onAdd(
        pendingUpdates.task || masterTask.task,
        pendingUpdates.date || parseInstanceDate(instDate, masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
        pendingUpdates.weather !== undefined ? pendingUpdates.weather : masterTask.weather,
        pendingUpdates.temp_max !== undefined ? Number(pendingUpdates.temp_max) : masterTask.temp_max,
        pendingUpdates.temp_min !== undefined ? Number(pendingUpdates.temp_min) : masterTask.temp_min,
        newGroupId,
        pendingNewImageFiles,
        newRecurrence
      );
    }

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

  // 🚀 월간 달력용 실시간 가상 일정 복원 렌더링 엔진 (오버라이드, 취소 필터링 완벽 적용)
  // 인스턴스/취소 인덱스는 tasks가 바뀔 때만 재계산 (달력 셀마다 매번 재구성하지 않도록 메모이제이션)
  const instancesByGroupDate = useMemo(() => {
    const map = new Map<string, Job>();
    tasks.forEach(t => {
      if (t.is_instance && t.instance_date) {
        map.set(`${t.group_id}_${t.instance_date}`, t);
      }
    });
    return map;
  }, [tasks]);

  const cancelledByGroupDate = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (t.is_cancelled && t.instance_date) {
        set.add(`${t.group_id}_${t.instance_date}`);
      }
    });
    return set;
  }, [tasks]);

  const getTasksForDate = (targetDate: Date) => {
    const list: Job[] = [];
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
        // 그날의 자동 수집된 날씨 캐시가 있으면 마스터의 정적 기본값 대신 사용 (매일 수동 업데이트 불필요)
        const cachedWeather = dailyWeather[targetDateStr];
        list.push({
          ...t,
          id: `${t.id}.${targetDateStr}`, // virtual id
          date: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
          instance_date: targetDateStr,
          weather: cachedWeather?.weather ?? t.weather,
          temp_max: cachedWeather?.temp_max ?? t.temp_max,
          temp_min: cachedWeather?.temp_min ?? t.temp_min
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

  // 달력에 보이는 날짜들의 일정을 한 번에 계산해 캐싱 (달력 셀마다 재계산되지 않도록)
  const tasksByDateMap = useMemo(() => {
    const map = new Map<string, Job[]>();
    calendarDays.forEach(day => {
      map.set(format(day, "yyyy-MM-dd"), getTasksForDate(day));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDays.length, currentDate, instancesByGroupDate, cancelledByGroupDate, tasks, dailyWeather]);

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
                          {((weatherTask.temp_max !== undefined && weatherTask.temp_max !== null && !isNaN(Number(weatherTask.temp_max))) || 
                            (weatherTask.temp_min !== undefined && weatherTask.temp_min !== null && !isNaN(Number(weatherTask.temp_min)))) && (
                            <span className="flex items-center font-mono scale-[0.9] pl-0.5 shrink-0 ml-0.5 border-l border-green-500/10">
                              {weatherTask.temp_max !== undefined && weatherTask.temp_max !== null && !isNaN(Number(weatherTask.temp_max)) && <span className="text-red-400 font-black">{weatherTask.temp_max}</span>}
                              {weatherTask.temp_max !== undefined && weatherTask.temp_max !== null && !isNaN(Number(weatherTask.temp_max)) && 
                               weatherTask.temp_min !== undefined && weatherTask.temp_min !== null && !isNaN(Number(weatherTask.temp_min)) && <span className="text-gray-400 opacity-40 mx-[0.5px]">/</span>}
                              {weatherTask.temp_min !== undefined && weatherTask.temp_min !== null && !isNaN(Number(weatherTask.temp_min)) && <span className="text-blue-400 font-black">{weatherTask.temp_min}</span>}
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
                {/* 모바일 체크박스 토글 연동 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canWrite) handleToggleClick(task.id!, !task.is_done);
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
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(task.id!); }}
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
                      const lat = settings?.latitude ?? 36.3504;
                      const lng = settings?.longitude ?? 127.3845;

                      let apiSuccess = false;
                      let autoTempMax = 30;
                      let autoTempMin = 12;
                      let autoWeather = "맑음";

                      try {
                        const apiUrl = `/api/weather?lat=${lat}&lng=${lng}`;

                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 4500); // 4.5초 타임아웃

                        const response = await fetch(apiUrl, { signal: controller.signal });
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
