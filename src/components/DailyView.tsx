"use client";

import { useState, useEffect } from "react";
import { format, isSameDay, addDays, subDays, addWeeks, subWeeks, addMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Job } from "@/types";
import { Plus, Check, Trash2, Clock, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Activity, Search, Edit2, X, Save, Sun, CloudRain, Cloud, CloudSnow, RefreshCw, CalendarDays, Camera, Image as ImageIcon, Lock as LockIcon } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { compressImage } from "@/utils/imageUtils";

registerLocale("ko", ko);

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
  onAdd: (task: string, date: string, weather?: string, temp_max?: string | number, temp_min?: string | number, group_id?: string, imageFiles?: File[]) => void;
  onToggle: (id: string, is_done: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Job>, newImageFiles?: File[]) => void;
  canWrite?: boolean;
  canDelete?: boolean;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(new Date());

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


  const viewTasks = tasks.filter((t) => isSameDay(new Date(t.date), viewDate))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

    if (!isRecurring) {
      onAdd(newTitle.trim(), startDate.toISOString(), manualWeather, tmx, tmn, undefined, imageFiles);
    } else {
      const gid = `rec_${Date.now()}`;
      let currentDate = new Date(startDate);
      const endDate = recurrenceEndDate;

      while (currentDate <= endDate) {
        onAdd(newTitle.trim(), currentDate.toISOString(), manualWeather, tmx, tmn, gid, imageFiles);

        // 주기 계산
        if (recurrenceType === "DAILY") currentDate = addDays(currentDate, 1);
        else if (recurrenceType === "WEEKLY") currentDate = addDays(currentDate, 7);
        else if (recurrenceType === "BIWEEKLY") currentDate = addDays(currentDate, 14);
        else if (recurrenceType === "MONTHLY") currentDate = addMonths(currentDate, 1);
        else if (recurrenceType === "CUSTOM") currentDate = addDays(currentDate, recurrenceInterval || 1);

        // 무한 루프 방지 (최대 2년)
        if (currentDate > addMonths(startDate, 24)) break;
      }
    }

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

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editDate) return;
    onUpdate(id, {
      task: editTitle.trim(),
      date: editDate.toISOString(),
      weather: editWeather,
      temp_max: editTmx ? parseFloat(editTmx) : undefined,
      temp_min: editTmn ? parseFloat(editTmn) : undefined,
      image_urls: editExistingUrls
    }, editImageFiles);
    setEditingId(null);
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

  // 🎨 스켈레톤 UI 포함 이미지 컴포넌트
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">

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
                  {editingId === task.id ? (
                    <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-[var(--input-bg)] border border-green-500/30 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                          autoFocus
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Clock className="w-4 h-4 text-green-500" />
                          <DatePicker
                            selected={editDate}
                            onChange={(date: Date | null) => setEditDate(date)}
                            showTimeSelect
                            showTimeSelectOnly
                            timeIntervals={15}
                            timeCaption="시간"
                            dateFormat="HH:mm"
                            locale="ko"
                            className="bg-[var(--input-bg)] border border-green-500/30 rounded-lg px-3 py-1 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none w-24 cursor-pointer"
                          />
                          <div className="flex items-center gap-2 border-l border-[var(--card-border)] pl-2 ml-1">
                            <select
                              value={editWeather}
                              onChange={(e) => setEditWeather(e.target.value)}
                              className="bg-[var(--input-bg)] border border-green-500/30 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-[var(--foreground)] appearance-none min-w-[70px]"
                            >
                              <option value="">날씨 선택</option>
                              {weatherOptions.map(opt => (
                                <option key={opt.label} value={opt.label}>{opt.label}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="-30"
                                max="50"
                                placeholder="최고"
                                value={editTmx}
                                onChange={(e) => setEditTmx(e.target.value)}
                                className="w-14 bg-[var(--input-bg)] border border-green-500/30 rounded-lg px-2 py-1 text-sm text-red-500 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center"
                              />
                              <span className="text-gray-400">/</span>
                              <input
                                type="number"
                                min="-30"
                                max="50"
                                placeholder="최저"
                                value={editTmn}
                                onChange={(e) => setEditTmn(e.target.value)}
                                className="w-14 bg-[var(--input-bg)] border border-green-500/30 rounded-lg px-2 py-1 text-sm text-blue-500 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Edit Mode Image Upload */}
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {/* 기존 이미지 목록 */}
                            {editExistingUrls.map((url, idx) => (
                              <div key={`existing-${idx}`} className="relative w-12 h-12 rounded-lg overflow-hidden border border-[var(--card-border)] group">
                                <img
                                  src={url}
                                  alt="기존 이미지"
                                  className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setSelectedImageInfo({ urls: [...editExistingUrls, ...editImagePreviews], index: idx })}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExistingImage(url)}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                  <X className="w-2 h-2" />
                                </button>
                              </div>
                            ))}

                            {/* 신규 추가 이미지 미리보기 */}
                            {editImagePreviews.map((url, idx) => (
                              <div key={`new-${idx}`} className="relative w-12 h-12 rounded-lg overflow-hidden border border-green-500/20 group">
                                <img
                                  src={url}
                                  alt="신규 미리보기"
                                  className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setSelectedImageInfo({ urls: [...editExistingUrls, ...editImagePreviews], index: editExistingUrls.length + idx })}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx, true)}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                  <X className="w-2 h-2" />
                                </button>
                              </div>
                            ))}
                            <label className="w-12 h-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--card-border)] hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer">
                              <Camera className="w-4 h-4 text-gray-400" />
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
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleSaveEdit(task.id!)}
                          className="action-btn p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                          title="저장"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="action-btn p-2 rounded-lg bg-[var(--input-bg)] text-gray-500 hover:bg-gray-200/50 transition-colors"
                          title="취소"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                          {(task.weather || (task.temp_max !== undefined && task.temp_max !== null) || (task.temp_min !== undefined && task.temp_min !== null)) && (
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
                            if (canWrite) onToggle(task.id!, !task.is_done);
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
                              onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
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
          <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-6">
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
                    className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all"
                  />
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
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all cursor-pointer"
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
                  <label className="text-xs font-semibold text-gray-500 uppercase">날씨 선택</label>
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
                        className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-red-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400">℃</span>
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
                        className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-blue-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400">℃</span>
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
                {/* Left Area (Zone 4) */}
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
                  className="absolute left-0 top-1/4 bottom-1/4 w-1/3 z-[110] flex items-center justify-start pl-4 group active:bg-white/5 transition-colors"
                >
                  <div className="p-3 sm:p-4 bg-black/20 hover:bg-black/40 text-white rounded-full sm:rounded-2xl border border-white/10 backdrop-blur-sm transition-all group-active:scale-90">
                    <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>
                {/* Right Area (Zone 6) */}
                <button
                  onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
                  className="absolute right-0 top-1/4 bottom-1/4 w-1/3 z-[110] flex items-center justify-end pr-4 group active:bg-white/5 transition-colors"
                >
                  <div className="p-3 sm:p-4 bg-black/20 hover:bg-black/40 text-white rounded-full sm:rounded-2xl border border-white/10 backdrop-blur-sm transition-all group-active:scale-90">
                    <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </>
            )}

            {/* Image Wrapper for Slide Animation (Simplified) */}
            <div className="relative max-w-4xl w-full h-full flex items-center justify-center overflow-hidden">
                <ImageWithSkeleton
                  key={selectedImageInfo.urls[selectedImageInfo.index]}
                  src={selectedImageInfo.urls[selectedImageInfo.index]}
                  alt="확대 이미지"
                  className="max-w-full max-h-full rounded-lg shadow-2xl animate-in zoom-in-95 fade-in duration-300 min-w-[200px] min-h-[200px]"
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
