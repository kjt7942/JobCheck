"use client";

import { useState, useEffect } from "react";
import { Calendar, ListTodo, CalendarRange, Sprout, Settings, Wrench, StickyNote, Wallet } from "lucide-react";
import DailyView from "@/components/DailyView";
import MonthlyView from "@/components/MonthlyView";
import YearlyView from "@/components/YearlyView";
import ToolsView from "@/components/ToolsView";
import NotesArchiveView from "@/components/NotesArchiveView";
import FarmRecordsView from "@/components/FarmRecordsView";
import SettingsModal from "@/components/SettingsModal";
import ConfirmModal from "@/components/ConfirmModal";
import LoginView from "@/components/LoginView";
import { useApp } from "@/providers/AppProvider";
import { jobService } from "@/services/jobService";
import { authService } from "@/services/authService";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { Job, UserSettings } from "@/types";
import { findSeries, instanceDateISO, isVirtualId, overrideKey, parseDateStr, toDateStr, type RecurringScope } from "@/lib/recurrence";
import { FARM_LAT, FARM_LNG } from "@/lib/weather";

type Tab = "daily" | "monthly" | "yearly" | "tools" | "notes" | "records";

export default function Home() {
  const { user, settings, loading: authLoading, logout, showToast, refreshSettings, dailyWeather } = useApp();
  const [tasks, setTasks] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || authLoading) return;

    // 권한 체크: 관리자이거나 읽기 권한이 있을 때만 구독 시작
    const canRead = settings?.role === 'admin' || settings?.permissions?.canRead;

    if (!canRead) return; // 권한 없음 화면은 렌더에서 처리

    let unsubscribeJobs: (() => void) | undefined;
    let unsubscribeNotifs: (() => void) | undefined;

    const startSubscription = async () => {
      setLoading(true);
      unsubscribeJobs = await jobService.subscribeJobs((data) => {
        setTasks(data);
        setLoading(false);
      }, undefined, (e) => {
        console.error("일정 구독 오류:", e);
        setLoading(false);
        showToast("일정을 불러오지 못했습니다. 네트워크나 권한을 확인해 주세요.", "error");
      }); // 전체 일정을 실시간 구독

      // 관리자라면 알림 구독 추가
      if (settings?.role === 'admin') {
        unsubscribeNotifs = firestoreRepo.subscribeUnreadCount((count: number) => {
          setUnreadCount(count);
        });
      }
    };

    startSubscription();

    return () => {
      if (unsubscribeJobs) unsubscribeJobs();
      if (unsubscribeNotifs) unsubscribeNotifs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, settings?.role, settings?.permissions?.canRead, authLoading]);

  const handleSettingsSave = async (info: { name: string; region: string; latitude: number; longitude: number; weekStartsOn?: 0 | 1; theme?: 'light' | 'dark' }) => {
    if (!user || !settings) return;
    // 기상청 격자는 한반도 범위에서만 유효 — 빈 값(0)이나 오타 좌표 저장을 막음
    if (!(info.latitude >= 33 && info.latitude <= 39 && info.longitude >= 124 && info.longitude <= 132)) {
      showToast("위도(33~39)/경도(124~132)를 확인해 주세요.", "error");
      return;
    }
    try {
      // UI 필드(name, weekStartsOn, region, latitude, longitude)를 DB 필드(farm_name, start_day, location 등)로 매핑
      const newSettings: UserSettings = {
        ...settings,
        farm_name: info.name,
        location: info.region,
        latitude: info.latitude,
        longitude: info.longitude,
        start_day: info.weekStartsOn ?? settings.start_day,
        theme: info.theme ?? settings.theme,
        updated_at: Date.now()
      };

      await authService.updateSettings(newSettings);

      // AppProvider의 상태 갱신 (전체 앱에 반영)
      await refreshSettings(user.uid);

      setIsSettingsOpen(false);
      showToast("설정이 저장되었습니다.");
    } catch (e) {
      console.error("Settings save error:", e);
      showToast("설정 저장에 실패했습니다.", "error");
    }
  };

  const canWrite = settings?.role === 'admin' || !!settings?.permissions?.canWrite;
  const canDelete = settings?.role === 'admin' || !!settings?.permissions?.canDelete;

  const toNum = (v?: string | number) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  };

  // 낙관적 업데이트: 화면을 먼저 바꾸고, 저장 실패 시 되돌림
  const withOptimistic = async (apply: (prev: Job[]) => Job[], action: () => Promise<unknown>, failMsg: string) => {
    const original = tasks;
    setTasks(apply);
    try {
      await action();
      return true;
    } catch (e) {
      console.error(failMsg, e);
      setTasks(original);
      showToast(failMsg, "error");
      return false;
    }
  };

  // ids에 속하지 않은 일정들이 참조 중인 사진 URL (삭제 시 공유 사진 보호용)
  const urlsExcept = (ids: Set<string>) => tasks.filter(t => !ids.has(t.id!)).flatMap(t => t.image_urls ?? []);

  // 반복 일정의 특정 날짜 오버라이드 문서 데이터 (가상 일정 -> 실제 문서)
  const overrideData = (master: Job, instDate: string, fields: Partial<Job>): Omit<Job, "id" | "created_at"> => {
    const w = dailyWeather[instDate];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { recurrence, id, created_at, ...rest } = fields;
    return {
      task: master.task,
      date: instanceDateISO(master.date, instDate),
      is_done: false,
      user_id: user!.uid,
      group_id: master.group_id,
      weather: w?.weather ?? master.weather ?? "",
      temp_max: w?.temp_max ?? master.temp_max,
      temp_min: w?.temp_min ?? master.temp_min,
      rain_mm: w?.rain_mm,
      image_urls: master.image_urls,
      is_instance: true,
      instance_date: instDate,
      ...rest,
    };
  };
  const localDoc = (data: Omit<Job, "id" | "created_at">): Job => ({ ...data, id: overrideKey(data.group_id, data.instance_date!), created_at: Date.now() });

  // 날씨는 직접 입력받지 않음 — 날짜를 옮기면 새 날짜의 자동 수집 날씨로 교체 (없으면 비움, 크론이 나중에 채움)
  const weatherFor = (dateIso: string): Partial<Job> => {
    const w = dailyWeather[toDateStr(dateIso)];
    return { weather: w?.weather ?? "", temp_max: w?.temp_max ?? null, temp_min: w?.temp_min ?? null, rain_mm: w?.rain_mm ?? null };
  };

  const dayBeforeISO = (instDate: string) => {
    const d = parseDateStr(instDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  };

  const handleAddTask = async (
    task: string,
    date: string,
    weather?: string,
    temp_max?: string | number,
    temp_min?: string | number,
    group_id?: string,
    imageFiles?: File[],
    recurrence?: Job["recurrence"]
  ) => {
    if (!user) return;
    if (!canWrite) { showToast("일정을 등록할 권한이 없습니다.", "error"); return; }

    // 날씨를 따로 넘기지 않으면 그날의 자동 수집 날씨(지난 날=관측소 실측, 오늘=예보)로 채움.
    // 반복 일정 원본은 날마다 캐시를 쓰므로 비워 둠. 아직 캐시가 없는 날은 크론이 지난 뒤 채움.
    const w = !recurrence && weather === undefined ? dailyWeather[toDateStr(date)] : undefined;
    try {
      await jobService.createJob({
        task,
        date,
        is_done: false,
        user_id: user.uid,
        group_id: group_id || "",
        weather: w?.weather ?? weather ?? "",
        temp_max: w?.temp_max ?? toNum(temp_max),
        temp_min: w?.temp_min ?? toNum(temp_min),
        rain_mm: w?.rain_mm,
        recurrence,
      }, imageFiles);
      showToast("새로운 일정이 등록되었습니다.");
    } catch {
      showToast("일정 등록에 실패했습니다.", "error");
    }
  };

  const handleToggleTask = async (id: string, is_done: boolean) => {
    if (!canWrite) { showToast("수정 권한이 없습니다.", "error"); return; }

    if (isVirtualId(id)) {
      // 가상 일정 완료 체크 -> 그날의 인스턴스 문서 생성
      const series = findSeries(tasks, id);
      if (!series) return;
      const data = overrideData(series.master, series.instDate, { is_done });
      await withOptimistic(prev => [...prev, localDoc(data)], () => jobService.createJob(data), "상태 변경에 실패했습니다.");
      return;
    }
    await withOptimistic(
      prev => prev.map(t => t.id === id ? { ...t, is_done } : t),
      () => jobService.toggleTaskDone(id, is_done),
      "상태 변경에 실패했습니다."
    );
  };

  /**
   * 일정 수정. scope는 반복 일정의 가상 일정을 수정할 때만 의미 있음
   * - single: 이 날짜만 (인스턴스 문서 생성)
   * - following: 이 날짜부터 새 반복 일정으로 분리
   * - all: 반복 마스터 전체 수정
   */
  const handleUpdateTask = async (id: string, updates: Partial<Job>, newImageFiles?: File[], scope: RecurringScope = "single") => {
    if (!user) return;
    if (!canWrite) { showToast("수정 권한이 없습니다.", "error"); return; }

    const series = isVirtualId(id) ? findSeries(tasks, id) : null;
    if (isVirtualId(id) && !series) return;

    if (series && scope === "single") {
      const moved = updates.date && toDateStr(updates.date) !== series.instDate;
      const data = overrideData(series.master, series.instDate, moved ? { ...updates, ...weatherFor(updates.date!) } : updates);
      await withOptimistic(prev => [...prev, localDoc(data)], () => jobService.createJob(data, newImageFiles), "수정에 실패했습니다.");
      return;
    }

    if (series && scope === "following" && series.instDate > toDateStr(series.master.date)) {
      const { master, instDate } = series;
      const newGroupId = `rec_${Date.now()}`;
      const { recurrence, ...rest } = updates;
      const ok = await withOptimistic(prev => prev, async () => {
        // 1. 기존 반복을 전날에서 끊고
        await jobService.updateJob(master.id!, { recurrence: { ...master.recurrence!, end_date: dayBeforeISO(instDate) } });
        // 2. 이 날짜부터 원래 종료일까지 새 반복 일정 발행
        await jobService.createJob({
          ...overrideData(master, instDate, rest),
          is_instance: undefined,
          instance_date: undefined,
          group_id: newGroupId,
          recurrence: {
            type: recurrence?.type ?? master.recurrence!.type,
            interval: recurrence?.interval ?? master.recurrence!.interval ?? 1,
            end_date: master.recurrence!.end_date,
          },
        }, newImageFiles);
        // 3. 이 날짜 이후에 따로 수정/취소해둔 날짜들은 새 반복 일정 소속으로 이동 (중복 표시 방지)
        await Promise.all(tasks
          .filter(t => master.group_id && t.group_id === master.group_id && t.instance_date && t.instance_date >= instDate)
          .map(t => jobService.updateJob(t.id!, { group_id: newGroupId })));
      }, "수정에 실패했습니다.");
      if (ok) showToast("이 일정 및 이후 일정이 변경되었습니다.");
      return;
    }

    // all(또는 첫 날짜에서 following) -> 마스터 수정 / 일반 일정 수정
    const targetId = series ? series.master.id! : id;
    const target = tasks.find(t => t.id === targetId);
    let docUpdates = updates;
    if (!series && target && updates.date && toDateStr(updates.date) !== toDateStr(target.date)) {
      docUpdates = { ...updates, ...weatherFor(updates.date) };
    }
    if (series) {
      // 마스터의 시작 날짜는 유지하고 시각만 반영
      const masterDate = new Date(series.master.date);
      if (updates.date) {
        const e = new Date(updates.date);
        masterDate.setHours(e.getHours(), e.getMinutes());
      }
      docUpdates = { ...updates, date: masterDate.toISOString() };
    }

    const ok = await withOptimistic(
      prev => prev.map(t => t.id === targetId ? { ...t, ...docUpdates } : t),
      () => jobService.updateJob(targetId, docUpdates, newImageFiles),
      "수정에 실패했습니다."
    );
    if (!ok) return;
    if (series) showToast("모든 반복 일정이 변경되었습니다.");

    // 목록에서 뺀 사진은 Storage에서도 정리 (다른 일정이 쓰는 사진은 유지)
    if (docUpdates.image_urls && target?.image_urls) {
      const removed = target.image_urls.filter(u => !docUpdates.image_urls!.includes(u));
      jobService.deleteUnusedImages(targetId, removed, urlsExcept(new Set([targetId]))).catch(console.warn);
    }
  };

  const handleDeleteTask = (id: string) => {
    if (!canDelete) { showToast("삭제 권한이 없습니다.", "error"); return; }
    if (isVirtualId(id) && !findSeries(tasks, id)) return;
    setTaskToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const isRecurringDelete = !!taskToDelete && !!findSeries(tasks, taskToDelete);
  const cancelDelete = () => {
    setIsConfirmDeleteOpen(false);
    setTaskToDelete(null);
  };

  const executeDeleteTask = async (scope: RecurringScope = "single") => {
    const id = taskToDelete;
    setIsConfirmDeleteOpen(false);
    setTaskToDelete(null);
    if (!id) return;
    if (!canDelete) { showToast("삭제 권한이 없습니다.", "error"); return; }

    const series = findSeries(tasks, id);
    const done = () => showToast("일정이 삭제되었습니다.");

    // 반복과 무관한 일반 일정
    if (!series) {
      const ok = await withOptimistic(prev => prev.filter(t => t.id !== id), () => jobService.deleteJob(id, urlsExcept(new Set([id]))), "삭제에 실패했습니다.");
      if (ok) done();
      return;
    }

    const { master, instDate } = series;
    const isFirstDay = instDate <= toDateStr(master.date);

    if (scope === "all" || (scope === "following" && isFirstDay)) {
      // 마스터 + 같은 그룹의 모든 인스턴스/취소 표식 삭제 (group_id가 비어 있으면 마스터만)
      const ids = new Set(tasks.filter(t => t.id === master.id || (master.group_id && t.group_id === master.group_id)).map(t => t.id!));
      const keep = urlsExcept(ids);
      const ok = await withOptimistic(prev => prev.filter(t => !ids.has(t.id!)), () => Promise.all([...ids].map(x => jobService.deleteJob(x, keep))), "삭제에 실패했습니다.");
      if (ok) done();
      return;
    }

    if (scope === "following") {
      const ids = new Set(tasks.filter(t => master.group_id && t.group_id === master.group_id && t.instance_date && t.instance_date >= instDate).map(t => t.id!));
      const keep = urlsExcept(ids);
      const recurrence = { ...master.recurrence!, end_date: dayBeforeISO(instDate) };
      const ok = await withOptimistic(
        prev => prev.filter(t => !ids.has(t.id!)).map(t => t.id === master.id ? { ...t, recurrence } : t),
        () => Promise.all([jobService.updateJob(master.id!, { recurrence }), ...[...ids].map(x => jobService.deleteJob(x, keep))]),
        "삭제에 실패했습니다."
      );
      if (ok) done();
      return;
    }

    // single: 이 날짜만 -> "취소 표식"으로 남겨야 원본 반복 일정이 다시 나타나지 않음
    if (isVirtualId(id)) {
      const data = { ...overrideData(master, instDate, {}), is_instance: undefined, is_cancelled: true, image_urls: undefined };
      const ok = await withOptimistic(prev => [...prev, localDoc(data)], () => jobService.createJob(data), "삭제에 실패했습니다.");
      if (ok) done();
      return;
    }
    const target = tasks.find(t => t.id === id);
    const ok = await withOptimistic(
      prev => prev.map(t => t.id === id ? { ...t, is_instance: false, is_cancelled: true } : t),
      () => jobService.updateJob(id, { is_instance: false, is_cancelled: true, is_done: false, image_urls: [] }),
      "삭제에 실패했습니다."
    );
    if (ok) {
      done();
      jobService.deleteUnusedImages(id, target?.image_urls ?? [], urlsExcept(new Set([id]))).catch(console.warn);
    }
  };

  const executeLogout = async () => {
    setIsConfirmLogoutOpen(false);
    await logout();
  };

  const tabs = [
    { id: "daily", label: "일일 할일", icon: ListTodo },
    { id: "monthly", label: "월간 달력", icon: CalendarRange },
    { id: "yearly", label: "연간 일정", icon: Calendar },
    { id: "notes", label: "개선 노트", icon: StickyNote },
    { id: "records", label: "기록부", icon: Wallet },
    { id: "tools", label: "도구", icon: Wrench },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <Sprout className="w-12 h-12 text-green-600 animate-bounce" />
          <p className="loading-text font-bold animate-pulse tracking-tight">꿀송이농장 준비 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${settings?.theme === 'dark' ? 'dark' : ''} bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-green-200`}>
      {/* Header */}
      <header className="bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--card-border)] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("daily")}
            className="flex items-center gap-2 text-green-700 hover:opacity-70 transition-opacity active:scale-95"
            title="일일 일정으로 이동"
          >
            <Sprout className="w-7 h-7" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">{settings?.farm_name || "꿀송이농장"}</h1>
          </button>

          <div className="flex items-center gap-2">
            {/* Desktop Tabs */}
            <div className="hidden md:flex gap-1 bg-green-500/10 p-1 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                      ? "bg-[var(--card-bg)] text-green-600 shadow-sm border border-[var(--card-border)]"
                      : "text-gray-500 hover:text-green-600 hover:bg-green-500/10"
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-500/10 rounded-xl transition-all"
                title="농장 설정"
              >
                <Settings className="w-5 h-5" />
              </button>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--header-bg)] backdrop-blur-xl border-t border-[var(--card-border)] px-6 py-3 z-[100] flex items-center justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${isActive ? "text-green-600" : "text-gray-400"
                }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-green-500/10' : ''}`}>
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : 'scale-100'}`} />
              </div>
              <span className="text-[10px] font-bold">{tab.label.replace(' 일정', '').replace(' 달력', '').replace(' 할일', '').replace('개선 노트', '노트')}</span>
              {isActive && (
                <div className="absolute -top-3 w-1 h-1 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      <SettingsModal
        key={isSettingsOpen ? "settings-open" : "settings-closed"} // 열 때마다 새로 마운트해 폼 초기화
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        farmInfo={{
          name: settings?.farm_name ?? "꿀송이농장",
          region: settings?.location ?? "경상북도 문경시",
          latitude: settings?.latitude ?? FARM_LAT,
          longitude: settings?.longitude ?? FARM_LNG,
          weekStartsOn: (settings?.start_day as 0 | 1) ?? 1,
          theme: (settings?.theme as 'light' | 'dark') ?? 'light'
        }}
        onSave={handleSettingsSave}
        onLogout={() => setIsConfirmLogoutOpen(true)}
        unreadCount={unreadCount}
      />

      <ConfirmModal
        isOpen={isConfirmDeleteOpen && !isRecurringDelete}
        title="일정 삭제"
        message="이 일정을 정말로 삭제할까요? 삭제된 내용은 복구할 수 없습니다."
        confirmText="삭제하기"
        cancelText="취소"
        onConfirm={() => executeDeleteTask()}
        onCancel={cancelDelete}
      />

      {/* 🔄 반복 일정 삭제 범위 선택 */}
      {isConfirmDeleteOpen && isRecurringDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={cancelDelete}>
          <div
            className="w-full max-w-sm bg-[var(--card-bg)] rounded-[32px] p-6 shadow-2xl border border-[var(--card-border)] flex flex-col gap-2.5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-md font-extrabold text-[var(--foreground)]">반복 일정 삭제</h4>
            <p className="text-xs text-gray-400 mb-2">어디까지 삭제할까요? 삭제된 내용은 복구할 수 없습니다.</p>
            <button onClick={() => executeDeleteTask("single")} className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-3.5 rounded-xl transition-all">📍 이 일정만 삭제</button>
            <button onClick={() => executeDeleteTask("following")} className="w-full bg-red-500 hover:bg-red-600 text-white text-xs font-black py-3.5 rounded-xl transition-all">⏭️ 이 일정과 이후 일정 삭제</button>
            <button onClick={() => executeDeleteTask("all")} className="w-full bg-red-700 hover:bg-red-800 text-white text-xs font-black py-3.5 rounded-xl transition-all">🗑️ 전체 반복 일정 삭제</button>
            <button onClick={cancelDelete} className="w-full bg-[var(--input-bg)] text-gray-500 text-xs font-bold py-3.5 rounded-xl transition-all">취소</button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmLogoutOpen}
        title="로그아웃"
        message="정말 로그아웃 하시겠습니까? 다시 접속하려면 비밀번호가 필요합니다."
        confirmText="로그아웃"
        cancelText="계속 작업하기"
        onConfirm={executeLogout}
        onCancel={() => setIsConfirmLogoutOpen(false)}
      />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {!settings?.permissions?.canRead && settings?.role !== 'admin' ? (
          <div className="flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-500">
            <div className="p-6 bg-orange-500/10 rounded-[32px] mb-6">
              <Settings className="w-12 h-12 text-orange-500 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold mb-2">접근 권한이 없습니다</h3>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
              농장 일정을 보기 위해서는 관리자의 승인이 필요합니다. <br />
              관리자에게 문의해 주세요.
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="mt-8 px-8 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
            >
              설정 확인
            </button>
          </div>
        ) : loading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-green-600 animate-pulse">
            <Sprout className="w-12 h-12 mb-4 animate-bounce" />
            <p>자라나는 일정을 불러오고 있습니다...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === "daily" && (
              <DailyView
                tasks={tasks}
                onAdd={handleAddTask}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                canWrite={canWrite}
                canDelete={canDelete}
              />
            )}

            {activeTab === "monthly" && (
              <MonthlyView
                tasks={tasks}
                farmInfo={{
                  name: settings?.farm_name,
                  weekStartsOn: settings?.start_day ?? 1
                }}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                canWrite={canWrite}
                canDelete={canDelete}
              />
            )}

            {activeTab === "yearly" && (
              <YearlyView
                tasks={tasks}
              />
            )}

            {activeTab === "tools" && (
              <ToolsView />
            )}

            {activeTab === "notes" && (
              <NotesArchiveView
                tasks={tasks}
              />
            )}

            {activeTab === "records" && (
              <FarmRecordsView />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
