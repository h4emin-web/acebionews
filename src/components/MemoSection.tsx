import { useState, useEffect, useMemo, useRef } from "react";
import {
  NotebookPen, ChevronDown, FileText, StickyNote, Maximize2, Minimize2,
  Search, X, FolderPlus, Folder, FolderOpen, Plus, Trash2, GripVertical
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type NewsItem = { id: string; title: string; memo: string; folderId?: string | null; };
type Folder = { id: string; name: string; };
type MemoEntry = { id: string; title: string; content: string; created_at: string; updated_at: string; };

type Props = {
  user: User | null;
  bookmarkedArticles: any[];
  memoMap: Record<string, string>;
  onNewsClick: (articleId: string) => void;
  expanded: boolean;
  onExpand: (v: boolean) => void;
};

const Highlight = ({ text, query }: { text: string; query: string }) => {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return <>{parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5">{part}</mark> : part)}</>;
};

export const MemoSection = ({ user, bookmarkedArticles, memoMap, onNewsClick, expanded, onExpand }: Props) => {
  const [open, setOpen] = useState(false);
  const [newsMemosOpen, setNewsMemosOpen] = useState(false);
  const [freeMemosOpen, setFreeMemosOpen] = useState(false);
  const [newsSearch, setNewsSearch] = useState("");
  const [freeSearch, setFreeSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  // 일반 메모 항목
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [openEntries, setOpenEntries] = useState<Record<string, boolean>>({});
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // ─── 폴더 쿼리 ───
  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["memo-folders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("memo_folders").select("*").eq("user_id", user!.id).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // ─── 폴더별 bookmark folder_id 쿼리 ───
  const { data: bookmarkFolders = [] } = useQuery<{ article_id: string; folder_id: string | null }[]>({
    queryKey: ["bookmark-folders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookmarks").select("article_id, folder_id").eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── 일반 메모 항목 쿼리 ───
  const { data: memoEntries = [] } = useQuery<MemoEntry[]>({
    queryKey: ["memo-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_memo_entries").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ─── 폴더 생성 ───
  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("memo_folders").insert({ user_id: user!.id, name });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["memo-folders", user?.id] }); setNewFolderName(""); setShowNewFolder(false); },
  });

  // ─── 폴더 삭제 ───
  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      await supabase.from("bookmarks").update({ folder_id: null }).eq("user_id", user!.id).eq("folder_id", folderId);
      const { error } = await supabase.from("memo_folders").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memo-folders", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmark-folders", user?.id] });
    },
  });

  // ─── 뉴스 폴더 이동 ───
  const moveToFolder = useMutation({
    mutationFn: async ({ articleId, folderId }: { articleId: string; folderId: string | null }) => {
      const { error } = await supabase.from("bookmarks").update({ folder_id: folderId }).eq("user_id", user!.id).eq("article_id", articleId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmark-folders", user?.id] }),
  });

  // ─── 일반 메모 항목 추가 ───
  const addEntry = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      // 같은 제목 있으면 content 추가
      const existing = memoEntries.find(e => e.title.trim().toLowerCase() === title.trim().toLowerCase());
      if (existing) {
        const newContent = existing.content + "\n" + content;
        const { error } = await supabase.from("user_memo_entries").update({ content: newContent, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_memo_entries").insert({ user_id: user!.id, title, content });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["memo-entries", user?.id] }); setNewEntryTitle(""); setNewEntryContent(""); setSaving(true); setTimeout(() => setSaving(false), 1000); },
  });

  // ─── 일반 메모 항목 수정 ───
  const updateEntry = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("user_memo_entries").update({ content, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["memo-entries", user?.id] }); setEditingEntry(null); },
  });

  // ─── 일반 메모 항목 삭제 ───
  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_memo_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memo-entries", user?.id] }),
  });

  // ─── 폴더별 뉴스 그룹 ───
  const folderMap = Object.fromEntries(bookmarkFolders.map(b => [b.article_id, b.folder_id]));
  const newsWithMemos: NewsItem[] = bookmarkedArticles
    .map((a: any) => ({ id: a.id, title: a.title, memo: memoMap[a.id] || a.memo || "", folderId: folderMap[a.id] || null }))
    .filter((a) => a.memo.trim() !== "");

  const filteredNews = useMemo(() => {
    if (!newsSearch.trim()) return newsWithMemos;
    const q = newsSearch.toLowerCase();
    return newsWithMemos.filter(a => a.title.toLowerCase().includes(q) || a.memo.toLowerCase().includes(q));
  }, [newsWithMemos, newsSearch]);

  const unfoldered = filteredNews.filter(a => !a.folderId);
  const filteredEntries = useMemo(() => {
    if (!freeSearch.trim()) return memoEntries;
    const q = freeSearch.toLowerCase();
    return memoEntries.filter(e => e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
  }, [memoEntries, freeSearch]);

  // ─── 드래그 핸들러 ───
  const handleDragStart = (e: React.DragEvent, articleId: string) => { setDragId(articleId); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e: React.DragEvent, folderId: string) => { e.preventDefault(); setDragOverFolder(folderId); };
  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    if (dragId) moveToFolder.mutate({ articleId: dragId, folderId });
    setDragId(null); setDragOverFolder(null);
  };

  const NewsItem = ({ item, i }: { item: NewsItem; i: number }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, item.id)}
      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group flex items-start gap-1.5 cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0 opacity-40 group-hover:opacity-100" />
      <button onClick={() => onNewsClick(item.id)} className="flex-1 text-left min-w-0">
        <p className="text-[11px] font-bold text-muted-foreground mb-0.5 group-hover:text-primary transition-colors break-words">
          {i + 1}. <Highlight text={item.title} query={newsSearch} />
        </p>
        <p className="text-[11px] text-foreground whitespace-pre-wrap break-words">
          📝 <Highlight text={item.memo} query={newsSearch} />
        </p>
      </button>
    </div>
  );

  const sectionContent = (
    <div className="p-3 space-y-2">
      {/* 뉴스 메모 */}
      <Collapsible open={newsMemosOpen} onOpenChange={setNewsMemosOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
          <FileText className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-foreground">뉴스 메모</span>
          {newsWithMemos.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {newsSearch ? `${filteredNews.length}/${newsWithMemos.length}` : `${newsWithMemos.length}개`}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform duration-200 ${newsMemosOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1 space-y-1 pl-2">
            {/* 검색 */}
            <div className="relative px-1 pb-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input value={newsSearch} onChange={(e) => setNewsSearch(e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="제목 또는 메모 검색"
                className="w-full pl-7 pr-6 py-1.5 rounded-lg border border-border bg-background text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              {newsSearch && <button onClick={(e) => { e.stopPropagation(); setNewsSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
            </div>

            {/* 폴더 추가 버튼 */}
            <div className="px-1 pb-1 flex items-center gap-1">
              {showNewFolder ? (
                <div className="flex gap-1 w-full">
                  <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) createFolder.mutate(newFolderName.trim()); if (e.key === "Escape") setShowNewFolder(false); }}
                    placeholder="폴더 이름" className="flex-1 px-2 py-1 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => { if (newFolderName.trim()) createFolder.mutate(newFolderName.trim()); }} className="px-2 py-1 rounded bg-primary text-primary-foreground text-[11px]">추가</button>
                  <button onClick={() => setShowNewFolder(false)} className="px-2 py-1 rounded bg-muted text-[11px]">취소</button>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setShowNewFolder(true); }} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                  <FolderPlus className="w-3.5 h-3.5" /> 폴더 추가
                </button>
              )}
            </div>

            {/* 폴더들 */}
            {folders.map((folder) => {
              const folderItems = filteredNews.filter(a => a.folderId === folder.id);
              const isOpen = openFolders[folder.id];
              return (
                <div key={folder.id}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDrop={(e) => handleDrop(e, folder.id)}
                  onDragLeave={() => setDragOverFolder(null)}
                  className={`rounded-lg border transition-colors ${dragOverFolder === folder.id ? "border-primary bg-primary/5" : "border-transparent"}`}
                >
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setOpenFolders(p => ({ ...p, [folder.id]: !p[folder.id] }))}>
                    {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-amber-500" /> : <Folder className="w-3.5 h-3.5 text-amber-500" />}
                    <span className="text-[11px] font-semibold text-foreground flex-1">{folder.name}</span>
                    <span className="text-[10px] text-muted-foreground">{folderItems.length}개</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteFolder.mutate(folder.id); }} className="p-0.5 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="pl-3 space-y-0.5">
                      {folderItems.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground px-3 py-1">비어있음 — 여기에 드래그하세요</p>
                      ) : (
                        folderItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 폴더 없는 항목 + 드롭존 */}
            <div onDragOver={(e) => handleDragOver(e, "none")} onDrop={(e) => handleDrop(e, null)} onDragLeave={() => setDragOverFolder(null)}
              className={`rounded-lg border transition-colors ${dragOverFolder === "none" ? "border-primary bg-primary/5" : "border-transparent"}`}>
              {unfoldered.length === 0 && !newsSearch ? (
                <p className="text-[11px] text-muted-foreground px-3 py-2">스크랩 뉴스에 메모가 없습니다</p>
              ) : (
                unfoldered.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)
              )}
              {newsSearch && filteredNews.length === 0 && <p className="text-[11px] text-muted-foreground px-3 py-2">검색 결과 없음</p>}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="border-t border-border" />

      {/* 일반 메모 */}
      <Collapsible open={freeMemosOpen} onOpenChange={setFreeMemosOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
          <StickyNote className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-foreground">일반 메모</span>
          {memoEntries.length > 0 && <span className="text-[10px] text-muted-foreground ml-1">{memoEntries.length}개</span>}
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform duration-200 ${freeMemosOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2 pt-1 pb-2 space-y-2">
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input value={freeSearch} onChange={(e) => setFreeSearch(e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="제목 또는 내용 검색"
                className="w-full pl-7 pr-6 py-1.5 rounded-lg border border-border bg-background text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              {freeSearch && <button onClick={(e) => { e.stopPropagation(); setFreeSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
            </div>

            {/* 새 메모 입력 */}
            <div className="rounded-lg border border-border p-2 space-y-1.5 bg-muted/20">
              <input value={newEntryTitle} onChange={(e) => setNewEntryTitle(e.target.value)} placeholder="제목 (같은 제목이면 기존 항목에 추가)"
                className="w-full px-2 py-1.5 rounded border border-border bg-background text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <textarea value={newEntryContent} onChange={(e) => setNewEntryContent(e.target.value)} placeholder="내용을 입력하세요" rows={3}
                className="w-full resize-none px-2 py-1.5 rounded border border-border bg-background text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={() => { if (newEntryTitle.trim() && newEntryContent.trim()) addEntry.mutate({ title: newEntryTitle.trim(), content: newEntryContent.trim() }); }}
                disabled={!newEntryTitle.trim() || !newEntryContent.trim()}
                className="w-full py-1.5 rounded bg-primary text-primary-foreground text-[11px] font-semibold disabled:opacity-40 flex items-center justify-center gap-1 hover:bg-primary/90 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                {memoEntries.find(e => e.title.trim().toLowerCase() === newEntryTitle.trim().toLowerCase()) ? "기존 항목에 추가" : "새 항목 추가"}
              </button>
              {saving && <p className="text-[10px] text-green-500 text-right">저장됨 ✓</p>}
            </div>

            {/* 메모 항목 목록 */}
            {filteredEntries.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-1 py-1">{freeSearch ? "검색 결과 없음" : "메모가 없습니다"}</p>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setOpenEntries(p => ({ ...p, [entry.id]: !p[entry.id] }))}>
                    <span className="text-[11px] font-bold text-foreground flex-1 break-words">
                      <Highlight text={entry.title} query={freeSearch} />
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); deleteEntry.mutate(entry.id); }} className="p-0.5 shrink-0">
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${openEntries[entry.id] ? "rotate-180" : ""}`} />
                  </div>
                  {openEntries[entry.id] && (
                    <div className="p-2">
                      {editingEntry === entry.id ? (
                        <div className="space-y-1.5">
                          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4}
                            className="w-full resize-none px-2 py-1.5 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
                          <div className="flex gap-1">
                            <button onClick={() => updateEntry.mutate({ id: entry.id, content: editContent })} className="flex-1 py-1 rounded bg-primary text-primary-foreground text-[11px]">저장</button>
                            <button onClick={() => setEditingEntry(null)} className="flex-1 py-1 rounded bg-muted text-[11px]">취소</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[11px] text-foreground whitespace-pre-wrap break-words mb-1.5">
                            <Highlight text={entry.content} query={freeSearch} />
                          </p>
                          <button onClick={() => { setEditingEntry(entry.id); setEditContent(entry.content); }}
                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors">수정</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  if (expanded) {
    return (
      <div className="card-elevated rounded-lg overflow-hidden flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <NotebookPen className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">메모</h2>
          <button onClick={() => onExpand(false)} className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors text-[11px] text-muted-foreground hover:text-foreground">
            <Minimize2 className="w-3.5 h-3.5" /> 원래대로
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{sectionContent}</div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <NotebookPen className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">메모</h2>
        <button onClick={(e) => { e.stopPropagation(); onExpand(true); }} className="ml-auto p-1 rounded hover:bg-muted transition-colors mr-1" title="확장">
          <Maximize2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
        </button>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>{sectionContent}</CollapsibleContent>
    </Collapsible>
  );
};
