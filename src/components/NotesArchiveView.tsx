"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Job, ImprovementNote } from "@/types";
import { Search, StickyNote, Tag, Calendar, AlertCircle, Plus, Trash2, PenLine, Pencil, Check, X } from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import { improvementNoteService } from "@/services/improvementNoteService";
import { jobService } from "@/services/jobService";

interface NotesArchiveViewProps {
  tasks: Job[];
}

// 일정 피드백과 독립 메모를 한 목록에서 다루기 위한 공통 카드 형태
interface NoteEntry {
  key: string;
  source: "job" | "note";
  title: string | null;
  date: number; // 정렬/표시용 timestamp
  content: string;
  tags: string[];
  jobId?: string; // source === "job"일 때만 수정에 사용
  noteId?: string; // source === "note"일 때만 수정/삭제에 사용
}

export default function NotesArchiveView({ tasks }: NotesArchiveViewProps) {
  const { user, settings, showToast } = useApp();
  const canWrite = settings?.role === 'admin' || settings?.permissions?.canWrite;
  const canDelete = settings?.role === 'admin' || settings?.permissions?.canDelete;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [notes, setNotes] = useState<ImprovementNote[]>([]);
  const [memoContent, setMemoContent] = useState("");
  const [memoTags, setMemoTags] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = improvementNoteService.subscribeImprovementNotes(setNotes);
    return () => unsubscribe();
  }, [user]);

  const handleAddMemo = async () => {
    if (!canWrite) { showToast("등록 권한이 없습니다.", "error"); return; }
    if (!memoContent.trim()) { showToast("메모 내용을 입력해 주세요.", "error"); return; }
    if (saving) return;
    setSaving(true);
    try {
      const tags = memoTags.split(",").map(t => t.trim()).filter(t => t !== "");
      await improvementNoteService.addImprovementNote({
        content: memoContent.trim(),
        tags: tags.length > 0 ? tags : undefined,
        user_id: user!.uid,
      });
      setMemoContent("");
      setMemoTags("");
      showToast("메모가 저장되었습니다.");
    } catch {
      showToast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEditEntry = (entry: NoteEntry) => {
    setEditingKey(entry.key);
    setEditContent(entry.content);
    setEditTags(entry.tags.join(", "));
  };

  const cancelEditEntry = () => {
    setEditingKey(null);
    setEditContent("");
    setEditTags("");
  };

  const handleSaveEditEntry = async (entry: NoteEntry) => {
    if (!canWrite) { showToast("수정 권한이 없습니다.", "error"); return; }
    if (!editContent.trim()) { showToast("내용을 입력해 주세요.", "error"); return; }
    if (updating) return;
    setUpdating(true);
    try {
      const tags = editTags.split(",").map(t => t.trim()).filter(t => t !== "");
      if (entry.source === "job") {
        await jobService.updateJob(entry.jobId!, {
          feedback: editContent.trim(),
          feedback_tags: tags,
        });
      } else {
        await improvementNoteService.updateImprovementNote(entry.noteId!, {
          content: editContent.trim(),
          tags,
        });
      }
      cancelEditEntry();
      showToast("수정되었습니다.");
    } catch {
      showToast("수정에 실패했습니다.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMemo = async (id: string) => {
    if (!canDelete) { showToast("삭제 권한이 없습니다.", "error"); return; }
    try {
      await improvementNoteService.deleteImprovementNote(id);
    } catch {
      showToast("삭제에 실패했습니다.", "error");
    }
  };

  // 1. 피드백이 등록된 일정들을 공통 형태로 변환
  const jobEntries: NoteEntry[] = tasks
    .filter(t => t.feedback && t.feedback.trim() !== "" && !t.is_cancelled)
    .map(job => ({
      key: `job-${job.id}`,
      source: "job",
      title: job.task,
      date: new Date(job.date).getTime(),
      content: job.feedback!,
      tags: job.feedback_tags || [],
      jobId: job.id,
    }));

  // 2. 독립 메모를 공통 형태로 변환
  const noteEntries: NoteEntry[] = notes.map(note => ({
    key: `note-${note.id}`,
    source: "note",
    title: null,
    date: note.created_at,
    content: note.content,
    tags: note.tags || [],
    noteId: note.id,
  }));

  const allEntries = [...jobEntries, ...noteEntries];

  // 3. 전체 태그 집계 및 정렬 (빈도 순)
  const tagCounts: { [key: string]: number } = {};
  allEntries.forEach(entry => {
    entry.tags.forEach(tag => {
      const cleanTag = tag.trim();
      if (cleanTag !== "") {
        tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
      }
    });
  });

  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

  // 4. 검색 및 태그 필터링 적용
  const filteredEntries = allEntries.filter(entry => {
    const matchesSearch =
      (entry.title && entry.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag =
      !selectedTag ||
      entry.tags.map(t => t.toLowerCase()).includes(selectedTag.toLowerCase());

    return matchesSearch && matchesTag;
  }).sort((a, b) => b.date - a.date); // 최신 순

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

      {/* Quick Memo Form */}
      {canWrite && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[24px] p-5 shadow-sm space-y-3">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <PenLine className="w-3.5 h-3.5" /> 바로 메모하기
          </span>
          <textarea
            value={memoContent}
            onChange={(e) => setMemoContent(e.target.value)}
            placeholder="떠오른 개선 사항을 바로 적어보세요..."
            rows={2}
            className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all resize-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={memoTags}
              onChange={(e) => setMemoTags(e.target.value)}
              placeholder="태그 (쉼표로 구분, 선택)"
              className="flex-1 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all"
            />
            <button
              onClick={handleAddMemo}
              disabled={saving}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-black bg-green-600 text-white hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> {saving ? "저장 중..." : "메모 추가"}
            </button>
          </div>
        </div>
      )}

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
            className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl pl-11 pr-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all font-medium"
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
                    : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-600 dark:text-gray-400 hover:border-orange-500/30"
                }`}
              >
                전체보기 ({allEntries.length})
              </button>
              {sortedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all ${
                    selectedTag === tag
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : "bg-[var(--input-bg)] border-[var(--card-border)] text-gray-600 dark:text-gray-400 hover:border-orange-500/30"
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
      {filteredEntries.length === 0 ? (
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
                위에서 바로 메모를 남기거나, 일정 수정 화면에서 '영농 피드백'을<br />
                남겨주시면 이곳에 기록되어 내년에 큰 자산이 됩니다!
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {filteredEntries.map((entry) => {
            const isEditing = editingKey === entry.key;
            return (
              <div
                key={entry.key}
                className="bg-amber-500/5 dark:bg-amber-500/[0.02] border-2 border-amber-500/10 dark:border-amber-500/5 rounded-[28px] p-6 shadow-sm flex flex-col space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                {/* Note Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-[var(--foreground)] tracking-tight">
                      {entry.title || "메모"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono font-bold bg-[var(--input-bg)] border border-[var(--card-border)] px-2 py-0.5 rounded-lg">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {format(new Date(entry.date), "yyyy-MM-dd", { locale: ko })}
                    </div>
                    {!isEditing && canWrite && (
                      <button
                        onClick={() => startEditEntry(entry)}
                        className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-500/10 rounded-lg transition-all"
                        title="수정"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {entry.source === "note" && !isEditing && canDelete && (
                      <button
                        onClick={() => handleDeleteMemo(entry.noteId!)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all resize-none"
                    />
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="태그 (쉼표로 구분, 선택)"
                      className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-500 transition-all"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={cancelEditEntry}
                        disabled={updating}
                        className="py-2 rounded-xl text-xs font-black bg-[var(--input-bg)] border border-[var(--card-border)] text-gray-500 hover:bg-gray-500/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> 취소
                      </button>
                      <button
                        onClick={() => handleSaveEditEntry(entry)}
                        disabled={updating}
                        className="py-2 rounded-xl text-xs font-black bg-green-600 text-white hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> {updating ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Note Content */}
                    <div className="bg-white dark:bg-zinc-900 border border-amber-500/5 rounded-2xl p-4 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed shadow-inner">
                      {entry.content}
                    </div>

                    {/* Note Tags */}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map(tag => (
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
                  </>
                )}

                {/* Decorative Note Pin Effect */}
                <div className="absolute top-0 right-1/2 translate-x-1/2 w-8 h-2.5 bg-amber-500/20 rounded-b-md shadow-sm border-x border-b border-amber-500/10 group-hover:bg-amber-500/30 transition-colors" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
