update public.plans set price_cents = 2990, proposals_per_cycle = 10, features = '[]' where code = 'pro';
update public.plans set is_active = true where code in ('pro_plus', 'premium') and price_cents is not null;
