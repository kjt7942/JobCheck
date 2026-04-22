"use client";

import { useState } from "react";
import { format, isSameDay, addDays, subDays, addWeeks, subWeeks, addMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Job } from "@/types";
import { Plus, Check, Trash2, Clock, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Activity, Search, Edit2, X, Save, Sun, CloudRain, Cloud, CloudSnow, RefreshCw, CalendarDays } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("ko", ko);

export default function DailyView({
  tasks,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
}: {
  tasks: Job[];
  onAdd: (task: string, date: string, weather?: string, temp_max?: string | number, temp_min?: string | number, group_id?: string) => void;
  onToggle: (id: string, is_done: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Job>) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(new Date());

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

  const [viewDate, setViewDate] = useState(new Date());

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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !startDate) return;

    if (!isRecurring) {
      onAdd(newTitle.trim(), startDate.toISOString(), manualWeather, tmx, tmn);
    } else {
      const gid = `rec_${Date.now()}`;
      let currentDate = new Date(startDate);
      const endDate = recurrenceEndDate;

      while (currentDate <= endDate) {
        onAdd(newTitle.trim(), currentDate.toISOString(), manualWeather, tmx, tmn, gid);

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
    setIsRecurring(false); // 등록 후 반복 설정은 초기화
  };

  const startEdit = (job: Job) => {
    setEditingId(job.id!);
    setEditTitle(job.task);
    setEditDate(new Date(job.date));
    setEditWeather(job.weather || "맑음");
    setEditTmx(job.temp_max ? String(job.temp_max) : "");
    setEditTmn(job.temp_min ? String(job.temp_min) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDate(null);
    setEditWeather("");
    setEditTmx("");
    setEditTmn("");
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editDate) return;
    onUpdate(id, {
      task: editTitle.trim(),
      date: editDate.toISOString(),
      weather: editWeather,
      temp_max: editTmx ? parseFloat(editTmx) : undefined,
      temp_min: editTmn ? parseFloat(editTmn) : undefined,
    });
    setEditingId(null);
  };

  const weatherOptions = [
    { label: "맑음", icon: <Sun className="w-4 h-4" /> },
    { label: "흐림", icon: <Cloud className="w-4 h-4" /> },
    { label: "비", icon: <CloudRain className="w-4 h-4" /> },
    { label: "바람", icon: <Activity className="w-4 h-4" /> },
    { label: "눈", icon: <CloudSnow className="w-4 h-4" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">

      {/* 🚀 Left Area: Task List & Timeline (8 columns) */}
      <div className="lg:col-span-8 flex flex-col space-y-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between items-start gap-4 bg-[var(--card-bg)] p-6 rounded-[24px] shadow-sm border border-[var(--card-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevious}
                className="p-2 hover:bg-[var(--input-bg)] rounded-full transition-colors text-gray-400 hover:text-green-600"
                title="이전날"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="mx-1">
                <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">Daily Schedule</h2>
                <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-widest">
                  {format(viewDate, "yyyy. MM. dd eeee", { locale: ko })}
                </p>
              </div>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-[var(--input-bg)] rounded-full transition-colors text-gray-400 hover:text-green-600"
                title="다음날"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            {!isSameDay(viewDate, new Date()) && (
              <button
                onClick={goToToday}
                className="px-3 py-1 text-[10px] font-black bg-green-500/10 text-green-600 rounded-md hover:bg-green-500/20 transition-all border border-green-500/20"
              >
                오늘
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-[var(--input-bg)] rounded-full flex items-center px-4 py-2 border border-[var(--card-border)]">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span className="text-sm font-semibold text-[var(--foreground)] opacity-80">진행도: {Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Timeline List */}
        <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-6 flex-1 min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-[var(--foreground)]">일정 목록</h3>
            <div className="text-sm font-medium text-gray-400">
              총 <span className="text-[var(--foreground)] font-bold">{totalCount}</span>개의 스케줄
            </div>
          </div>

          <div className="space-y-4">
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
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onToggle(task.id!, !task.is_done)}>
                        <h4 className={`font-bold transition-all duration-300 truncate ${task.is_done ? "text-gray-400 line-through decoration-2" : "text-[var(--foreground)]"
                          }`}>
                          {task.task}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[10px] font-mono text-gray-400 bg-[var(--input-bg)] px-1.5 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            {format(new Date(task.date), "HH:mm")}
                          </span>

                          {/* Weather Info Display */}
                          {(task.weather || (task.temp_max !== undefined && task.temp_max !== null) || (task.temp_min !== undefined && task.temp_min !== null)) && (
                            <div className="flex items-center gap-2 text-[10px] text-green-600 font-medium bg-green-500/10 px-1.5 py-0.5 rounded">
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
                                <span className="flex items-center gap-1 border-l border-green-500/20 pl-2">
                                  <span className="text-red-400">{task.temp_max}℃</span>
                                  <span className="text-gray-400">/</span>
                                  <span className="text-blue-400">{task.temp_min}℃</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Indicator & Actions */}
                      <div className="flex items-center gap-2">
                        {task.is_done ? (
                          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-500" />
                          </div>
                        ) : (
                          <button
                            className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] group-hover:border-green-400 transition-colors flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); onToggle(task.id!, true); }}
                          />
                        )}

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                            className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )))}
          </div>

          {/* Bottom Navigation Control */}
          <div className="mt-auto pt-6 border-t border-[var(--card-border)] flex items-center justify-between">
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
        <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6 font-sans">
            Add New Task
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

            <button
              type="submit"
              disabled={!newTitle.trim() || !startDate}
              className="w-full bg-[var(--foreground)] hover:opacity-90 text-[var(--background)] text-sm font-bold py-3.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-sm"
            >
              일정 등록하기
            </button>
          </form>
        </div>

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
    </div>
  );
}
