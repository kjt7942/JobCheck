"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Job } from "@/types";
import { Search, StickyNote, Tag, Calendar, AlertCircle } from "lucide-react";

interface NotesArchiveViewProps {
  tasks: Job[];
}

export default function NotesArchiveView({ tasks }: NotesArchiveViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 1. 피드백이 등록된 일정들만 추출
  const feedbackJobs = tasks.filter(t => t.feedback && t.feedback.trim() !== "" && !t.is_cancelled);

  // 2. 전체 피드백 태그 집계 및 정렬 (빈도 순)
  const tagCounts: { [key: string]: number } = {};
  feedbackJobs.forEach(job => {
    if (job.feedback_tags) {
      job.feedback_tags.forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag !== "") {
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });
    }
  });

  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

  // 3. 검색 및 태그 필터링 적용
  const filteredJobs = feedbackJobs.filter(job => {
    const matchesSearch = 
      job.task.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (job.feedback && job.feedback.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = 
      !selectedTag || 
      (job.feedback_tags && job.feedback_tags.map(t => t.toLowerCase()).includes(selectedTag.toLowerCase()));

    return matchesSearch && matchesTag;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 최신 피드백이 위로

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500">
          <StickyNote className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">영농 개선 노트</h2>
          <p className="text-xs md:text-sm text-gray-400">과거에 겪었던 시행착오와 조언들을 확인하고 더 나은 농사를 계획하세요.</p>
        </div>
      </div>

      {/* Search & Tag Filtering Box */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[24px] p-5 shadow-sm space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="개선 사항 키워드 또는 일정 이름으로 검색..."
            className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all font-medium"
          />
        </div>

        {/* Tag Cloud */}
        {sortedTags.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> 자주 쓰인 태그 필터
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedTag(null)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all ${
                  selectedTag === null
                    ? "bg-green-600 border-green-600 text-white shadow-sm"
                    : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-400 hover:bg-[var(--card-bg)]"
                }`}
              >
                전체보기 ({feedbackJobs.length})
              </button>
              {sortedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all ${
                    selectedTag === tag
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-500 hover:border-orange-500/30"
                  }`}
                >
                  #{tag} ({tagCounts[tag]})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes List */}
      {filteredJobs.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-dashed border-[var(--card-border)] rounded-[32px] p-12 text-center">
          <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-md font-bold text-[var(--foreground)] mb-1">피드백 노트를 찾을 수 없습니다</h4>
          <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
            {searchQuery || selectedTag ? (
              "검색어나 필터 조건을 변경해 보세요."
            ) : (
              <>
                일정 수정 화면에서 '영농 피드백'을 남겨주시면 이곳에<br />
                기록되어 내년에 큰 자산이 됩니다!
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-amber-500/5 dark:bg-amber-500/[0.02] border-2 border-amber-500/10 dark:border-amber-500/5 rounded-[28px] p-6 shadow-sm flex flex-col space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              {/* Note Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded-md">
                    📝 오답 개선노트
                  </span>
                  <h3 className="text-sm font-black text-[var(--foreground)] tracking-tight">
                    {job.task}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono font-bold shrink-0 bg-[var(--input-bg)] border border-[var(--card-border)] px-2 py-0.5 rounded-lg">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  {format(new Date(job.date), "yyyy-MM-dd", { locale: ko })}
                </div>
              </div>

              {/* Note Content */}
              <div className="bg-white dark:bg-zinc-900 border border-amber-500/5 rounded-2xl p-4 text-xs text-gray-600 dark:text-zinc-300 leading-relaxed shadow-inner">
                {job.feedback}
              </div>

              {/* Note Tags */}
              {job.feedback_tags && job.feedback_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {job.feedback_tags.map(tag => (
                    <span
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className="cursor-pointer bg-amber-500/10 text-amber-700 dark:text-amber-500 border border-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded text-[9.5px] font-black transition-all"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Decorative Note Pin Effect */}
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-8 h-2.5 bg-amber-500/20 rounded-b-md shadow-sm border-x border-b border-amber-500/10 group-hover:bg-amber-500/30 transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
