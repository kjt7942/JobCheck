import { format } from "date-fns";
import type { Job, DailyWeather } from "@/types";

/**
 * 반복 일정(마스터-인스턴스) 공통 엔진
 * - 마스터: recurrence가 있는 문서. 화면에는 날짜별 "가상 일정"(id = `${마스터ID}.${YYYY-MM-DD}`)으로 펼쳐짐
 * - 인스턴스: 특정 날짜를 수정/완료한 실제 문서 (is_instance + instance_date)
 * - 취소 표식: 특정 날짜만 지운 문서 (is_cancelled + instance_date)
 * 두 오버라이드 모두 (group_id, instance_date)로 마스터의 해당 날짜를 대체한다.
 */

/** 반복 일정 수정/삭제 범위: 이 날짜만 / 이 날짜 이후 / 전체 */
export type RecurringScope = "single" | "following" | "all";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const toDateStr = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");
export const overrideKey = (groupId: string, dateStr: string) => `${groupId}_${dateStr}`;

export const isVirtualId = (id: string) => id.includes(".");
export function parseVirtualId(id: string): { masterId: string; instDate: string } {
  const i = id.indexOf(".");
  return { masterId: id.slice(0, i), instDate: id.slice(i + 1) };
}

/** "YYYY-MM-DD"를 로컬 자정 Date로 (new Date("YYYY-MM-DD")는 UTC 자정이라 타임존에 따라 하루 밀릴 수 있음) */
export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 가상 일정의 실제 시각: 인스턴스 날짜 + 마스터의 시:분 */
export function instanceDateISO(masterDate: string, instDate: string): string {
  const m = new Date(masterDate);
  const d = parseDateStr(instDate);
  d.setHours(m.getHours(), m.getMinutes());
  return d.toISOString();
}

/** 반복 마스터가 day(로컬 날짜)에 발생하는지 */
export function occursOn(master: Job, day: Date): boolean {
  const rule = master.recurrence;
  if (!rule) return false;
  const start = dayOnly(new Date(master.date));
  const end = dayOnly(new Date(rule.end_date));
  const d = dayOnly(day);
  if (d < start || d > end) return false;

  const diffDays = Math.round((d.getTime() - start.getTime()) / DAY_MS);
  const interval = rule.interval || 1;
  switch (rule.type) {
    case "DAILY":
    case "CUSTOM":
      return diffDays % interval === 0;
    case "WEEKLY":
      return diffDays % (7 * interval) === 0;
    case "BIWEEKLY":
      return diffDays % (14 * interval) === 0;
    case "MONTHLY": {
      const months = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
      // 31일 시작 등: 그 달에 해당 일이 없으면 말일에 발생
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return months % interval === 0 && d.getDate() === Math.min(start.getDate(), lastDay);
    }
  }
  return false;
}

export interface OverrideIndex {
  instances: Set<string>;
  cancelled: Set<string>;
}

export function buildOverrideIndex(tasks: Job[]): OverrideIndex {
  const instances = new Set<string>();
  const cancelled = new Set<string>();
  for (const t of tasks) {
    if (!t.instance_date) continue;
    if (t.is_instance) instances.add(overrideKey(t.group_id, t.instance_date));
    if (t.is_cancelled) cancelled.add(overrideKey(t.group_id, t.instance_date));
  }
  return { instances, cancelled };
}

/** day에 화면에 보여줄 일정 목록 (일반 일정 + 인스턴스 + 반복 마스터의 가상 일정) */
export function getTasksForDate(
  tasks: Job[],
  day: Date,
  index: OverrideIndex,
  dailyWeather: Record<string, DailyWeather>
): Job[] {
  const dateStr = format(day, "yyyy-MM-dd");
  const list: Job[] = [];

  for (const t of tasks) {
    if (t.is_cancelled) continue;
    if (t.is_instance || !t.recurrence) {
      // 일반 일정 / 인스턴스(다른 날짜로 옮긴 것 포함)는 실제 날짜 기준
      if (toDateStr(t.date) === dateStr) list.push(t);
      continue;
    }
    if (!occursOn(t, day)) continue;
    const key = overrideKey(t.group_id, dateStr);
    if (index.cancelled.has(key) || index.instances.has(key)) continue; // 오버라이드가 대체

    // 그날의 자동 수집 날씨가 있으면 마스터의 정적 기본값 대신 사용
    const w = dailyWeather[dateStr];
    list.push({
      ...t,
      id: `${t.id}.${dateStr}`,
      date: instanceDateISO(t.date, dateStr),
      instance_date: dateStr,
      weather: w?.weather ?? t.weather,
      temp_max: w?.temp_max ?? t.temp_max,
      temp_min: w?.temp_min ?? t.temp_min,
    });
  }

  return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** 가상 일정 id 또는 반복 인스턴스 문서로부터 소속 마스터와 날짜를 찾음 (반복 일정이 아니면 null) */
export function findSeries(tasks: Job[], id: string): { master: Job; instDate: string } | null {
  if (isVirtualId(id)) {
    const { masterId, instDate } = parseVirtualId(id);
    const master = tasks.find(t => t.id === masterId);
    return master ? { master, instDate } : null;
  }
  const t = tasks.find(x => x.id === id);
  if (!t?.is_instance || !t.instance_date || !t.group_id) return null;
  const master = tasks.find(x => x.recurrence && x.group_id === t.group_id);
  return master ? { master, instDate: t.instance_date } : null;
}

// 간단 자체검증: node --experimental-strip-types src/lib/recurrence.ts
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("recurrence.ts")) {
  const m = (type: NonNullable<Job["recurrence"]>["type"], start: string, end: string, interval = 1) =>
    ({ id: "m", task: "t", date: parseDateStr(start).toISOString(), is_done: false, user_id: "u", group_id: "g", created_at: 0,
       recurrence: { type, interval, end_date: parseDateStr(end).toISOString() } }) as Job;
  const on = (j: Job, d: string) => occursOn(j, parseDateStr(d));
  const monthly31 = m("MONTHLY", "2026-01-31", "2026-12-31");
  console.assert(on(monthly31, "2026-02-28"), "월말 보정: 2월 28일");
  console.assert(!on(monthly31, "2026-02-27"), "2월 27일 아님");
  console.assert(on(monthly31, "2026-03-31") && on(monthly31, "2026-04-30"), "3/31, 4/30");
  const weekly = m("WEEKLY", "2026-09-01", "2026-09-30");
  console.assert(on(weekly, "2026-09-08") && !on(weekly, "2026-09-09") && !on(weekly, "2026-10-06"), "매주 + 종료일");
  const biweekly = m("BIWEEKLY", "2026-09-01", "2026-12-31");
  console.assert(on(biweekly, "2026-09-15") && !on(biweekly, "2026-09-08"), "격주");
  const tasks = [weekly, { ...weekly, id: "c", recurrence: undefined, is_cancelled: true, instance_date: "2026-09-08" } as Job];
  console.assert(getTasksForDate(tasks, parseDateStr("2026-09-08"), buildOverrideIndex(tasks), {}).length === 0, "취소된 날 숨김");
  console.assert(getTasksForDate(tasks, parseDateStr("2026-09-15"), buildOverrideIndex(tasks), {})[0]?.id === "m.2026-09-15", "가상 id");
  console.log("recurrence self-check done");
}
