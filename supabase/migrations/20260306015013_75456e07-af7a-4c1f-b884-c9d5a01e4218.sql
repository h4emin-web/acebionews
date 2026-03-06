-- 일반 메모 항목 테이블 (기록이 쌓이는 방식)
CREATE TABLE IF NOT EXISTS public.user_memo_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_memo_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memo entries"
  ON public.user_memo_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 뉴스 메모 폴더 테이블
CREATE TABLE IF NOT EXISTS public.memo_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.memo_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own folders"
  ON public.memo_folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- bookmarks에 folder_id 컬럼 추가
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.memo_folders(id) ON DELETE SET NULL;