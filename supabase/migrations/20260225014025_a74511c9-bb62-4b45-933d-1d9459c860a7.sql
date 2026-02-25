
-- Create table for clinical trial approvals (IND)
CREATE TABLE public.clinical_trial_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seq_number INTEGER NOT NULL,
  sponsor TEXT NOT NULL,
  product_name TEXT NOT NULL,
  trial_title TEXT NOT NULL,
  phase TEXT NOT NULL,
  approval_date DATE NOT NULL,
  dev_region TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seq_number, approval_date, product_name)
);

-- Enable RLS
ALTER TABLE public.clinical_trial_approvals ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read clinical trial approvals"
ON public.clinical_trial_approvals
FOR SELECT
USING (true);

-- Service role only for writes
CREATE POLICY "Only service role can insert clinical trial approvals"
ON public.clinical_trial_approvals
FOR INSERT
WITH CHECK ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can update clinical trial approvals"
ON public.clinical_trial_approvals
FOR UPDATE
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can delete clinical trial approvals"
ON public.clinical_trial_approvals
FOR DELETE
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

-- Index for fast queries
CREATE INDEX idx_clinical_trial_approval_date ON public.clinical_trial_approvals(approval_date DESC);
