
-- NCE 특허 만료 데이터 테이블
CREATE TABLE public.nce_patent_expiry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  api_name TEXT NOT NULL,
  company TEXT,
  expiry_date DATE NOT NULL,
  indication TEXT,
  market_size TEXT,
  recommendation INTEGER DEFAULT 0 CHECK (recommendation >= 0 AND recommendation <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nce_patent_expiry ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "NCE patent data is publicly readable"
ON public.nce_patent_expiry
FOR SELECT
USING (true);

-- Create index for sorting
CREATE INDEX idx_nce_patent_expiry_date ON public.nce_patent_expiry (expiry_date);
