# AGENTS.md — Regras de segurança obrigatórias

Este projeto segue o Validador de Segurança de App. Aplique estas regras em TODO código que escrever ou alterar, e rode o checklist completo antes de qualquer deploy.


Você é responsável por garantir que todo código gerado ou revisado siga as 20 regras abaixo. Elas valem **durante a criação** (escreva o código já seguro) e **na revisão final** (rode o checklist e entregue o relatório).

## Como agir

1. **Ao escrever código novo**: aplique as regras automaticamente, sem esperar o usuário pedir. Nunca gere código que viole uma regra "para simplificar" — se precisar de um atalho temporário, marque com `// TODO SEGURANÇA:` e avise.
2. **Ao revisar um projeto existente**: percorra as 20 regras, rode `python scripts/scan_secrets.py .` (copie o script para a pasta scripts/ do projeto) se houver acesso ao terminal, e entregue o relatório no formato da seção "Relatório".
3. **Antes de qualquer deploy/publicação**: o checklist completo é obrigatório. Se houver item 🔴 Crítico, recomende NÃO publicar até corrigir.
4. Para detalhes por tecnologia, leia o arquivo correspondente:
   - Supabase / Postgres → `references/supabase.md`
   - Node.js / Express / Next.js / APIs → `references/node-api.md`
   - Frontend (React, HTML, mobile) → `references/frontend.md`

## As 20 regras

### Segredos e dados
1. **Esconder API Keys** — Nenhuma chave, token, senha ou string de conexão no código. Tudo em variáveis de ambiente (`.env`), lido só no servidor. Frontend nunca recebe chave secreta. Criar `.env.example` sem valores reais.
2. **Limpar secrets do Git** — `.env`, `*.pem`, `*.key`, credenciais e dumps no `.gitignore`. Se um segredo já foi commitado: considerar vazado → **revogar e gerar novo** (apagar o commit não basta) e limpar o histórico (git filter-repo / BFG).
3. **Usar apenas Public Key no cliente** — No frontend/app só a chave pública/anon (ex.: Supabase `anon key`). A `service_role` / chave admin fica exclusivamente no backend.
4. **Ativar RLS** — Row Level Security habilitado em TODAS as tabelas expostas, com políticas por usuário/empresa (multi-tenant: filtrar sempre por `empresa_id`/`tenant_id`). Tabela sem política = bloqueada, nunca aberta.
5. **Criptografia de dados** — Dados sensíveis (CPF, documentos, tokens de terceiros) criptografados em repouso quando possível; tráfego sempre TLS. Backups também protegidos.

### Autenticação e acesso
6. **Auth server-side** — Toda verificação de login/permissão acontece no servidor (ou RLS). Esconder botão no frontend NÃO é segurança. Validar o token/sessão em cada requisição.
7. **Restringir acessos** — Princípio do menor privilégio: perfis (admin, escritório, pátio, cliente…) com permissões explícitas. Checar se o usuário é dono do recurso (evitar IDOR: `/os/123` não pode abrir a O.S. de outra empresa).
8. **Bloquear Mass Assignment** — Nunca salvar `req.body` inteiro no banco. Usar lista branca de campos permitidos (campos como `role`, `is_admin`, `empresa_id`, `preco`, `status_pagamento` nunca vêm do cliente).
9. **Proteger cookies** — Cookies de sessão com `HttpOnly`, `Secure`, `SameSite=Lax` ou `Strict`. Não guardar token sensível em `localStorage` quando houver alternativa. Proteção CSRF em formulários com cookie.
10. **Hash nas senhas** — Senhas só com bcrypt/argon2 (nunca MD5/SHA puro, nunca texto puro, nunca reversível). Preferir o Auth pronto do provedor (Supabase Auth etc.).

### Abuso e entrada de dados
11. **Rate limit** — Limite de requisições por IP/usuário em login, cadastro, recuperação de senha, envio de mensagens/WhatsApp/e-mail e endpoints caros.
12. **Bot protection** — CAPTCHA (Turnstile/hCaptcha/reCAPTCHA) ou honeypot em formulários públicos (contato, cadastro, orçamento online).
13. **Queries parametrizadas** — Nada de concatenar texto em SQL. Usar ORM/query builder ou parâmetros (`$1`, `?`). Vale também para filtros dinâmicos e ordenação (lista branca de colunas).
14. **Validação dos inputs** — Validar tudo no servidor com schema (Zod, Joi, Yup, class-validator): tipo, tamanho, formato (CPF, placa, e-mail, telefone), faixa de valores. Validação do frontend é só conforto.
15. **Evitar vazamento de conteúdo** — Escapar saída (prevenir XSS), nunca usar `innerHTML`/`dangerouslySetInnerHTML` com dado do usuário sem sanitizar (DOMPurify). Mensagens de erro genéricas para o usuário; stack trace só em log. Sem `console.log` de dados sensíveis em produção.
16. **Restringir uploads** — Lista branca de tipos (checar MIME real, não só extensão), tamanho máximo, renomear arquivo (UUID), guardar fora da pasta pública ou em bucket privado com URL assinada, nunca executar arquivo enviado.
17. **Limitar respostas de API** — Retornar só os campos necessários (nunca `SELECT *` direto pro cliente, nunca hash de senha/tokens). Paginação obrigatória com limite máximo (ex.: 100 por página).

### Infraestrutura
18. **Security headers** — `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. CORS só para domínios conhecidos (nunca `*` com credenciais).
19. **Forçar HTTPS** — Redirecionar HTTP→HTTPS, HSTS ativo, nenhum recurso misto. Links e webhooks sempre `https://`.
20. **Scan de dependências** — Rodar `npm audit` / `pnpm audit` / `pip-audit`, manter lockfile commitado, remover pacotes não usados, fixar versões e evitar pacotes recém-publicados ou desconhecidos. Ativar Dependabot/Renovate se o repositório permitir.

## Relatório (formato obrigatório na revisão)

```
## Relatório de Segurança — [nome do app]
Resumo: X OK · Y atenção · Z críticos → [PODE PUBLICAR / NÃO PUBLICAR AINDA]

| # | Regra | Status | Onde | O que fazer |
|---|-------|--------|------|-------------|
| 1 | Esconder API Keys | 🔴 Crítico | src/api.js:12 | Mover para .env e revogar a chave |
| 4 | Ativar RLS | ✅ OK | — | — |
| 11 | Rate limit | 🟡 Atenção | /login | Adicionar express-rate-limit |
...(todas as 20)

### Correções prioritárias
1. [crítico mais grave com o código corrigido]
2. ...
```

Status possíveis: ✅ OK · 🟡 Atenção · 🔴 Crítico · ⚪ Não se aplica (explique por quê).

Depois do relatório, ofereça aplicar as correções. Ao corrigir, mostre o antes/depois e rode o checklist de novo nos itens alterados.

## Regras de ouro
- Na dúvida entre "rápido" e "seguro", escolha seguro e explique em uma linha.
- Nunca diga que o app está "100% seguro" — diga que passou no checklist.
- Nunca imprima o valor de um segredo encontrado; mostre só o arquivo/linha e os 4 primeiros caracteres.
