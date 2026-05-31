"use client";

import { useState, useEffect } from "react";
import { format, isSameDay, addDays, subDays, addWeeks, subWeeks, addMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Job } from "@/types";
import { Plus, Check, Trash2, Clock, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Activity, Search, Edit2, X, Save, Sun, CloudRain, Cloud, CloudSnow, RefreshCw, CalendarDays, Camera, Image as ImageIcon, Lock as LockIcon, Sprout } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { compressImage } from "@/utils/imageUtils";
import { useApp } from "@/providers/AppProvider";

registerLocale("ko", ko);

// 🌍 기상청 LCC DFS 위경도 <-> X,Y 격자 좌표 변환 함수
function dfs_xy_conv(code: "toXY" | "toLL", v1: number, v2: number) {
  const RE = 6371.00877; // 지구 반경(km)
  const GRID = 5.0; // 격자 간격(km)
  const SLAT1 = 30.0; // 투영 위도1(degree)
  const SLAT2 = 60.0; // 투영 위도2(degree)
  const OLON = 126.0; // 기준점 경도(degree)
  const OLAT = 38.0; // 기준점 위도(degree)
  const XO = 43; // 기준점 X좌표(GRID)
  const YO = 136; // 기준점 Y좌표(GRID)

  const DEGRAD = Math.PI / 180.0;
  const RADDEG = 180.0 / Math.PI;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  const rs: any = {};

  if (code === "toXY") {
    rs["lat"] = v1;
    rs["lng"] = v2;
    let ra = Math.tan(Math.PI * 0.25 + v1 * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;
    rs["x"] = Math.floor(ra * Math.sin(theta) + XO + 0.5);
    rs["y"] = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  } else {
    rs["x"] = v1;
    rs["y"] = v2;
    let xn = v1 - XO;
    let yn = ro - v2 + YO;
    let r = Math.sqrt(xn * xn + yn * yn);
    if (sn < 0.0) r = -r;
    let alat = Math.pow((re * sf / r), (1.0 / sn));
    alat = 2.0 * Math.atan(alat) - Math.PI * 0.5;

    let theta = 0.0;
    if (Math.abs(xn) <= 0.0) {
      theta = 0.0;
    } else {
      if (Math.abs(yn) <= 0.0) {
        theta = Math.PI * 0.5;
        if (xn < 0.0) theta = -theta;
      } else theta = Math.atan2(xn, yn);
    }
    let alon = theta / sn + olon;
    rs["lat"] = alat * RADDEG;
    rs["lng"] = alon * RADDEG;
  }
  return rs;
}

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

  // src가 변경될 때만 로딩 상태 초기화
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

export default function DailyView({
  tasks,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  canWrite = false,
  canDelete = false,
}: {
  tasks: Job[];
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
    is_cancelled?: boolean
  ) => void;
  onToggle: (id: string, is_done: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Job>, newImageFiles?: File[]) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}) {
  const { settings } = useApp();
  const [newTitle, setNewTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(new Date());

  // 🔄 반복 일정 수정 옵션 모달 및 펜딩 작업 상태
  const [showRecurrenceUpdateModal, setShowRecurrenceUpdateModal] = useState(false);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<Job> | null>(null);
  const [pendingNewImageFiles, setPendingNewImageFiles] = useState<File[] | undefined>(undefined);

  // 이미지 업로드 관련 상태
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // 날씨 수동 입력 상태 (등록 후 초기화하지 않음 - Sticky)
  const [manualWeather, setManualWeather] = useState("맑음");
  const [tmx, setTmx] = useState<string>("20");
  const [tmn, setTmn] = useState<string>("10");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editWeather, setEditWeather] = useState("");
  const [editTmx, setEditTmx] = useState<string>("");
  const [editTmn, setEditTmn] = useState<string>("");
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editExistingUrls, setEditExistingUrls] = useState<string[]>([]);

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedImageInfo, setSelectedImageInfo] = useState<{ urls: string[], index: number } | null>(null);

  // 반복 일정 관련 상태
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM">("DAILY");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>(addMonths(new Date(), 1)); // 기본 1개월 후까지

  // 🚀 미니 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 🚀 스마트 농장 실시간 날씨 네이버 검색 파싱 연동 엔진
  const fetchFarmWeather = async () => {
    // 1. 농장 설정 정보 가져오기 (설정이 없으면 기본 주소 "문경시 산양면", 기본 이름 "꿀송이농장" 적용)
    const farmAddress = settings?.location || "문경시 산양면";
    const farmName = settings?.farm_name || "꿀송이농장";

    let apiSuccess = false;
    let autoTempMax = 30; // 디폴트 최고 기온
    let autoTempMin = 12; // 디폴트 최저 기온
    let autoWeather = "맑음";

    triggerToast(`📡 [네이버 날씨 연동] ${farmName}(${farmAddress})의 실시간 날씨 정보를 수신하는 중...`);

    try {
      // 2. Next.js 서버 사이드 네이버 검색 파서 API 라우트 호출 (CORS 회피)
      const apiUrl = `/api/weather?address=${encodeURIComponent(farmAddress)}`;

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4500); // 4.5초 타임아웃 마진

      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(id);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          autoTempMax = data.temp_max;
          autoTempMin = data.temp_min;
          autoWeather = data.weather;
          apiSuccess = true;
          triggerToast(`✅ 네이버 실시간 날씨 연동에 완벽히 성공했습니다! (${farmAddress})`);
        }
      }
    } catch (error) {
      console.warn("네이버 날씨 API 호출 실패:", error);
    }

    // 3. 네이버 장애/네트워크 차단 시 안내 메시지 노출 및 수동 입력 유도
    if (!apiSuccess) {
      triggerToast("⚠️ 네이버 날씨 검색 서버가 응답하지 않습니다. 날씨와 기온을 직접 입력해 주세요!");
      return;
    }

    // 4. 화면 최고/최저 기온 및 날씨 적용 (API 성공 시에만 적용)
    setTmx(String(autoTempMax));
    setTmn(String(autoTempMin));
    setManualWeather(autoWeather);
  };


  // 🚀 2단계: 가상 일정 렌더링 엔진 (마스터-인스턴스 결합 처리)
  const viewTasks = (() => {
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

    const targetDateStr = format(viewDate, "yyyy-MM-dd");

    // 2. 전체 DB 데이터를 순회하며 오늘 보여줄 일정 계산
    tasks.forEach(t => {
      // 2-1. 개별 변경된 인스턴스나 삭제 기록은 중복 노출되지 않도록 직접 삽입 보류
      // -> 단, 마스터 주기가 아닌 전혀 다른 날짜로 수정 이동했거나 독립적으로 생성된 인스턴스는 
      //    오늘 날짜와 일치할 때 리스트에 누락 없이 안전하게 포함시켜야 합니다.
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
      const viewDateOnly = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
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
        // 날짜를 미래/과거로 옮긴 것이라면, 원래 오늘 렌더링되던 마스터 가상 일정은 렌더링하지 않고 종료(오버라이드 삭제 효과).
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
          date: new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
          instance_date: targetDateStr
        });
      }
    });

    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  })();

  // 🔮 조회일이 오늘보다 미래인지 여부 판정 (미래 일정 기후 정보 노출 차단용)
  const isFutureDate = (() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const viewDateStr = format(viewDate, "yyyy-MM-dd");
    return viewDateStr > todayStr;
  })();

  // 🚀 CRUD 가로채기(Interceptor) 함수들
  const handleToggleClick = (id: string, is_done: boolean) => {
    if (id.includes('.')) {
      // 1. 가상 일정의 토글 -> 실제 변경 인스턴스 문서를 DB에 신규 작성
      const [masterId, instDate] = id.split('.');
      const masterTask = tasks.find(t => t.id === masterId);
      if (masterTask) {
        const masterStartDate = new Date(masterTask.date);
        onAdd(
          masterTask.task,
          new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
          masterTask.weather || "",
          masterTask.temp_max,
          masterTask.temp_min,
          masterTask.group_id,
          undefined, // 이미지 파일 없음
          undefined, // recurrence 없음
          true,      // is_instance = true
          instDate,  // instance_date = instDate
          false      // is_cancelled = false
        );
        // 낙관적 업데이트를 위해 is_done 변경
        setTimeout(() => {
          const newInst = tasks.find(t => t.is_instance && t.instance_date === instDate && t.group_id === masterTask.group_id);
          if (newInst && newInst.id) {
            onToggle(newInst.id, is_done);
          }
        }, 1000);
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
          new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
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
          updates.date || new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), masterStartDate.getHours(), masterStartDate.getMinutes()).toISOString(),
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

  const completedCount = viewTasks.filter((t) => t.is_done).length;
  const totalCount = viewTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const goToPrevious = () => setViewDate(prev => subDays(prev, 1));
  const goToNext = () => setViewDate(prev => addDays(prev, 1));
  const goToToday = () => setViewDate(new Date());

  // 해당 일자에 등록된 일정이 있다면 날씨/기온 정보를 자동으로 불러와 기본값으로 설정
  useEffect(() => {
    const existingTaskWithWeather = viewTasks.find(t => 
      t.weather || 
      (t.temp_max !== undefined && t.temp_max !== null) || 
      (t.temp_min !== undefined && t.temp_min !== null)
    );

    if (existingTaskWithWeather) {
      if (existingTaskWithWeather.weather) setManualWeather(existingTaskWithWeather.weather);
      if (existingTaskWithWeather.temp_max !== undefined && existingTaskWithWeather.temp_max !== null) {
        setTmx(String(existingTaskWithWeather.temp_max));
      }
      if (existingTaskWithWeather.temp_min !== undefined && existingTaskWithWeather.temp_min !== null) {
        setTmn(String(existingTaskWithWeather.temp_min));
      }
    }
  }, [viewDate, tasks.length]); // 날짜 변경 또는 전체 일정 개수 변경 시 실행

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 이미지 압축 및 처리
    const compressedFiles = await Promise.all(
      files.map(file => compressImage(file))
    );

    const newPreviews = compressedFiles.map(file => URL.createObjectURL(file));

    if (isEdit) {
      setEditImageFiles(prev => [...prev, ...compressedFiles]);
      setEditImagePreviews(prev => [...prev, ...newPreviews]);
    } else {
      setImageFiles(prev => [...prev, ...compressedFiles]);
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditImageFiles(prev => prev.filter((_, i) => i !== index));
      URL.revokeObjectURL(editImagePreviews[index]);
      setEditImagePreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setImageFiles(prev => prev.filter((_, i) => i !== index));
      URL.revokeObjectURL(imagePreviews[index]);
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const removeExistingImage = (url: string) => {
    setEditExistingUrls(prev => prev.filter(u => u !== url));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !startDate) return;

    const gid = isRecurring ? `rec_${Date.now()}` : undefined;
    const recurrenceRule = isRecurring ? {
      type: recurrenceType,
      interval: recurrenceInterval || 1,
      end_date: recurrenceEndDate.toISOString()
    } : undefined;

    onAdd(
      newTitle.trim(),
      startDate.toISOString(),
      isRecurring ? "" : manualWeather,
      isRecurring ? "" : tmx,
      isRecurring ? "" : tmn,
      gid,
      imageFiles,
      recurrenceRule
    );

    setNewTitle("");
    setImageFiles([]);
    setImagePreviews([]);
    setIsRecurring(false); // 등록 후 반복 설정은 초기화
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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDate(null);
    setEditWeather("");
    setEditTmx("");
    setEditTmn("");
    setEditImageFiles([]);
    setEditImagePreviews([]);
    setEditExistingUrls([]);
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
      triggerToast("🔄 모든 반복 일정이 일괄 변경되었습니다.");
    } else if (option === "following") {
      // 3. 이 일정과 이후 일정 일괄 수정 (구글 캘린더급 분절화 엔진)
      // 3-1. 기존 마스터의 종료일을 오늘 직전일(어제)로 단축하여 마스터 자르기
      const targetDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
      const yesterday = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
      
      const prevRecurrence = {
        type: masterTask.recurrence!.type,
        interval: masterTask.recurrence!.interval || 1,
        end_date: yesterday.toISOString()
      };

      // 기존 마스터 일정의 반복 범위를 과거로 잘라서 업데이트
      onUpdate(masterId, { recurrence: prevRecurrence });

      // 3-2. 오늘 날짜부터 기존 종료일까지의 신규 마스터 일정을 추가 발행
      const newGroupId = `rec_${Date.now()}`;
      const newRecurrence = {
        type: masterTask.recurrence!.type,
        interval: masterTask.recurrence!.interval || 1,
        end_date: masterTask.recurrence!.end_date // 원래 기존 마스터의 종료일까지 유지
      };

      onAdd(
        pendingUpdates.task || masterTask.task,
        pendingUpdates.date || new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), new Date(masterTask.date).getHours(), new Date(masterTask.date).getMinutes()).toISOString(),
        pendingUpdates.weather !== undefined ? pendingUpdates.weather : masterTask.weather,
        pendingUpdates.temp_max !== undefined ? Number(pendingUpdates.temp_max) : masterTask.temp_max,
        pendingUpdates.temp_min !== undefined ? Number(pendingUpdates.temp_min) : masterTask.temp_min,
        newGroupId,
        pendingNewImageFiles,
        newRecurrence
      );

      triggerToast("⏭️ 이 일정 및 향후 일정이 모두 일괄 변경되었습니다.");
    }

    // 펜딩 리셋 및 닫기
    setPendingUpdateId(null);
    setPendingUpdates(null);
    setPendingNewImageFiles(undefined);
    setShowRecurrenceUpdateModal(false);
    setEditingId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editDate) return;
    const updates = {
      task: editTitle.trim(),
      date: editDate.toISOString(),
      weather: editWeather,
      temp_max: editTmx ? parseFloat(editTmx) : undefined,
      temp_min: editTmn ? parseFloat(editTmn) : undefined,
      image_urls: editExistingUrls
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

  const weatherOptions = [
    { label: "맑음", icon: <Sun className="w-4 h-4" /> },
    { label: "흐림", icon: <Cloud className="w-4 h-4" /> },
    { label: "비", icon: <CloudRain className="w-4 h-4" /> },
    { label: "바람", icon: <Activity className="w-4 h-4" /> },
    { label: "눈", icon: <CloudSnow className="w-4 h-4" /> },
  ];

  // 🖼️ 이미지 프리로딩 및 캐싱 로직
  useEffect(() => {
    if (viewTasks.length === 0) return;

    viewTasks.forEach(task => {
      if (task.image_urls) {
        task.image_urls.forEach(url => {
          const img = new Image();
          img.src = url;
        });
      }
    });
  }, [viewTasks]);




  // 이미지 슬라이드 이동 로직
  const goToNextImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (!selectedImageInfo) return;
    const { urls, index } = selectedImageInfo;
    if (index < urls.length - 1) {
      setSelectedImageInfo({ urls, index: index + 1 });
    } else {
      // 마지막이면 처음으로 (순환)
      setSelectedImageInfo({ urls, index: 0 });
    }
  };

  const goToPrevImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (!selectedImageInfo) return;
    const { urls, index } = selectedImageInfo;
    if (index > 0) {
      setSelectedImageInfo({ urls, index: index - 1 });
    } else {
      // 처음이면 마지막으로 (순환)
      setSelectedImageInfo({ urls, index: urls.length - 1 });
    }
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
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) goToNextImage();
    if (isRightSwipe) goToPrevImage();
  };

  // 📱 메인 화면 날짜 변경 스와이프 감지 로직 (스마트폰 최적화)
  const [mainTouchStart, setMainTouchStart] = useState<number | null>(null);
  const [mainTouchEnd, setMainTouchEnd] = useState<number | null>(null);

  const onMainTouchStart = (e: React.TouchEvent) => {
    if (selectedImageInfo || editingId) return; // 이미지 모달이나 수정 모달 열림 시 제외
    setMainTouchEnd(null);
    setMainTouchStart(e.targetTouches[0].clientX);
  };

  const onMainTouchMove = (e: React.TouchEvent) => {
    if (selectedImageInfo || editingId) return;
    setMainTouchEnd(e.targetTouches[0].clientX);
  };

  const onMainTouchEnd = () => {
    if (selectedImageInfo || editingId) return;
    if (!mainTouchStart || !mainTouchEnd) return;
    const distance = mainTouchStart - mainTouchEnd;
    const swipeThreshold = 80; // 너무 민감하게 반응하지 않도록 80px 설정

    if (distance > swipeThreshold) {
      // 왼쪽으로 쓸기 -> 다음날로 이동
      goToNext();
    } else if (distance < -swipeThreshold) {
      // 오른쪽으로 쓸기 -> 이전날로 이동
      goToPrevious();
    }
  };

  // 💻 PC 마우스 드래그 날짜 변경 감지 로직 (PC 테스트 및 최적화)
  const [mainMouseDown, setMainMouseDown] = useState<number | null>(null);
  const [mainMouseEnd, setMainMouseEnd] = useState<number | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const onMainMouseDown = (e: React.MouseEvent) => {
    if (selectedImageInfo || editingId) return;
    const target = e.target as HTMLElement;
    // 입력창, 버튼, 날짜 선택기 등 주요 인터랙티브 요소는 드래그 대상에서 안전하게 제외
    if (target.closest('input') || target.closest('button') || target.closest('textarea') || target.closest('.react-datepicker') || target.closest('a')) return;
    
    setIsMouseDown(true);
    setMainMouseEnd(null);
    setMainMouseDown(e.clientX);
  };

  const onMainMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || selectedImageInfo || editingId) return;
    setMainMouseEnd(e.clientX);
  };

  const onMainMouseUp = () => {
    if (!isMouseDown) return;
    setIsMouseDown(false);
    
    if (selectedImageInfo || editingId) return;
    if (!mainMouseDown || !mainMouseEnd) return;
    
    const distance = mainMouseDown - mainMouseEnd;
    const swipeThreshold = 100; // 마우스 드래그는 살짝 더 묵직하게 100px 설정

    if (distance > swipeThreshold) {
      goToNext();
    } else if (distance < -swipeThreshold) {
      goToPrevious();
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

  return (
    <div 
      className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500"
      onTouchStart={onMainTouchStart}
      onTouchMove={onMainTouchMove}
      onTouchEnd={onMainTouchEnd}
      onMouseDown={onMainMouseDown}
      onMouseMove={onMainMouseMove}
      onMouseUp={onMainMouseUp}
      onMouseLeave={() => setIsMouseDown(false)} // 마우스가 화면 영역을 벗어나면 초기화
    >

      {/* 🚀 Left Area: Task List & Timeline (8 columns) */}
      <div className="lg:col-span-8 flex flex-col space-y-6">

        {/* Compact Header Section */}
        <div className="flex items-center justify-between bg-[var(--card-bg)] p-4 rounded-2xl shadow-sm border border-[var(--card-border)] animate-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-[var(--input-bg)] rounded-xl transition-all text-gray-400 hover:text-green-600 active:scale-90"
              title="이전날"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div
              onClick={goToToday}
              className="px-4 py-1 text-center cursor-pointer group"
              title="오늘 날짜로 이동"
            >
              <h2 className="text-xl font-black text-[var(--foreground)] tracking-tight group-hover:text-green-600 transition-colors">
                {format(viewDate, "M월 d일", { locale: ko })}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                {format(viewDate, "yyyy (eeee)", { locale: ko })}
              </p>
            </div>
            <button
              onClick={goToNext}
              className="p-2 hover:bg-[var(--input-bg)] rounded-xl transition-all text-gray-400 hover:text-green-600 active:scale-90"
              title="다음날"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Mini Progress Indicator */}
            <div className="hidden sm:flex items-center gap-3 bg-[var(--input-bg)] px-3 py-2 rounded-xl border border-[var(--card-border)]">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-gray-400 leading-none mb-1">진행율</span>
                <span className="text-xs font-black text-green-600 leading-none">{Math.round(progress)}%</span>
              </div>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <button
              onClick={goToToday}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${isSameDay(viewDate, new Date())
                ? "bg-[var(--input-bg)] text-gray-400 cursor-default opacity-50"
                : "bg-green-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                }`}
              disabled={isSameDay(viewDate, new Date())}
            >
              오늘
            </button>
          </div>
        </div>

        {/* Timeline List */}
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-[var(--card-border)] p-5 flex-1 min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-green-500 rounded-full" />
              <h3 className="text-md font-bold text-[var(--foreground)]">일정 목록</h3>
            </div>
            <div className="text-[11px] font-bold text-gray-400 bg-[var(--input-bg)] px-2 py-1 rounded-lg">
              TOTAL <span className="text-green-600 ml-1">{totalCount}</span>
            </div>
          </div>

          {/* 💡 스마트 영농 비서 실시간 날씨 조언 카드 */}
          {!isFutureDate && viewTasks.some(t => t.weather === "비") && (
            <div className="mb-4 bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <CloudRain className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <h5 className="text-xs font-bold text-blue-600">🌦️ 영농 비서의 스마트 날씨 조언</h5>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  오늘 비 소식이 예정되어 있는 일정이 있네요! 영양제 살포나 야외 밭갈이 작업은 비에 쓸려가거나 흙이 뭉쳐 효율이 낮아질 수 있으니, 날씨가 개인 뒤로 미루시는 것을 추천드립니다.☔
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4 pb-10">
            {viewTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <div className="w-16 h-16 bg-[var(--input-bg)] rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon className="w-8 h-8 text-gray-500/50" />
                </div>
                <p className="font-medium text-gray-500">{format(viewDate, "M월 d일")}에 계획된 일정이 없습니다.</p>
                <p className="text-sm mt-1">새로운 일정을 추가하여 하루를 계획해보세요.</p>
              </div>
            ) : (
              viewTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${task.is_done
                    ? "bg-[var(--input-bg)] opacity-60 border-[var(--card-border)]"
                    : "bg-[var(--card-bg)] border-[var(--card-border)] hover:border-green-300 hover:shadow-sm"
                    }`}
                >
                  {/* Task Content */}
                  <div className="flex-1 min-w-0 py-1">
                    <h4 className={`font-bold transition-all duration-300 truncate ${task.is_done ? "text-gray-400 line-through decoration-2" : "text-[var(--foreground)]"
                      }`}>
                      {task.task}
                    </h4>

                    {/* Image Gallery in List */}
                    {task.image_urls && task.image_urls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {task.image_urls.map((url, idx) => (
                          <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[var(--card-border)] group/img">
                            <ImageWithSkeleton
                              src={url}
                              alt={`첨부이미지 ${idx + 1}`}
                              className="w-full h-full cursor-pointer hover:scale-110 transition-transform"
                              onClick={() => setSelectedImageInfo({ urls: task.image_urls!, index: idx })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-[10px] font-mono text-gray-400 bg-[var(--input-bg)] px-1.5 py-0.5 rounded shrink-0">
                        <Clock className="w-3 h-3" />
                        {format(new Date(task.date), "HH:mm")}
                      </span>

                      {/* Weather Info Display */}
                      {!isFutureDate && (task.weather || (task.temp_max !== undefined && task.temp_max !== null) || (task.temp_min !== undefined && task.temp_min !== null)) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium bg-green-500/10 px-1.5 py-0.5 rounded whitespace-nowrap overflow-hidden">
                          {task.weather && (
                            <span className="flex items-center gap-1">
                              {task.weather.includes("맑음") ? <Sun className="w-3 h-3" /> :
                                task.weather.includes("비") ? <CloudRain className="w-3 h-3" /> :
                                  task.weather.includes("흐림") ? <Cloud className="w-3 h-3" /> :
                                    task.weather.includes("바람") ? <Activity className="w-3 h-3" /> :
                                      task.weather.includes("눈") ? <CloudSnow className="w-3 h-3" /> :
                                        <Cloud className="w-3 h-3" />}
                              {task.weather}
                            </span>
                          )}
                          {(task.temp_max !== undefined || task.temp_min !== undefined) && (
                            <span className="flex items-center gap-1 border-l border-green-500/20 pl-1.5">
                              <span className="text-red-400 hover:scale-110 transition-transform cursor-help">{task.temp_max}℃</span>
                              <span className="text-gray-400 opacity-50">/</span>
                              <span className="text-blue-400 hover:scale-110 transition-transform cursor-help">{task.temp_min}℃</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Indicator & Actions */}
                  <div className="flex items-center gap-2 px-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canWrite) handleToggleClick(task.id!, !task.is_done);
                      }}
                      disabled={!canWrite}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${task.is_done
                        ? "bg-green-500/10 border-transparent shadow-inner"
                        : "bg-[var(--card-bg)] border-2 border-[var(--card-border)] hover:border-green-400 shadow-sm"
                        } ${!canWrite ? 'cursor-default opacity-50' : 'active-scale'}`}
                      title={task.is_done ? "미완료로 표시" : "완료로 표시"}
                    >
                      {task.is_done ? (
                        <Check className="w-5 h-5 text-green-500 animate-in zoom-in-50 duration-200" />
                      ) : null}
                    </button>

                    <div className="flex flex-col sm:flex-row items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {canWrite && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                          className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(task.id!); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )))}
          </div>

          {/* Bottom Navigation Control */}
          <div className="mt-auto pt-8 border-t border-[var(--card-border)] flex items-center justify-between">
            <button
              onClick={goToPrevious}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 hover:text-green-600 hover:bg-green-500/10 rounded-xl transition-all group"
            >
              <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              이전날
            </button>
            <button
              onClick={goToToday}
              className={`px-6 py-2 text-sm font-black rounded-xl transition-all ${isSameDay(viewDate, new Date())
                ? "bg-[var(--input-bg)] text-gray-400 cursor-default"
                : "bg-green-600 text-white shadow-md shadow-green-500/20 hover:shadow-lg hover:-translate-y-0.5"
                }`}
              disabled={isSameDay(viewDate, new Date())}
            >
              오늘
            </button>
            <button
              onClick={goToNext}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 hover:text-green-600 hover:bg-green-500/10 rounded-xl transition-all group"
            >
              다음날
              <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>

      {/* 📋 Right Area: Input Form & Widgets (4 columns) */}
      <div className="lg:col-span-4 space-y-6">

        {/* Add New Task Widget */}
        {canWrite ? (
          <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-6 relative overflow-hidden">
            {/* 💬 모바일 최적화 실시간 안내 토스트 */}
            {toastMessage && (
              <div className="absolute top-0 left-0 right-0 z-10 bg-green-600 text-[var(--background)] py-3 px-4 text-xs font-black text-center animate-in slide-in-from-top duration-300 flex items-center justify-center gap-2">
                <Sprout className="w-4 h-4 animate-bounce" /> {toastMessage}
              </div>
            )}

            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6 font-sans">
              일정 추가
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
                    className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all font-bold"
                  />
                </div>
                {/* 🌾 농장 전용 퀵 템플릿 원클릭 카드 단추 */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: "💧 물주기", value: "과수원 물주기" },
                    { label: "🧪 영양제", value: "영양제 및 비료 살포" },
                    { label: "🚜 로터리", value: "밭 로터리 작업" },
                    { label: "📦 수확", value: "농작물 수확 및 포장" },
                    { label: "🧹 정리", value: "비닐하우스 정리정돈" }
                  ].map((temp) => (
                    <button
                      key={temp.value}
                      type="button"
                      onClick={() => {
                        setNewTitle(temp.value);
                        triggerToast(`"${temp.label.split(" ")[1]}" 일정을 퀵 등록칸에 입력했습니다!`);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-green-500/10 border border-green-500/10 text-green-700 hover:bg-green-500/20 active:scale-95 transition-all"
                    >
                      {temp.label}
                    </button>
                  ))}
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
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all cursor-pointer font-bold"
                  wrapperClassName="w-full"
                />
              </div>

              {/* 🔄 Recurrence Settings */}
              <div className="pt-4 border-t border-[var(--card-border)] space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-10 h-6 rounded-full transition-all relative ${isRecurring ? 'bg-green-600' : 'bg-[var(--input-bg)]'}`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                      />
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isRecurring ? 'left-5' : 'left-1'}`} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 uppercase">반복 일정 사용</span>
                  </label>
                  {isRecurring && <RefreshCw className="w-4 h-4 text-green-500 animate-spin-slow" />}
                </div>

                {isRecurring && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
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
                          onClick={() => setRecurrenceType(opt.value as any)}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${recurrenceType === opt.value
                            ? "bg-[var(--foreground)] border-transparent text-[var(--background)] shadow-sm"
                            : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:bg-[var(--card-bg)] hover:border-green-500/30"
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {recurrenceType === 'CUSTOM' && (
                      <div className="flex items-center gap-2 bg-green-500/10 p-3 rounded-xl border border-green-500/20">
                        <span className="text-xs font-bold text-green-600">간격:</span>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                          className="w-16 bg-[var(--card-bg)] border border-green-500/30 rounded-lg px-2 py-1 text-sm font-bold text-green-600 outline-none focus:ring-2 focus:ring-green-500/20"
                        />
                        <span className="text-xs font-bold text-green-600">일 마다 반복</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> 반복 종료일
                      </label>
                      <DatePicker
                        selected={recurrenceEndDate}
                        onChange={(date: Date | null) => date && setRecurrenceEndDate(date)}
                        dateFormat="yyyy.MM.dd"
                        minDate={startDate || new Date()}
                        locale="ko"
                        className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--foreground)] outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Weather & Temp Manual Input */}
              <div className="pt-2 space-y-4 border-t border-[var(--card-border)]">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase">날씨 선택</label>
                    <button
                      type="button"
                      onClick={fetchFarmWeather}
                      className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-xl hover:bg-blue-500/20 transition-all active:scale-95"
                    >
                      <RefreshCw className="w-3 h-3" /> 🌦️ 농장 기상 연동
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {weatherOptions.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setManualWeather(opt.label)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95 ${manualWeather === opt.label
                          ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-500/20"
                          : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:border-green-500/30 hover:bg-[var(--card-bg)]"
                          }`}
                      >
                        {opt.icon}
                        <span className="text-[10px] mt-1 font-bold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase">최고 기온</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="-30"
                        max="50"
                        value={tmx}
                        onChange={(e) => setTmx(e.target.value)}
                        className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-red-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 font-extrabold text-center"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">℃</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase">최저 기온</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="-30"
                        max="50"
                        value={tmn}
                        onChange={(e) => setTmn(e.target.value)}
                        className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-blue-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 font-extrabold text-center"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">℃</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 📸 Image Upload Section */}
              <div className="space-y-2 pt-2 border-t border-[var(--card-border)]">
                <label className="text-xs font-semibold text-gray-500 uppercase flex items-center justify-between">
                  <span>사진 첨부 (무제한)</span>
                  <span className="text-[10px] text-green-600 normal-case">{imageFiles.length}장 선택됨</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {imagePreviews.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-green-500/20 group">
                      <img src={url} alt="미리보기" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <label className="w-20 h-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--card-border)] hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer group">
                    <Camera className="w-6 h-6 text-gray-400 group-hover:text-green-500 transition-colors" />
                    <span className="text-[10px] text-gray-400 group-hover:text-green-500 mt-1 font-bold">추가</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageChange(e)}
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={!newTitle.trim() || !startDate}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-3.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-md shadow-green-600/20 active-scale"
              >
                일정 등록하기
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-8 text-center">
            <LockIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-400">일정 등록 권한이 없습니다.</p>
          </div>
        )}

        {/* Summary Widget */}
        <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4 text-green-500">
            <Activity className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-[var(--foreground)] mb-1">훌륭합니다!</h4>
          <p className="text-sm font-medium text-gray-500 mb-6">
            오늘 총 <strong className="text-[var(--foreground)]">{totalCount}</strong>개의 일정 중<br />
            <strong className="text-[var(--foreground)]">{completedCount}</strong>개를 완료하셨습니다.
          </p>

          <div className="w-full h-2 bg-[var(--input-bg)] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
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
                {/* Left Arrow Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 z-[110] group active:scale-90 transition-all"
                  title="이전 이미지"
                >
                  <div className="p-3 sm:p-5 bg-black/40 hover:bg-black/60 text-white rounded-full border border-white/20 backdrop-blur-md transition-all shadow-xl">
                    <ChevronLeft className="w-6 h-6 sm:w-10 sm:h-10 group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>
                {/* Right Arrow Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 z-[110] group active:scale-90 transition-all"
                  title="다음 이미지"
                >
                  <div className="p-3 sm:p-5 bg-black/40 hover:bg-black/60 text-white rounded-full border border-white/20 backdrop-blur-md transition-all shadow-xl">
                    <ChevronRight className="w-6 h-6 sm:w-10 sm:h-10 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </>
            )}

            {/* Image Wrapper for Slide Animation (Simplified) */}
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

              {/* Date & Time (대망의 날짜/시간 변경 완전 분리!) */}
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
                <label className="text-xs font-bold text-gray-400 uppercase">날씨 선택</label>
                <div className="grid grid-cols-5 gap-1">
                  {weatherOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setEditWeather(opt.label)}
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
                        onClick={() => removeImage(idx, true)}
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
                      onChange={(e) => handleImageChange(e, true)}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Actions - 하단에 항상 딱 붙어있도록 보장 */}
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 px-4"
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
                이 반복 일정의 변경사항을 어떻게 반영할까요?<br />
                대장님의 소중한 영농 계획을 선택해 주세요!
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
