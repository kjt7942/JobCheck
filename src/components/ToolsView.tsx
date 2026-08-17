"use client";

import { useEffect, useState } from "react";
import { Wrench, Droplet, CheckCircle, Info, CalendarClock, Trash2, ShieldCheck, ShieldAlert, Sprout } from "lucide-react";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { useApp } from "@/providers/AppProvider";
import { sprayService } from "@/services/sprayService";
import { jobService } from "@/services/jobService";
import { SprayRecord } from "@/types";

// 🍇 샤인머스캣 표준 관리력 프리셋 (전국 평균 기준, 지역/기후에 맞게 등록 후 날짜 조정 권장)
const GRAPE_STANDARD_STAGES: { monthDay: string; task: string }[] = [
  { monthDay: "02-01", task: "동계전정" },
  { monthDay: "03-15", task: "눈틔우기(발아기 관리)" },
  { monthDay: "05-01", task: "순지르기/유인" },
  { monthDay: "05-20", task: "적과(송이다듬기)" },
  { monthDay: "06-01", task: "알솎기(착립정리)" },
  { monthDay: "06-20", task: "봉지씌우기" },
  { monthDay: "07-15", task: "여름전정/제초" },
  { monthDay: "08-10", task: "착색관리(반사필름 등)" },
  { monthDay: "09-20", task: "수확" },
  { monthDay: "11-01", task: "수확후 밑거름(시비)" },
];

