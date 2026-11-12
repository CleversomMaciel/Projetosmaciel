-- Bico BR — 0017: modelo comercial definido pela direção
--  * Quem solicita serviço publica projetos e vagas sem limite e sem custo.
--  * Profissional: primeiro projeto gratuito; depois, assinatura única de R$ 25,00 por 30 dias,
--    com propostas e projetos ILIMITADOS no período.
--  * Plataforma: 10% do valor do projeto, cobrados de quem contrata (por cima), reconhecidos como
--    receita somente quando o projeto é concluído e a entrega validada.
update public.plans
   set name = 'Bico BR Pro', price_cents = 2500, proposals_per_cycle = null, is_active = true, sort_order = 10,
       features = '["Propostas ilimitadas", "Projetos ilimitados no período", "Sem comissão sobre o que você recebe"]'
 where code = 'pro';
update public.plans set is_active = false where code in ('pro_plus', 'premium');
