CREATE TABLE IF NOT EXISTS public.user_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, keyword)
);

ALTER TABLE public.user_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own keywords"
  ON public.user_keywords FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);