export default function ToolsView() {
  const { user, settings, showToast } = useApp();
  const canRead = settings?.role === 'admin' || settings?.permissions?.canRead;
  const canWrite = settings?.role === 'admin' || settings?.permissions?.canWrite;
  const canDelete = settings?.role === 'admin' || settings?.permissions?.canDelete;

  // --- 🧪 농약 희석 계산기 상태 ---
  const [waterVolume, setWaterVolume] = useState<number>(500); // 기본 500L
  const [diluteMode, setDiluteMode] = useState<"ratio" | "ppm">("ratio");
  const [ratioVal, setRatioVal] = useState<number>(1000); // 기본 1000배액
  const [ppmVal, setPpmVal] = useState<number>(25); // 기본 25ppm

  // --- 🛡️ PHI(수확전 안전사용기준) 계산기 + 살포 이력 상태 ---
  const [sprayRecords, setSprayRecords] = useState<SprayRecord[]>([]);
  const [chemicalName, setChemicalName] = useState("");
  const [sprayDate, setSprayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [phiDays, setPhiDays] = useState<number>(7);
  const [sprayMemo, setSprayMemo] = useState("");

  useEffect(() => {
    if (!user || !canRead) return;
    const unsubscribe = sprayService.subscribeSprayRecords(setSprayRecords);
    return () => unsubscribe();
  }, [user, canRead]);

  const harvestReadyDate = format(addDays(new Date(sprayDate), phiDays || 0), "yyyy-MM-dd");

  const handleAddSprayRecord = async () => {
    if (!canWrite) { showToast("등록 권한이 없습니다.", "error"); return; }
    if (!chemicalName.trim()) { showToast("약제명을 입력해 주세요.", "error"); return; }
    try {
      await sprayService.addSprayRecord({
        chemical_name: chemicalName.trim(),
        spray_date: sprayDate,
        phi_days: phiDays || 0,
        memo: sprayMemo.trim() || undefined,
        user_id: user!.uid,
      });
      setChemicalName("");
      setSprayMemo("");
      showToast("살포 이력이 등록되었습니다.");
    } catch {
      showToast("등록에 실패했습니다.", "error");
    }
  };

  const handleDeleteSprayRecord = async (id: string) => {
    if (!canDelete) { showToast("삭제 권한이 없습니다.", "error"); return; }
    try {
      await sprayService.deleteSprayRecord(id);
    } catch {
      showToast("삭제에 실패했습니다.", "error");
    }
  };

  // --- 🍇 표준 작업 캘린더 프리셋 상태 ---
  const [presetYear, setPresetYear] = useState<number>(new Date().getFullYear());
  const [presetChecked, setPresetChecked] = useState<Set<number>>(new Set(GRAPE_STANDARD_STAGES.map((_, i) => i)));
  const [isRegisteringPreset, setIsRegisteringPreset] = useState(false);

  const togglePresetStage = (i: number) => {
    setPresetChecked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleRegisterPreset = async () => {
    if (!canWrite) { showToast("등록 권한이 없습니다.", "error"); return; }
    const selected = GRAPE_STANDARD_STAGES.filter((_, i) => presetChecked.has(i));
    if (selected.length === 0) { showToast("등록할 작업을 선택해 주세요.", "error"); return; }

    setIsRegisteringPreset(true);
    try {
      // Promise.all이 아닌 allSettled: 중간에 하나 실패해도 나머지는 계속 등록 시도
      const results = await Promise.allSettled(selected.map(stage =>
        jobService.createJob({
          task: stage.task,
          date: new Date(`${presetYear}-${stage.monthDay}T09:00:00`).toISOString(),
          is_done: false,
          user_id: user!.uid,
          group_id: "",
          weather: "",
        })
      ));
      const failedCount = results.filter(r => r.status === "rejected").length;
      const successCount = results.length - failedCount;
      if (failedCount === 0) {
        showToast(`표준 작업 일정 ${successCount}건이 등록되었습니다.`);
      } else {
        showToast(`${successCount}건 등록 완료, ${failedCount}건 실패했습니다. 실패한 항목은 다시 등록해 주세요.`, "error");
      }
    } finally {
      setIsRegisteringPreset(false);
    }
  };

  // --- 🧪 농약 계산 로직 ---
  const calculateDilution = () => {
    const waterMl = waterVolume * 1000;
    let requiredAgent = 0;
    
    if (diluteMode === "ratio") {
      requiredAgent = ratioVal > 0 ? waterMl / ratioVal : 0;
    } else {
      requiredAgent = (ppmVal * waterVolume) / 1000; // ppm = mg/L, g로 환산하면 (PPM * L) / 1000
    }

    // 약제 뚜껑/컵 환산 팁 (1컵 = 20mL 가정)
    const capVolume = 20; 
    const caps = requiredAgent / capVolume;

    return {
      agentGrams: parseFloat(requiredAgent.toFixed(1)),
      caps: parseFloat(caps.toFixed(1))
    };
  };

  const dilutionResult = calculateDilution();

  return (
    <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-6 min-h-[500px] flex flex-col animate-in fade-in duration-500">
      
      {/* 🛠️ 활성화된 도구 뷰 (농약 희석 계산기) */}
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 입력 제어 카드 */}
            <div className="space-y-4 bg-[var(--input-bg)] p-4 rounded-2xl border border-[var(--card-border)]">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">1. 약통 물 용량</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={waterVolume}
                    onChange={(e) => setWaterVolume(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 text-center"
                  />
                  <span className="absolute right-4 top-2.5 text-xs text-gray-400 font-black">L (리터)</span>
                </div>
                {/* 단축 버튼 */}
                <div className="flex gap-1.5 pt-0.5">
                  {[20, 100, 500, 1000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setWaterVolume(v)}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${
                        waterVolume === v
                          ? "bg-green-600 border-transparent text-white"
                          : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400 hover:bg-gray-200/50"
                      }`}
                    >
                      {v === 20 ? "한말(20L)" : `${v}L`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--card-border)]">
                <label className="text-xs font-bold text-gray-400 uppercase">2. 계산 모드 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDiluteMode("ratio")}
                    className={`py-1.5 rounded-xl text-xs font-black border transition-all ${
                      diluteMode === "ratio"
                        ? "bg-[var(--foreground)] border-transparent text-[var(--background)] shadow-sm"
                        : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400"
                    }`}
                  >
                    배수 (배액) 기준
                  </button>
                  <button
                    onClick={() => setDiluteMode("ppm")}
                    className={`py-1.5 rounded-xl text-xs font-black border transition-all ${
                      diluteMode === "ppm"
                        ? "bg-[var(--foreground)] border-transparent text-[var(--background)] shadow-sm"
                        : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400"
                    }`}
                  >
                    PPM 농도 기준
                  </button>
                </div>
              </div>

              {diluteMode === "ratio" ? (
                <div className="space-y-2 animate-in fade-in duration-250">
                  <label className="text-xs font-bold text-gray-400 uppercase">3. 희석 배수 입력</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="50000"
                      value={ratioVal}
                      onChange={(e) => setRatioVal(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 text-center"
                    />
                    <span className="absolute right-4 top-2.5 text-xs text-gray-400 font-black">배액</span>
                  </div>
                  <div className="flex gap-1.5 pt-0.5">
                    {[250, 500, 1000, 2000].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRatioVal(r)}
                        className={`px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${
                          ratioVal === r
                            ? "bg-green-600 border-transparent text-white"
                            : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400 hover:bg-gray-200/50"
                        }`}
                      >
                        {r}배
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in duration-250">
                  <label className="text-xs font-bold text-gray-400 uppercase">3. 목표 PPM 입력</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.1"
                      max="10000"
                      value={ppmVal}
                      onChange={(e) => setPpmVal(Math.max(0.1, Number(e.target.value)))}
                      className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 text-center"
                    />
                    <span className="absolute right-4 top-2.5 text-xs text-gray-400 font-black">PPM</span>
                  </div>
                  <div className="flex gap-1.5 pt-0.5">
                    {[10, 25, 50, 100].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPpmVal(p)}
                        className={`px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${
                          ppmVal === p
                            ? "bg-green-600 border-transparent text-white"
                            : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400 hover:bg-gray-200/50"
                        }`}
                      >
                        {p} ppm
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 결과 출력 카드 (슬림화 및 가로 배치 버전) */}
            <div className="flex flex-col justify-center bg-green-500/10 rounded-2xl border-2 border-dashed border-green-500/20 p-4 space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center text-green-600 shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="text-center flex flex-col items-center">
                  <span className="text-[10px] font-bold text-green-700 bg-green-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block">필요한 농약/영양제 용량</span>
                  <h4 className="text-2xl font-black text-green-600 mt-1">
                    {dilutionResult.agentGrams} <span className="text-base font-bold">mL / g</span>
                  </h4>
                </div>
              </div>
              <div className="pt-2.5 border-t border-green-500/10 w-full text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">현장 간편 계량 꿀팁</p>
                <p className="text-xs font-extrabold text-green-700 mt-1">
                  🧴 표준 뚜껑/컵(20mL) 기준 <strong className="text-sm text-green-600">{dilutionResult.caps} 컵</strong> 분량
                </p>
              </div>
            </div>
          </div>

          {/* 💡 실전 농약 조언 (하단으로 배치) */}
          <div className="bg-green-500/5 border border-green-500/10 p-3.5 rounded-2xl flex items-start gap-3">
            <Info className="w-4.5 h-4.5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-[11px] font-bold text-green-600">💡 실전 농약 조언</h5>
              <p className="text-[10.5px] text-gray-500 mt-0.5 leading-relaxed">
                약제를 섞을 때는 맹물에 전착제나 영양제를 먼저 녹인 후 농약을 희석하는 것이 엉김 현상을 방지하여 살포 효율을 극대화합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 🛡️ PHI(수확전 안전사용기준) 계산기 + 살포 이력 */}
        <div className="mt-8 pt-6 border-t border-[var(--card-border)] space-y-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-orange-500" />
            <h4 className="text-sm font-bold text-[var(--foreground)]">PHI 계산기 (수확 전 안전사용기준일)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 bg-[var(--input-bg)] p-4 rounded-2xl border border-[var(--card-border)]">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase">약제명</label>
                <input
                  type="text"
                  value={chemicalName}
                  onChange={(e) => setChemicalName(e.target.value)}
                  placeholder="예: OO 살균제"
                  className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">살포일</label>
                  <input
                    type="date"
                    value={sprayDate}
                    onChange={(e) => setSprayDate(e.target.value)}
                    className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">안전사용기준(일)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={phiDays}
                    onChange={(e) => setPhiDays(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase">메모 (선택)</label>
                <input
                  type="text"
                  value={sprayMemo}
                  onChange={(e) => setSprayMemo(e.target.value)}
                  placeholder="구역, 목적 등"
                  className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
                />
              </div>
              {canWrite && (
                <button
                  onClick={handleAddSprayRecord}
                  className="w-full py-2.5 rounded-xl text-sm font-black bg-green-600 text-white hover:bg-green-700 transition-all active:scale-95"
                >
                  살포 이력 저장
                </button>
              )}
            </div>

            <div className="flex flex-col justify-center bg-orange-500/10 rounded-2xl border-2 border-dashed border-orange-500/20 p-4 space-y-2 text-center">
              <span className="text-[10px] font-bold text-orange-700 bg-orange-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mx-auto">수확 가능일</span>
              <h4 className="text-2xl font-black text-orange-600">{format(new Date(harvestReadyDate), "M월 d일")}</h4>
              <p className="text-[11px] text-gray-500">살포일 + 안전사용기준 {phiDays}일 이후부터 수확 가능</p>
            </div>
          </div>

          {/* 살포 이력 목록 */}
          {sprayRecords.length > 0 && (
            <div className="space-y-2 pt-2">
              {sprayRecords.map((r) => {
                const readyDate = addDays(new Date(r.spray_date), r.phi_days);
                const daysLeft = differenceInCalendarDays(readyDate, new Date());
                const isSafe = daysLeft <= 0;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSafe ? (
                        <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--foreground)] truncate">{r.chemical_name}</p>
                        <p className="text-[10px] text-gray-400">
                          살포 {format(new Date(r.spray_date), "M/d")} · 수확가능 {format(readyDate, "M/d")}
                          {!isSafe && ` (D-${daysLeft})`}
                          {r.memo && ` · ${r.memo}`}
                        </p>
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteSprayRecord(r.id!)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 🍇 샤인머스캣 표준 작업 캘린더 프리셋 */}
        <div className="mt-8 pt-6 border-t border-[var(--card-border)] space-y-4">
          <div className="flex items-center gap-2">
            <Sprout className="w-4 h-4 text-green-600" />
            <h4 className="text-sm font-bold text-[var(--foreground)]">샤인머스캣 표준 작업 캘린더 일괄 등록</h4>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            전국 평균 기준 표준 관리력입니다. 지역/기후에 맞게 등록 후 날짜를 수정해서 쓰세요.
          </p>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-400 uppercase">연도</label>
            <input
              type="number"
              value={presetYear}
              onChange={(e) => setPresetYear(Number(e.target.value))}
              className="w-24 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-1.5 text-sm text-[var(--foreground)] font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GRAPE_STANDARD_STAGES.map((stage, i) => (
              <label
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                  presetChecked.has(i)
                    ? "bg-green-500/10 border-green-500/30 text-green-700"
                    : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={presetChecked.has(i)}
                  onChange={() => togglePresetStage(i)}
                  className="accent-green-600"
                />
                <span className="truncate">{stage.monthDay.replace("-", "/")} {stage.task}</span>
              </label>
            ))}
          </div>

          {canWrite && (
            <button
              onClick={handleRegisterPreset}
              disabled={isRegisteringPreset}
              className="w-full py-2.5 rounded-xl text-sm font-black bg-green-600 text-white hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {isRegisteringPreset ? "등록 중..." : "선택한 일정 일괄 등록"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

