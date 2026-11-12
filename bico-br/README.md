# Bico BR

**Seu próximo bico começa aqui.** Marketplace brasileiro de bicos remotos de tecnologia: projetos, Bico Rápido, vitrine de trabalhos e busca de devs por habilidade.

Stack: Supabase (Auth, PostgreSQL, Storage, Realtime) · Node.js + Express · HTML + Tailwind CSS + JavaScript.

## Estado atual

Projeto iniciado do zero (não havia código anterior). O fluxo principal está escrito de ponta a ponta:
cadastro, projeto, proposta, conversa, contrato, pagamento da taxa de serviço, entrega, aprovação,
saldo, avaliação, plano Pro e administração. As regras do banco e o backend têm testes automatizados;
e o fluxo completo roda pelo navegador em um ambiente local simulado (`npm run test:e2e`).
**Ainda não rodou contra um projeto Supabase real** — esse é o próximo passo (homologação). O que falta está em [docs/05-pendencias-e-decisoes.md](docs/05-pendencias-e-decisoes.md).

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

Funções: `super_admin`, `finance`, `support`, `moderation`, `content`. A área `/admin` exige verificação
em duas etapas; o cadastro do segundo fator é feito no primeiro acesso.

### Testes

```bash
npm test          # backend: validadores, provedores, API, checkout, webhook (40 testes, sem rede)
npm run test:db   # sobe um Postgres descartável, aplica migrations, roda 256 verificações de RLS
                  # e de fluxo, reverte tudo e reaplica (requer binários do PostgreSQL 15+)
npm run test:e2e  # fluxo completo pelo navegador (26 passos, incluindo a varredura de todas as páginas em desktop e celular, com verificação de que nenhuma cor azul aparece) em ambiente local simulado:
                  # Postgres + PostgREST + Auth/ViaCEP/BrasilAPI/Mercado Pago de teste
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
tests/e2e             ambiente local simulado + roteiro de navegador de ponta a ponta
loadtest              roteiro k6 (ainda não executado)
```

## Marca

Identidade definitiva, sem azul: verde profundo `#071B12`, verde-musgo `#1B5E20`, dourado `#D4AF37`,
amarelo `#FFCA05`, preto `#111111`, branco, creme `#F8F7F2` e cinza claro `#F1F2EF`.
Títulos e botões em Montserrat; textos em Inter.

Arquivos vetoriais em `web/assets/marca/`: `logo-horizontal.svg`, `logo-horizontal-negativa.svg` (fundo escuro),
`logo-vertical.svg`, `logo-mono-verde.svg`, `logo-mono-branca.svg`, `simbolo.svg`, `simbolo-negativo.svg`,
`favicon.svg` e `icone-app.svg`. O texto está convertido em curvas (Montserrat, licença SIL OFL), então os
arquivos abrem em qualquer programa sem a fonte instalada. Para regenerar: `python3 scripts/gerar-marca.py`.

Botões: conversão em amarelo com texto preto (`btn-primary`), primário em verde profundo (`btn-dark`),
sucesso em verde-musgo (`btn-success`), secundário branco com borda verde (`btn-ghost`), destaque dourado (`btn-gold`).

## Segurança

Regras obrigatórias em [AGENTS.md](AGENTS.md). Último checklist: [docs/07-relatorio-seguranca.md](docs/07-relatorio-seguranca.md).
Para repetir: `python3 scripts/scan_secrets.py . && npm audit && npm test && npm run test:db && npm run test:e2e`.

### Princípios adotados

- Nenhuma tabela é acessível por padrão: privilégios e políticas RLS são explícitos, tabela a tabela.
- O que é sensível (estado de assinatura, cota de propostas, contrato, pagamento, reputação) só muda por
  funções no banco ou pelo backend — nunca por escrita direta do navegador.
- O Bico BR não guarda dinheiro nem dados de cartão: o Mercado Pago divide o pagamento e paga o profissional direto.
- Pagamento só é considerado aprovado após webhook com assinatura válida **e** consulta do pagamento na API
  do Mercado Pago, com conferência de valor, moeda e referência.
- A service role key e os tokens de terceiros ficam apenas no servidor. `/api/config` devolve só valores públicos.
- Administração exige segundo fator de autenticação, verificado no banco.
- CSP restrita a `'self'` (sem scripts inline, sem CDN de terceiros).
