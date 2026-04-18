"use client";

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { Task } from "@/api/client";
import { Plus, Check, Trash2, Clock, Calendar as CalendarIcon, CheckCircle2, ChevronRight, Activity, Search, Edit2, X, Save, Sun, CloudRain, Cloud } from "lucide-react";
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
  tasks: Task[];
  onAdd: (title: string, date: string, weather?: string, tmx?: string | number, tmn?: string | number) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title?: string, date?: string, weather?: string, tmx?: string | number, tmn?: string | number) => void;
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

  const now = new Date();
  const todaysTasks = tasks.filter((t) => isSameDay(new Date(t.date), now))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const completedCount = todaysTasks.filter((t) => t.completed).length;
  const totalCount = todaysTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !startDate) return;
    onAdd(newTitle.trim(), startDate.toISOString(), manualWeather, tmx, tmn);
    setNewTitle("");
    // manualWeather, tmx, tmn은 유지 (Sticky)
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDate(new Date(task.date));
    setEditWeather(task.weather || "맑음");
    setEditTmx(task.tmx ? String(task.tmx) : "");
    setEditTmn(task.tmn ? String(task.tmn) : "");
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
    onUpdate(id, editTitle.trim(), editDate.toISOString(), editWeather, editTmx, editTmn);
    setEditingId(null);
  };

  const weatherOptions = [
    { label: "맑음", icon: <Sun className="w-4 h-4" /> },
    { label: "흐림", icon: <Cloud className="w-4 h-4" /> },
    { label: "비", icon: <CloudRain className="w-4 h-4" /> },
    { label: "바람", icon: <Activity className="w-4 h-4" /> },
    { label: "눈", icon: <Cloud className="w-4 h-4" /> }, // Snowflake might be better but let's stick to available
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      
      {/* 🚀 Left Area: Task List & Timeline (8 columns) */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between items-start gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Today's Schedule</h2>
            <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-widest">
              {format(now, "yyyy. MM. dd eeee", { locale: ko })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-50 rounded-full flex items-center px-4 py-2 border border-gray-100">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span className="text-sm font-semibold text-gray-600">진행도: {Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Timeline List */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 flex-1 min-h-[500px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-gray-800">일정 목록</h3>
            <div className="text-sm font-medium text-gray-400">
              총 <span className="text-gray-800 font-bold">{totalCount}</span>개의 스케줄
            </div>
          </div>

          <div className="space-y-4">
            {todaysTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">오늘 계획된 일정이 없습니다.</p>
                <p className="text-sm mt-1">우측 패널에서 새로운 일정을 추가해보세요.</p>
              </div>
            ) : (
              todaysTasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((task) => (
                <div
                  key={task.id}
                  className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                    task.completed 
                      ? "bg-gray-50/50 border-gray-100 opacity-60" 
                      : "bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  {editingId === task.id ? (
                    <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full animate-in fade-in zoom-in-95 duration-200">
                       <div className="flex-1 space-y-3">
                          <input 
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none"
                            autoFocus
                          />
                          <div className="flex flex-wrap items-center gap-2">
                             <Clock className="w-4 h-4 text-orange-400" />
                             <DatePicker
                                selected={editDate}
                                onChange={(date: Date | null) => setEditDate(date)}
                                showTimeSelect
                                showTimeSelectOnly
                                timeIntervals={15}
                                timeCaption="시간"
                                dateFormat="HH:mm"
                                locale="ko"
                                className="bg-white border border-orange-200 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none w-24 cursor-pointer"
                             />
                             <div className="flex items-center gap-2 border-l border-orange-100 pl-2 ml-1">
                               <select
                                 value={editWeather}
                                 onChange={(e) => setEditWeather(e.target.value)}
                                 className="bg-white border border-orange-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none text-gray-600 appearance-none min-w-[70px]"
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
                                     onChange={(e) => {
                                       const val = e.target.value;
                                       if (val === "") { setEditTmx(""); return; }
                                       const num = Number(val);
                                       if (num < -30) setEditTmx("-30");
                                       else if (num > 50) setEditTmx("50");
                                       else setEditTmx(val);
                                     }}
                                     className="w-14 bg-white border border-orange-200 rounded-lg px-2 py-1 text-sm text-red-500 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 text-center"
                                   />
                                   <span className="text-gray-300">/</span>
                                   <input
                                     type="number"
                                     min="-30"
                                     max="50"
                                     placeholder="최저"
                                     value={editTmn}
                                     onChange={(e) => {
                                       const val = e.target.value;
                                       if (val === "") { setEditTmn(""); return; }
                                       const num = Number(val);
                                       if (num < -30) setEditTmn("-30");
                                       else if (num > 50) setEditTmn("50");
                                       else setEditTmn(val);
                                     }}
                                     className="w-14 bg-white border border-orange-200 rounded-lg px-2 py-1 text-sm text-blue-500 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 text-center"
                                   />
                                 </div>
                              </div>
                           </div>
                        </div>
                       <div className="flex items-center gap-2 self-end sm:self-center">
                          <button 
                            onClick={() => handleSaveEdit(task.id)}
                            className="action-btn p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm"
                            title="저장"
                          >
                             <Save className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={cancelEdit}
                            className="action-btn p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                            title="취소"
                          >
                             <X className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                  ) : (
                    <>
                      {/* Task Content */}
                      <div className="flex-1 min-w-0" onClick={() => onToggle(task.id, !task.completed)}>
                        <h4 className={`font-bold transition-all duration-300 truncate ${
                          task.completed ? "text-gray-300 line-through decoration-2" : "text-gray-700"
                        }`}>
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            {format(new Date(task.date), "HH:mm")}
                          </span>
                          
                          {/* Weather Info Display */}
                          {(task.weather || (task.tmx !== undefined && task.tmx !== null) || (task.tmn !== undefined && task.tmn !== null)) && (
                            <div className="flex items-center gap-2 text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">
                              {task.weather && (
                                <span className="flex items-center gap-1">
                                  {task.weather.includes("맑음") ? <Sun className="w-3 h-3" /> : 
                                   task.weather.includes("비") ? <CloudRain className="w-3 h-3" /> : 
                                   task.weather.includes("흐림") ? <Cloud className="w-3 h-3" /> :
                                   task.weather.includes("바람") ? <Activity className="w-3 h-3" /> : 
                                   <Cloud className="w-3 h-3" />}
                                  {task.weather}
                                </span>
                              )}
                              {(task.tmx !== undefined || task.tmn !== undefined) && (
                                <span className="flex items-center gap-1 border-l border-green-200 pl-2">
                                  <span className="text-red-400">{task.tmx}℃</span>
                                  <span className="text-gray-300">/</span>
                                  <span className="text-blue-400">{task.tmn}℃</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Indicator & Actions */}
                      <div className="flex items-center gap-2">
                        {task.completed ? (
                          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-500" />
                          </div>
                        ) : (
                          <button 
                            className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-orange-400 transition-colors flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); onToggle(task.id, true); }}
                          />
                        )}

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                            className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 📋 Right Area: Input Form & Widgets (4 columns) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Add New Task Widget */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6">
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
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition-all"
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
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition-all focus:bg-white cursor-pointer"
                wrapperClassName="w-full"
              />
            </div>

            {/* Weather & Temp Manual Input */}
            <div className="pt-2 space-y-4 border-t border-gray-50">
               <div className="space-y-2">
                 <label className="text-xs font-semibold text-gray-500 uppercase">날씨 선택</label>
                 <div className="grid grid-cols-5 gap-1">
                   {weatherOptions.map((opt) => (
                     <button
                       key={opt.label}
                       type="button"
                       onClick={() => setManualWeather(opt.label)}
                       className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                         manualWeather === opt.label 
                           ? "bg-green-500 border-green-500 text-white shadow-sm shadow-green-200" 
                           : "bg-gray-50 border-gray-100 text-gray-400 hover:border-green-200"
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
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") { setTmx(""); return; }
                          const num = Number(val);
                          if (num < -30) setTmx("-30");
                          else if (num > 50) setTmx("50");
                          else setTmx(val);
                        }}
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-400"
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
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") { setTmn(""); return; }
                          const num = Number(val);
                          if (num < -30) setTmn("-30");
                          else if (num > 50) setTmn("50");
                          else setTmn(val);
                        }}
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-400"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400">℃</span>
                    </div>
                  </div>
               </div>
            </div>

            <button
              type="submit"
              disabled={!newTitle.trim() || !startDate}
              className="w-full bg-gray-900 hover:bg-black text-white text-sm font-bold py-3.5 rounded-xl transition-all disabled:bg-gray-100 disabled:text-gray-400 flex items-center justify-center gap-2 mt-4 shadow-sm"
            >
              일정 등록하기
            </button>
          </form>
        </div>

        {/* Summary Widget */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
           <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4 text-orange-500">
             <Activity className="w-8 h-8" />
           </div>
           <h4 className="text-lg font-bold text-gray-800 mb-1">훌륭합니다!</h4>
           <p className="text-sm font-medium text-gray-500 mb-6">
              오늘 총 <strong className="text-gray-800">{totalCount}</strong>개의 일정 중<br/>
              <strong className="text-gray-800">{completedCount}</strong>개를 완료하셨습니다.
           </p>
           
           <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-400 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
           </div>
        </div>
      </div>
    </div>
  );
}
