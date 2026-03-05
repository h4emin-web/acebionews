CREATE TABLE IF NOT EXISTS public.user_memos (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memo"
  ON public.user_memos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);