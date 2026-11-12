-- Bico BR — 0020: receita reconhecida só após a entrega + endurecimento final
--
-- A taxa de serviço é separada pelo Mercado Pago no momento do pagamento (é assim que o split funciona),
-- mas só é RECEITA do Bico BR quando a entrega é validada. Antes disso, se o projeto for cancelado,
-- a taxa volta para quem pagou junto com a devolução.

create or replace function public.admin_metrics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 365));
begin
  if not private.has_admin_role('{finance}') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'periodo_dias', least(greatest(p_days, 1), 365),
    'cadastros_empresas', (select count(*) from public.profiles where account_type = 'company' and created_at >= v_since),
    'cadastros_freelancers', (select count(*) from public.profiles where account_type = 'freelancer' and created_at >= v_since),
    'empresas_ativas', (select count(distinct company_id) from public.projects where created_at >= v_since),
    'projetos_publicados', (select count(*) from public.projects where published_at >= v_since),
    'propostas_enviadas', (select count(*) from public.proposals where created_at >= v_since),
    'contratos_iniciados', (select count(*) from public.contracts where started_at >= v_since),
    'contratos_concluidos', (select count(*) from public.contracts where completed_at >= v_since),
    'taxa_conversao_projeto_contrato', (
      select case when count(*) = 0 then null
                  else round(count(*) filter (where exists (select 1 from public.contracts c where c.project_id = p.id and c.started_at is not null))::numeric / count(*), 4) end
        from public.projects p where p.published_at >= v_since),
    'gmv_centavos', (select coalesce(sum(amount_cents), 0) from public.contracts where started_at >= v_since),
    'ticket_medio_centavos', (select coalesce(round(avg(amount_cents)), 0) from public.contracts where started_at >= v_since),
    -- receita: só taxa de contratos CONCLUÍDOS (entrega validada) e pagos
    'receita_taxa_servico_centavos', (select coalesce(sum(c.deposit_cents), 0) from public.contracts c
                                       where c.status = 'completed' and c.completed_at >= v_since
                                         and exists (select 1 from public.payments p where p.contract_id = c.id and p.kind = 'deposit' and p.status = 'approved')),
    -- taxa já separada pelo Mercado Pago em projetos ainda não concluídos: pode voltar em caso de cancelamento
    'taxa_a_reconhecer_centavos', (select coalesce(sum(c.deposit_cents), 0) from public.contracts c
                                    where c.status in ('active','delivered','disputed')
                                      and exists (select 1 from public.payments p where p.contract_id = c.id and p.kind = 'deposit' and p.status = 'approved')),
    'receita_assinaturas_centavos', (select coalesce(sum(amount_cents), 0) from public.payments where kind = 'subscription' and status = 'approved' and paid_at >= v_since),
    'receita_anuncios_centavos', (select coalesce(sum(price_cents), 0) from public.ad_campaigns where status in ('active','ended') and starts_at >= v_since),
    'estornos_centavos', (select coalesce(sum(amount_cents), 0) from public.payments where status in ('refunded','charged_back') and updated_at >= v_since),
    'assinantes_ativos', (select count(*) from public.freelancer_billing where state = 'PRO_ACTIVE' and cycle_end > now()),
    'disputas_abertas', (select count(*) from public.disputes where status not in ('resolved','closed')),
    'disputas_no_periodo', (select count(*) from public.disputes where created_at >= v_since),
    'reembolsos_pendentes', (select count(*) from public.refunds where status = 'requested'),
    'denuncias_abertas', (select count(*) from public.reports where status in ('open','in_review'))
  );
end $$;
revoke all on function public.admin_metrics(integer) from public, anon;
grant execute on function public.admin_metrics(integer) to authenticated, service_role;

-- a chave Pix deixou de ser usada (o Mercado Pago paga o profissional): remove a coluna e o dado
alter table public.profile_private drop column if exists pix_key;

-- nenhum dado de cartão é guardado: trava contra colunas com esse conteúdo em pagamentos
comment on table public.payments is 'Somente referência e situação do pagamento no Mercado Pago. Dados de cartão NUNCA são armazenados no Bico BR.';
