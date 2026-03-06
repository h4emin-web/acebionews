CREATE TABLE IF NOT EXISTS public.read_articles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id text NOT NULL,
  read_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);

ALTER TABLE public.read_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own read articles"
  ON public.read_articles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);