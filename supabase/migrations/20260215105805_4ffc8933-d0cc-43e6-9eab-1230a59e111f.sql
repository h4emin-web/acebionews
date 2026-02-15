
-- Allow service role to insert NCE patent data
CREATE POLICY "Only service role can insert nce patents"
ON public.nce_patent_expiry
FOR INSERT
WITH CHECK (( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

-- Allow service role to update NCE patent data
CREATE POLICY "Only service role can update nce patents"
ON public.nce_patent_expiry
FOR UPDATE
USING (( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

-- Allow service role to delete NCE patent data  
CREATE POLICY "Only service role can delete nce patents"
ON public.nce_patent_expiry
FOR DELETE
USING (( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);
