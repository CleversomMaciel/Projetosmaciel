# Bico BR

**Seu próximo bico começa aqui.** Marketplace brasileiro de trabalho remoto: projetos freelance, Bico Rápido e vagas remotas.

Stack: Supabase (Auth, PostgreSQL, Storage, Realtime) · Node.js + Express · HTML + Tailwind CSS + JavaScript.

## Estado atual

Projeto iniciado do zero (não havia código anterior). Esta primeira entrega cobre a fundação:
banco com RLS, regras de negócio no servidor, integrações de CNPJ/CEP, webhook de pagamento e o
fluxo principal no frontend. O que falta está em [docs/05-pendencias-e-decisoes.md](docs/05-pendencias-e-decisoes.md).

## Rodando

```bash
cp .env.example .env        # preencha SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run build               # compila o CSS (Tailwind)
npm start                   # http://localhost:3000
```

Sem as variáveis do Supabase o servidor sobe em modo limitado (páginas estáticas).

### Banco

As migrations ficam em `supabase/migrations/` e são aplicadas em ordem (`supabase db push` ou SQL Editor).
Reversões em `supabase/rollback/` — leia o README de lá antes de usar.

Para criar o primeiro administrador (não existe caminho pelo aplicativo, de propósito):

```sql
insert into public.admin_members (user_id, role) values ('<uuid do usuário>', 'super_admin');
```

### Testes

```bash
npm test          # backend: validadores, provedores, API, webhook (30 testes, sem rede)
npm run test:db   # sobe um Postgres descartável, aplica migrations, roda 97 verificações de RLS
                  # e de fluxo, reverte tudo e reaplica (requer binários do PostgreSQL 15+)
npm run model     # recalcula o modelo financeiro
```

## Estrutura

```
supabase/migrations   esquema, regras de negócio (RPCs), RLS, storage, dados iniciais
supabase/rollback     reversão de cada migration
supabase/tests        simulação mínima do Supabase + testes de RLS e fluxos
server/src            Express: provedores CNPJ/CEP, empresas, webhook Mercado Pago, SEO
server/test           testes do backend
web                   páginas e scripts do frontend
docs                  diagnóstico, plano, provedores, modelo financeiro, escala, pendências
loadtest              roteiro k6 (ainda não executado)
```

## Princípios de segurança adotados

- Nenhuma tabela é acessível por padrão: privilégios e políticas RLS são explícitos, tabela a tabela.
- O que é sensível (estado de assinatura, cota de propostas, contrato, pagamento, reputação) só muda por
  funções no banco ou pelo backend — nunca por escrita direta do navegador.
- Pagamento só é considerado aprovado após webhook com assinatura válida **e** consulta do pagamento na API
  do Mercado Pago, com conferência de valor.
- A service role key e os tokens de terceiros ficam apenas no servidor. `/api/config` devolve só valores públicos.
- CSP restrita a `'self'` (sem scripts inline, sem CDN de terceiros).
