"use client";

import { Task } from "@/api/client";

export default function WeeklyView({
  tasks,
  onAdd,
}: {
  tasks: Task[];
  onAdd: (title: string, date: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-green-50 p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">이번 주 일정</h2>
        <div className="text-gray-500 text-center py-10">
          주간 달력 뷰 UI 구현 공간입니다.
        </div>
      </div>
    </div>
  );
}
