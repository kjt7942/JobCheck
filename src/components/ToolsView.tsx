"use client";

import { useState } from "react";
import { Wrench, Droplet, CheckCircle, Info } from "lucide-react";

export default function ToolsView() {
  // --- 🧪 농약 희석 계산기 상태 ---
  const [waterVolume, setWaterVolume] = useState<number>(500); // 기본 500L
  const [diluteMode, setDiluteMode] = useState<"ratio" | "ppm">("ratio");
  const [ratioVal, setRatioVal] = useState<number>(1000); // 기본 1000배액
  const [ppmVal, setPpmVal] = useState<number>(25); // 기본 25ppm

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

            {/* 결과 출력 카드 (슬림화 버전) */}
            <div className="flex flex-col justify-center items-center bg-green-500/10 rounded-2xl border-2 border-dashed border-green-500/20 p-4 text-center space-y-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle className="w-5.5 h-5.5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-green-700 bg-green-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">필요한 농약/영양제 용량</span>
                <h4 className="text-2xl font-black text-green-600 mt-1">
                  {dilutionResult.agentGrams} <span className="text-base font-bold">mL / g</span>
                </h4>
              </div>
              <div className="pt-3 border-t border-green-500/10 w-full">
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
      </div>
    </div>
  );
}

