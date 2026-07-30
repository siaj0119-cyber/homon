-- 1. DB 접수 내역을 저장할 'leads' 테이블 생성 (실제 스키마 반영)
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_name text,
  customer_phone text,
  form_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT '신규접수'::text,
  platform text,
  manager text,
  memo text,
  ip_address text,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

-- 2. 관리자 설정값을 저장할 'external_settings' 테이블 생성 (실제 스키마 반영)
CREATE TABLE IF NOT EXISTS public.external_settings (
  id integer NOT NULL DEFAULT 1,
  page_name text,
  og_title text,
  og_description text,
  head_script text,
  meta_pixel_id text,
  google_ads_id text,
  clarity_id text,
  webhook_url text,
  telegram_bot_token text,
  telegram_chat_id text,
  ip_block_list text,
  updated_at timestamp with time zone DEFAULT now(),
  foot_script text,
  kakao_pixel_id text,
  tiktok_pixel_id text,
  daangn_pixel_id text,
  completion_message text,
  redirect_url text,
  prevent_duplicate text DEFAULT 'true'::text,
  CONSTRAINT external_settings_pkey PRIMARY KEY (id)
);

-- 3. 기본 설정 데이터(ID 1) 삽입 (없을 경우에만)
INSERT INTO public.external_settings (id, page_name, completion_message)
VALUES (1, '관리자 페이지', '상담 신청이 완료되었습니다! 담당자가 확인 후 빠르게 연락드리겠습니다.')
ON CONFLICT (id) DO NOTHING;

-- 4. RLS (Row Level Security) 설정
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_settings ENABLE ROW LEVEL SECURITY;

-- 누구나 읽고 쓸 수 있게 정책 추가 (테스트 및 쉬운 운영 목적)
DROP POLICY IF EXISTS "Allow all for leads" ON public.leads;
CREATE POLICY "Allow all for leads" ON public.leads FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for settings" ON public.external_settings;
CREATE POLICY "Allow all for settings" ON public.external_settings FOR ALL USING (true);

-- 5. 유입(방문자 수) 측정을 위한 'page_views' 테이블 생성
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address text,
  visit_date date DEFAULT current_date,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT page_views_pkey PRIMARY KEY (id),
  CONSTRAINT page_views_ip_date_key UNIQUE (ip_address, visit_date)
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for page_views" ON public.page_views;
CREATE POLICY "Allow all for page_views" ON public.page_views FOR ALL USING (true);
