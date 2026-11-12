drop function if exists public.ad_event(uuid, text);
drop function if exists public.live_ads(text, uuid, integer);
drop table if exists public.ad_requests, public.ad_campaigns cascade;
