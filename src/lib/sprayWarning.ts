"use client";

import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { Job } from "@/types";

const SPRAY_KEYWORDS = ["방제", "농약", "살포"];

export function isSprayTask(taskText: string): boolean {
  return SPRAY_KEYWORDS.some(k => taskText.includes(k));
}

export interface SprayRainWarning {
  id: string;
  date: string; // YYYY-MM-DD
  task: string;
}

/**
 * 향후 daysAhead일 이내 예정된 방제/농약/살포 일정 중, 그날 비 예보가 있는 것을 찾아 경고 목록으로 반환합니다.
 * ponytail: 반복 마스터가 만들어내는 미확정 가상 인스턴스는 대상에서 제외 — 날짜가 이미 확정된
 * 일반/개별 일정만 체크. 반복 방제 일정까지 필요하면 DailyView의 가상 일정 연산 엔진과 통합 필요.
 */
export function useSprayRainWarnings(tasks: Job[], lat: number, lng: number, daysAhead: number = 2) {
  const [rainDates, setRainDates] = useState<Set<string>>(new Set());

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const endStr = format(addDays(new Date(), daysAhead), "yyyy-MM-dd");

  const candidates = tasks.filter(t => {
    if (t.is_cancelled || t.recurrence) return false;
    if (!isSprayTask(t.task)) return false;
    const d = format(new Date(t.date), "yyyy-MM-dd");
    return d >= todayStr && d <= endStr;
  });

  const uniqueDates = Array.from(new Set(candidates.map(t => format(new Date(t.date), "yyyy-MM-dd")))).sort();
  const uniqueDatesKey = uniqueDates.join(",");

  useEffect(() => {
    if (uniqueDates.length === 0) {
      setRainDates(new Set());
      return;
    }
    let cancelled = false;

    (async () => {
      const results = await Promise.all(uniqueDates.map(async (d) => {
        try {
          const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}&date=${d}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data.success && data.weather === "비" ? d : null;
        } catch {
          return null;
        }
      }));
      if (!cancelled) {
        setRainDates(new Set(results.filter((d): d is string => d !== null)));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueDatesKey, lat, lng]);

  const warnings: SprayRainWarning[] = candidates
    .filter(t => rainDates.has(format(new Date(t.date), "yyyy-MM-dd")))
    .map(t => ({ id: t.id!, date: format(new Date(t.date), "yyyy-MM-dd"), task: t.task }));

  return warnings;
}
