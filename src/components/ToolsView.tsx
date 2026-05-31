"use client";

import { useState } from "react";
import { Wrench, Droplet, ThermometerSun, Box, ArrowRightLeft, Sparkles, AlertTriangle, CheckCircle, TrendingUp, Info } from "lucide-react";

type ToolType = "dilute" | "dewpoint" | "pack";

export default function ToolsView() {
  const [activeTool, setActiveTool] = useState<ToolType>("dilute");

  // --- 🧪 농약 희석 계산기 상태 ---
  const [waterVolume, setWaterVolume] = useState<number>(500); // 기본 500L
  const [diluteMode, setDiluteMode] = useState<"ratio" | "ppm">("ratio");
  const [ratioVal, setRatioVal] = useState<number>(1000); // 기본 1000배액
  const [ppmVal, setPpmVal] = useState<number>(25); // 기본 25ppm

  // --- 🌡️ 이슬점 결로 계산기 상태 ---
  const [temp, setTemp] = useState<number>(20); // 기본 20도
  const [humidity, setHumidity] = useState<number>(60); // 기본 60%

  // --- 📦 수확량 포장 매출 계산기 상태 ---
  const [harvestWeight, setHarvestWeight] = useState<number>(150); // 기본 150kg
  const [boxSize, setBoxSize] = useState<number>(5); // 기본 5kg 박스
  const [boxPrice, setBoxPrice] = useState<number>(25000); // 5kg 박스당 25,000원 기본값

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

  // --- 🌡️ 이슬점 결로 계산 로직 (Magnus-Tetens 공식) ---
  const calculateDewPoint = () => {
    // Magnus-Tetens 공식 계수
    const a = 17.27;
    const b = 237.7;
    
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
    const dewPoint = (b * alpha) / (a - alpha);
    
    const diff = temp - dewPoint;
    
    let riskLevel: "safe" | "warning" | "danger" = "safe";
    let riskText = "안전 (결로 발생 가능성이 낮습니다)";
    
    if (diff <= 2) {
      riskLevel = "danger";
      riskText = "매우 위험 (즉시 환기 및 가온을 시작해 주세요!)";
    } else if (diff <= 5) {
      riskLevel = "warning";
      riskText = "주의 (하우스 구석이나 바닥에 결로가 생길 수 있습니다)";
    }

    return {
      dewPoint: parseFloat(dewPoint.toFixed(1)),
      diff: parseFloat(diff.toFixed(1)),
      riskLevel,
      riskText
    };
  };

  // --- 📦 수확량 매출 계산 로직 ---
  const calculateHarvest = () => {
    const totalBoxes = boxSize > 0 ? Math.floor(harvestWeight / boxSize) : 0;
    const remainingWeight = boxSize > 0 ? harvestWeight % boxSize : 0;
    const estimatedSales = totalBoxes * boxPrice;

    return {
      totalBoxes,
      remainingWeight: parseFloat(remainingWeight.toFixed(1)),
      estimatedSales: estimatedSales.toLocaleString()
    };
  };

  const dilutionResult = calculateDilution();
  const dewPointResult = calculateDewPoint();
  const harvestResult = calculateHarvest();

  return (
    <div className="bg-[var(--card-bg)] rounded-[24px] shadow-sm border border-[var(--card-border)] p-6 min-h-[500px] flex flex-col animate-in fade-in duration-500">
      
      {/* 🚀 상단 타이틀 */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--card-border)]">
        <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
          <Wrench className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-[var(--foreground)] tracking-tight">스마트 영농 도구함</h3>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider leading-none mt-1">Harness Smart Farming Tools</p>
        </div>
      </div>

      {/* 🔄 도구 선택 탭 */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { id: "dilute", label: "🧪 농약 희석", icon: Droplet },
          { id: "dewpoint", label: "🌡️ 결로 예방", icon: ThermometerSun },
          { id: "pack", label: "📦 포장 매출", icon: Box }
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id as ToolType)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-xs font-black transition-all active:scale-95 ${
                isActive
                  ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-500/10"
                  : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:border-green-500/30 hover:bg-[var(--card-bg)]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 🛠️ 활성화된 도구 뷰 */}
      <div className="flex-1 flex flex-col justify-between">
        
        {/* --- 🧪 1. 농약 희석 계산기 --- */}
        {activeTool === "dilute" && (
          <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-green-600">💡 실전 농약 조언</h5>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  약제를 섞을 때는 맹물에 전착제나 영양제를 먼저 녹인 후 농약을 희석하는 것이 엉김 현상을 방지하여 살포 효율을 극대화합니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 입력 제어 카드 */}
              <div className="space-y-5 bg-[var(--input-bg)] p-5 rounded-2xl border border-[var(--card-border)]">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">1. 약통 물 용량</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={waterVolume}
                      onChange={(e) => setWaterVolume(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 text-center"
                    />
                    <span className="absolute right-4 top-3 text-xs text-gray-400 font-black">L (리터)</span>
                  </div>
                  {/* 단축 버튼 */}
                  <div className="flex gap-1.5 pt-1">
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
                      className={`py-2 rounded-xl text-xs font-black border transition-all ${
                        diluteMode === "ratio"
                          ? "bg-[var(--foreground)] border-transparent text-[var(--background)] shadow-sm"
                          : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400"
                      }`}
                    >
                      배수 (배액) 기준
                    </button>
                    <button
                      onClick={() => setDiluteMode("ppm")}
                      className={`py-2 rounded-xl text-xs font-black border transition-all ${
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
                        className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 text-center"
                      />
                      <span className="absolute right-4 top-3 text-xs text-gray-400 font-black">배액</span>
                    </div>
                    <div className="flex gap-1.5 pt-1">
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
                        className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 text-center"
                      />
                      <span className="absolute right-4 top-3 text-xs text-gray-400 font-black">PPM</span>
                    </div>
                    <div className="flex gap-1.5 pt-1">
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

              {/* 결과 출력 카드 */}
              <div className="flex flex-col justify-center items-center bg-green-500/10 rounded-2xl border-2 border-dashed border-green-500/20 p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-green-700 bg-green-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">필요한 농약/영양제 용량</span>
                  <h4 className="text-3xl font-black text-green-600 mt-2">
                    {dilutionResult.agentGrams} <span className="text-xl">mL / g</span>
                  </h4>
                </div>
                <div className="pt-4 border-t border-green-500/10 w-full">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">현장 간편 계량 꿀팁</p>
                  <p className="text-sm font-extrabold text-green-700 mt-1.5">
                    🧴 표준 뚜껑/컵(20mL) 기준 <strong className="text-lg text-green-600">{dilutionResult.caps} 컵</strong> 분량
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 🌡️ 2. 하우스 이슬점/결로 계산기 --- */}
        {activeTool === "dewpoint" && (
          <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-blue-600">💡 결로 예방 요령</h5>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  하우스 내 외부 온도차가 심한 아침 시간대에 습도가 90% 이상으로 올라가면 결로가 무조건 발생합니다. 일출 전 가온을 하거나 적절한 환기를 시켜 하우스 습도를 조절하십시오.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 입력 제어 카드 */}
              <div className="space-y-5 bg-[var(--input-bg)] p-5 rounded-2xl border border-[var(--card-border)]">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">1. 하우스 실내 온도</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="-20"
                      max="65"
                      value={temp}
                      onChange={(e) => setTemp(Number(e.target.value))}
                      className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-red-500 font-extrabold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center"
                    />
                    <span className="absolute right-4 top-3 text-xs text-gray-400 font-black">℃</span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="45"
                    value={temp}
                    onChange={(e) => setTemp(Number(e.target.value))}
                    className="w-full accent-red-500 mt-1"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--card-border)]">
                  <label className="text-xs font-bold text-gray-400 uppercase">2. 상대 습도</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={humidity}
                      onChange={(e) => setHumidity(Math.max(1, Math.min(100, Number(e.target.value))))}
                      className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-blue-500 font-extrabold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center"
                    />
                    <span className="absolute right-4 top-3 text-xs text-gray-400 font-black">%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={humidity}
                    onChange={(e) => setHumidity(Number(e.target.value))}
                    className="w-full accent-blue-500 mt-1"
                  />
                </div>
              </div>

              {/* 결과 출력 카드 */}
              <div className={`flex flex-col justify-center items-center rounded-2xl border-2 border-dashed p-6 text-center space-y-4 ${
                dewPointResult.riskLevel === "danger" 
                  ? "bg-red-500/10 border-red-500/20" 
                  : dewPointResult.riskLevel === "warning" 
                    ? "bg-amber-500/10 border-amber-500/20" 
                    : "bg-green-500/10 border-green-500/20"
              }`}>
                {dewPointResult.riskLevel === "danger" ? (
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-600 animate-bounce">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                ) : dewPointResult.riskLevel === "warning" ? (
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-600 animate-pulse">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                )}
                
                <div>
                  <span className="text-[10px] font-bold text-gray-400 bg-[var(--input-bg)] border border-[var(--card-border)] px-2.5 py-1 rounded-md uppercase tracking-wider">이슬점 (결로 형성 온도)</span>
                  <h4 className={`text-3xl font-black mt-2.5 ${
                    dewPointResult.riskLevel === "danger" 
                      ? "text-red-500" 
                      : dewPointResult.riskLevel === "warning" 
                        ? "text-amber-500" 
                        : "text-green-600"
                  }`}>
                    {dewPointResult.dewPoint} <span className="text-xl">℃</span>
                  </h4>
                </div>

                <div className="pt-4 border-t border-gray-400/10 w-full">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">결로 발생 위험도 판정</p>
                  <p className={`text-xs font-black mt-1.5 ${
                    dewPointResult.riskLevel === "danger" 
                      ? "text-red-500" 
                      : dewPointResult.riskLevel === "warning" 
                        ? "text-amber-500" 
                        : "text-green-600"
                  }`}>
                    {dewPointResult.riskText}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                    현재 온도와 이슬점의 차이가 <strong className="text-[var(--foreground)]">{dewPointResult.diff}℃</strong> 수준입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 📦 3. 수확량 및 포장 매출 계산기 --- */}
        {activeTool === "pack" && (
          <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-amber-600">💡 스마트 매출 조언</h5>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  수확물을 포장할 때 등급 선별을 철저히 하고 소포장할수록 부가가치가 상승합니다! 박스 규격별 실시간 단가를 기반으로 포장 계획을 짜보세요.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 입력 제어 카드 */}
              <div className="space-y-5 bg-[var(--input-bg)] p-5 rounded-2xl border border-[var(--card-border)]">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">1. 총 수확한 무게</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={harvestWeight}
                      onChange={(e) => setHarvestWeight(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center"
                    />
                    <span className="absolute right-4 top-3 text-xs text-gray-400 font-black">kg (킬로그램)</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {[10, 50, 100, 300].map((w) => (
                      <button
                        key={w}
                        onClick={() => setHarvestWeight(w)}
                        className={`px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${
                          harvestWeight === w
                            ? "bg-green-600 border-transparent text-white"
                            : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400 hover:bg-gray-200/50"
                        }`}
                      >
                        {w}kg
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">2. 박스 당 무게</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={boxSize}
                        onChange={(e) => setBoxSize(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center"
                      />
                      <span className="absolute right-4 top-2.5 text-xs text-gray-400 font-black">kg</span>
                    </div>
                    <div className="flex gap-1 pt-0.5">
                      {[2, 5, 10].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setBoxSize(sz)}
                          className={`flex-1 py-1 text-[9px] font-black rounded-lg border transition-all ${
                            boxSize === sz
                              ? "bg-green-600 border-transparent text-white"
                              : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400 hover:bg-gray-200/50"
                          }`}
                        >
                          {sz}kg
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">3. 박스당 평균 단가</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        value={boxPrice}
                        onChange={(e) => setBoxPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] font-extrabold focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-center"
                      />
                      <span className="absolute right-4 top-2.5 text-xs text-gray-400 font-black">원</span>
                    </div>
                    <div className="flex gap-1 pt-0.5">
                      {[15000, 25000, 50000].map((pr) => (
                        <button
                          key={pr}
                          onClick={() => setBoxPrice(pr)}
                          className={`flex-1 py-1 text-[9px] font-black rounded-lg border transition-all ${
                            boxPrice === pr
                              ? "bg-green-600 border-transparent text-white"
                              : "bg-[var(--card-bg)] border-[var(--card-border)] text-gray-400 hover:bg-gray-200/50"
                          }`}
                        >
                          {(pr/10000).toFixed(0)}만
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 결과 출력 카드 */}
              <div className="flex flex-col justify-center items-center bg-amber-500/10 rounded-2xl border-2 border-dashed border-amber-500/20 p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-500/20 px-2.5 py-1 rounded-md uppercase tracking-wider">포장 박스 수량 및 잔량</span>
                  <h4 className="text-3xl font-black text-amber-600 mt-2.5">
                    {harvestResult.totalBoxes} <span className="text-xl">박스</span>
                  </h4>
                  {harvestResult.remainingWeight > 0 && (
                    <p className="text-[10px] font-bold text-amber-700 mt-1">
                      (포장 후 잔여 중량: {harvestResult.remainingWeight} kg)
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-amber-500/10 w-full">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">예상 총 매출액</span>
                  <p className="text-2xl font-black text-amber-600 mt-1">
                    {harvestResult.estimatedSales} <span className="text-base font-bold">원</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
