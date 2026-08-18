"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Wallet, Trash2, TrendingUp, TrendingDown, Grape, Camera, X } from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import { farmRecordService } from "@/services/farmRecordService";
import { FarmRecord } from "@/types";
import { compressImage } from "@/utils/imageUtils";

const COST_CATEGORIES = ["농약", "비료", "인건비", "유류/농자재", "기타"];

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString()}원`;
}

export default function FarmRecordsView() {
  const { user, settings, showToast } = useApp();
  const canRead = settings?.role === 'admin' || settings?.permissions?.canRead;
  const canWrite = settings?.role === 'admin' || settings?.permissions?.canWrite;
  const canDelete = settings?.role === 'admin' || settings?.permissions?.canDelete;

  const [records, setRecords] = useState<FarmRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [recordType, setRecordType] = useState<'cost' | 'harvest'>('cost');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState(COST_CATEGORIES[0]);
  const [amount, setAmount] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [memo, setMemo] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !canRead) return;
    const unsubscribe = farmRecordService.subscribeFarmRecords(setRecords);
    return () => unsubscribe();
  }, [user, canRead]);

  const handleAdd = async () => {
    if (!canWrite) { showToast("등록 권한이 없습니다.", "error"); return; }
    if (amount <= 0) { showToast("금액/수확량을 입력해 주세요.", "error"); return; }
    try {
      await farmRecordService.addFarmRecord({
        type: recordType,
        date,
        category: recordType === 'cost' ? category : (category.trim() || undefined),
        amount,
        unit_price: recordType === 'harvest' && unitPrice > 0 ? unitPrice : undefined,
        memo: memo.trim() || undefined,
        user_id: user!.uid,
      }, imageFiles);
      setAmount(0);
      setUnitPrice(0);
      setMemo("");
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImageFiles([]);
      setImagePreviews([]);
      showToast("기록이 저장되었습니다.");
    } catch {
      showToast("저장에 실패했습니다.", "error");
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    const compressedFiles = await Promise.all(files.map(file => compressImage(file)));
    setImageFiles(prev => [...prev, ...compressedFiles]);
    setImagePreviews(prev => [...prev, ...compressedFiles.map(file => URL.createObjectURL(file))]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) { showToast("삭제 권한이 없습니다.", "error"); return; }
    try {
      await farmRecordService.deleteFarmRecord(id);
    } catch {
      showToast("삭제에 실패했습니다.", "error");
    }
  };

  const summarize = (year: number) => {
    const yearRecords = records.filter(r => r.date.startsWith(String(year)));
    const totalCost = yearRecords.filter(r => r.type === 'cost').reduce((s, r) => s + r.amount, 0);
    const totalHarvestKg = yearRecords.filter(r => r.type === 'harvest').reduce((s, r) => s + r.amount, 0);
    const totalRevenue = yearRecords
      .filter(r => r.type === 'harvest' && r.unit_price)
      .reduce((s, r) => s + r.amount * (r.unit_price || 0), 0);
    return { totalCost, totalHarvestKg, totalRevenue, netProfit: totalRevenue - totalCost };
  };

  const thisYear = summarize(selectedYear);
  const lastYear = summarize(selectedYear - 1);
  const yearRecords = records
    .filter(r => r.date.startsWith(String(selectedYear)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const compareBar = (label: string, current: number, prev: number, formatFn: (n: number) => string) => {
    const max = Math.max(current, prev, 1);
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400">
          <span>{label}</span>
          <span>{formatFn(current)} <span className="text-gray-300">(작년 {formatFn(prev)})</span></span>
        </div>
        <div className="h-2 bg-[var(--input-bg)] rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(current / max) * 100}%` }} />
        </div>
        <div className="h-1.5 bg-[var(--input-bg)] rounded-full overflow-hidden">
          <div className="h-full bg-gray-300 rounded-full transition-all" style={{ width: `${(prev / max) * 100}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">농장 기록부</h2>
          <p className="text-xs md:text-sm text-gray-400">투입 비용과 수확·매출을 기록하고 연도별로 정산해보세요.</p>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[24px] p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setRecordType('cost')}
            className={`py-2 rounded-xl text-xs font-black border transition-all ${
              recordType === 'cost' ? "bg-red-500 border-transparent text-white shadow-sm" : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400"
            }`}
          >
            💸 비용 지출
          </button>
          <button
            onClick={() => setRecordType('harvest')}
            className={`py-2 rounded-xl text-xs font-black border transition-all ${
              recordType === 'harvest' ? "bg-green-600 border-transparent text-white shadow-sm" : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400"
            }`}
          >
            🍇 수확/매출
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase">{recordType === 'cost' ? "분류" : "품종/구역 (선택)"}</label>
            {recordType === 'cost' ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
              >
                {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: A구역"
                className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase">{recordType === 'cost' ? "지출 금액(원)" : "수확량(kg)"}</label>
            <input
              type="number"
              min="0"
              value={amount || ""}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
            />
          </div>
          {recordType === 'harvest' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">판매 단가(원/kg, 선택)</label>
              <input
                type="number"
                min="0"
                value={unitPrice || ""}
                onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase">메모 (선택)</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase">영수증/명세서 사진 (선택)</label>
          <div className="flex flex-wrap gap-2">
            {imagePreviews.map((url, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-green-500/20 group">
                <img src={url} alt="첨부 이미지" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full shadow-md"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <label className="w-14 h-14 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--card-border)] hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer">
              <Camera className="w-5 h-5 text-gray-400" />
              <span className="text-[8px] text-gray-400 mt-0.5 font-bold">추가</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        {canWrite && (
          <button
            onClick={handleAdd}
            className="w-full py-2.5 rounded-xl text-sm font-black bg-green-600 text-white hover:bg-green-700 transition-all active:scale-95"
          >
            기록 저장
          </button>
        )}
      </div>

      {/* 연도별 정산 */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[24px] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--foreground)]">연도별 정산</h3>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-1.5 text-sm font-bold text-[var(--foreground)] focus:outline-none"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-500/10 rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-red-500 uppercase">총 비용</p>
            <p className="text-sm font-black text-red-600 mt-1">{formatWon(thisYear.totalCost)}</p>
          </div>
          <div className="bg-green-500/10 rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-green-600 uppercase">총 수확량</p>
            <p className="text-sm font-black text-green-700 mt-1">{thisYear.totalHarvestKg.toLocaleString()}kg</p>
          </div>
          <div className="bg-blue-500/10 rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-blue-500 uppercase">총 매출</p>
            <p className="text-sm font-black text-blue-600 mt-1">{formatWon(thisYear.totalRevenue)}</p>
          </div>
          <div className={`rounded-2xl p-3 text-center ${thisYear.netProfit >= 0 ? "bg-emerald-500/10" : "bg-orange-500/10"}`}>
            <p className={`text-[10px] font-bold uppercase flex items-center justify-center gap-1 ${thisYear.netProfit >= 0 ? "text-emerald-600" : "text-orange-500"}`}>
              {thisYear.netProfit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} 순이익(추정)
            </p>
            <p className={`text-sm font-black mt-1 ${thisYear.netProfit >= 0 ? "text-emerald-700" : "text-orange-600"}`}>{formatWon(thisYear.netProfit)}</p>
          </div>
        </div>

        {/* 작년 대비 비교 */}
        <div className="pt-3 border-t border-[var(--card-border)] space-y-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase">작년({selectedYear - 1}) 대비</p>
          {compareBar("총 비용", thisYear.totalCost, lastYear.totalCost, formatWon)}
          {compareBar("총 수확량", thisYear.totalHarvestKg, lastYear.totalHarvestKg, (n) => `${n.toLocaleString()}kg`)}
          {compareBar("총 매출", thisYear.totalRevenue, lastYear.totalRevenue, formatWon)}
        </div>
      </div>

      {/* 기록 목록 */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[24px] p-5 shadow-sm space-y-2">
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-2">{selectedYear}년 기록 목록</h3>
        {yearRecords.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">등록된 기록이 없습니다.</p>
        ) : (
          yearRecords.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {r.type === 'cost' ? (
                  <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <Grape className="w-4 h-4 text-green-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--foreground)] truncate">
                    {r.category ? `${r.category} · ` : ""}{r.type === 'cost' ? formatWon(r.amount) : `${r.amount.toLocaleString()}kg`}
                    {r.type === 'harvest' && r.unit_price ? ` (${formatWon(r.amount * r.unit_price)})` : ""}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {format(new Date(r.date), "M/d")}{r.memo ? ` · ${r.memo}` : ""}
                  </p>
                </div>
                {r.image_urls && r.image_urls.length > 0 && (
                  <div className="flex -space-x-2 shrink-0">
                    {r.image_urls.slice(0, 3).map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt="첨부 이미지"
                        onClick={() => setViewerUrl(url)}
                        className="w-8 h-8 rounded-lg object-cover border-2 border-[var(--card-bg)] cursor-pointer"
                      />
                    ))}
                  </div>
                )}
              </div>
              {canDelete && (
                <button
                  onClick={() => handleDelete(r.id!)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {viewerUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setViewerUrl(null)}
        >
          <img src={viewerUrl} alt="첨부 이미지 원본" className="max-w-full max-h-full rounded-2xl object-contain" />
          <button
            onClick={() => setViewerUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
