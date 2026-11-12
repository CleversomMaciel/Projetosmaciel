# 8. Guia de conexão: Supabase e Mercado Pago

Roteiro para sair da simulação e rodar com serviços reais. Faça primeiro em **homologação** (projeto Supabase
separado e credenciais de **teste** do Mercado Pago). Só depois repita em produção.

> O código e as regras foram validados na simulação (Postgres + PostgREST + serviços de teste). Supabase real e
> Mercado Pago real ainda não foram testados — os passos 5 e 6 abaixo são essa validação.

## 1. Supabase

1. Crie o projeto em supabase.com (região São Paulo, `sa-east-1`).
2. **Database > Extensions:** habilite `pg_cron` **antes** das migrations (vence assinaturas de hora em hora e
   limpa o cache diariamente). Sem ela, a migration avisa e você precisa agendar `public.expire_subscriptions()`
   e `public.purge_expired_cache()` por fora.
3. **Aplique as migrations em ordem** (`supabase/migrations/`, 20 arquivos):
   ```bash
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
   Alternativa: colar cada arquivo, na ordem do nome, no SQL Editor. Elas criam tabelas, RLS, funções, buckets de
   Storage e ligam o tempo real do chat. Reversões ficam em `supabase/rollback/`.
4. **Authentication > Providers > Email:** confirmação de e-mail **ligada**.
5. **Authentication > URL Configuration:** Site URL = seu domínio (`https://...`). Redirect URLs:
   `https://<domínio>/onboarding` e `https://<domínio>/entrar`.
6. **Authentication > Multi-Factor:** TOTP habilitado (obrigatório para a área `/admin`).
7. **Authentication > Rate Limits:** revise os limites de login, cadastro e recuperação de senha.
8. **Authentication > Password:** ative a proteção contra senhas vazadas, se o plano permitir.
9. **Project Settings > API:** copie para o `.env` do servidor:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (pública, pode ir ao navegador)
   - `SUPABASE_SERVICE_ROLE_KEY` (**só no servidor**; nunca no navegador, no Git ou em chat)
10. **Backups:** no plano pago, ative PITR e teste uma restauração antes de ter dinheiro circulando.

## 2. Mercado Pago

1. Em **Suas integrações**, crie a aplicação (Checkout Pro, modelo marketplace).
2. Copie as **credenciais de teste** para o `.env`:
   - `MP_ACCESS_TOKEN`
   - `MP_CLIENT_ID` e `MP_CLIENT_SECRET` (mesma aplicação; usados para o profissional conectar a conta dele e
     receber direto — o Bico BR não segura o dinheiro do projeto)
3. **URL de redirecionamento** da aplicação: `https://<domínio>/api/mp/callback`
4. **Webhooks:** URL `https://<domínio>/api/webhooks/mercadopago`, evento **Pagamentos**. Copie a
   "assinatura secreta" para `MP_WEBHOOK_SECRET`. Sem ela, todo aviso é recusado (de propósito).
5. Gere a chave que cifra os tokens dos profissionais e guarde-a no cofre da hospedagem:
   ```bash
   openssl rand -hex 32   # -> MP_TOKEN_ENCRYPTION_KEY
   ```
   Trocar essa chave depois obriga todos os profissionais a reconectar a conta.
6. Teste com os **usuários e cartões de teste** do Mercado Pago. Nenhum pagamento real durante a homologação.
7. Para produção: troque pelas credenciais de produção e conclua a homologação da aplicação no Mercado Pago.

## 3. Servidor (hospedagem)

Variáveis obrigatórias além das acima (modelo completo em `.env.example`):

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PUBLIC_URL` | `https://<domínio>` sem barra no final |
| `TRUST_PROXY` | `1` atrás do proxy/balanceador da hospedagem |
| `TURNSTILE_SITE_KEY` | chave pública do Cloudflare Turnstile (a secreta vai no Supabase: Authentication > Bot and Abuse Protection) |

```bash
npm ci
npm run build
npm start          # Node 20 ou superior
```

Use o gerenciador de segredos da hospedagem. Não suba o arquivo `.env`.

## 4. Primeiro administrador

Crie sua conta pelo site, pegue o `id` em Authentication > Users e rode no SQL Editor:

```sql
insert into public.admin_members (user_id, role) values ('<uuid>', 'super_admin');
```

No primeiro acesso a `/admin` o sistema pede o cadastro do segundo fator.

## 5. Roteiro de validação (homologação)

Marque cada item só depois de ver funcionando:

- [ ] Cadastro de empresa (CNPJ preenche os dados) e e-mail de confirmação chega
- [ ] Recuperação de senha
- [ ] Empresa publica projeto
- [ ] Cadastro de profissional com cupom `LANCAMENTO15`
- [ ] Profissional conecta a conta Mercado Pago
- [ ] Proposta → conversa em tempo real (com anexo) → aceite do contrato
- [ ] Pagamento de teste (cartão e Pix): o webhook aprova e o painel atualiza
- [ ] Entrega dentro do app → aprovação → avaliação; a taxa sai de "a reconhecer" para receita
- [ ] Assinatura de R$ 25 paga e vencimento visível; depois de vencida, bloqueia novas propostas
- [ ] Tentar mandar WhatsApp/telefone no chat: bloqueado
- [ ] `/admin` com segundo fator: indicadores e denúncias

## 6. Antes de abrir ao público

1. Revisão dos Termos de Uso e da Política de Privacidade por advogado(a).
2. Antivírus nos anexos do chat.
3. Teste de invasão por terceiros antes de volume relevante de dinheiro.
4. Repetir o checklist de segurança (`docs/07-relatorio-seguranca.md`) com os serviços reais.
