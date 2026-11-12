# 7. Relatório de segurança

Checklist das 20 regras do `AGENTS.md` (Validador de Segurança de App), aplicado em 12/11/2026 sobre a branch
`claude/bico-br-audit-scale-5isyn4`. Este relatório diz que o sistema **passou no checklist**; não diz que é
100% seguro. Nenhum sistema é.

## Relatório de Segurança — Bico BR
Resumo: 14 OK · 6 atenção · 0 críticos → **PODE PUBLICAR EM HOMOLOGAÇÃO**. Para produção, resolver antes os itens 11 e 12 (são configuração, não código) e as pendências não técnicas do fim deste documento.

| # | Regra | Status | Onde | O que fazer |
|---|-------|--------|------|-------------|
| 1 | Esconder API Keys | ✅ OK | `.env.example`, `server/src/config.js` | Todas as chaves em variáveis de ambiente. `/api/config` devolve só URL e chave pública; um teste confere que nenhum segredo aparece |
| 2 | Limpar secrets do Git | ✅ OK | `.gitignore` | Histórico do Git varrido (chaves AWS, OpenAI, Stripe, JWT, Mercado Pago, chaves privadas): nada encontrado. Nenhum `.env`, `.pem` ou `.key` versionado |
| 3 | Só chave pública no cliente | ✅ OK | `web/js/core.js` | Navegador usa só a `anon key`. A `service_role` aparece apenas no backend; o scanner a "encontra" nos SQL porque é o **nome do papel** em `grant ... to service_role`, não a chave |
| 4 | Ativar RLS | ✅ OK | `supabase/migrations/*` | RLS em todas as tabelas; tabelas sensíveis (tokens do Mercado Pago, webhooks, cache) sem nenhum acesso pela API. Teste automático falha se alguma tabela ficar sem RLS |
| 5 | Criptografia de dados | ✅ OK | `server/src/lib/crypto.js` | Tokens do Mercado Pago dos profissionais cifrados com AES-256-GCM (adulteração é detectada). Não guardamos cartão, CPF de profissional, endereço de profissional nem chave Pix (coluna removida). Tráfego só HTTPS |
| 6 | Auth server-side | ✅ OK | RLS + funções no banco | Toda regra de dinheiro, assinatura, contrato e moderação roda no banco. Área administrativa exige segundo fator verificado **no banco**, não só na tela |
| 7 | Restringir acessos | ✅ OK | `admin_members`, políticas RLS | Perfis `super_admin`, `finance`, `support`, `moderation`, `content` com permissões separadas. Testes de IDOR: invasor não abre contrato, conversa, anexo, pagamento ou cobrança de outra pessoa |
| 8 | Bloquear mass assignment | ✅ OK | grants por coluna | O usuário só pode gravar colunas liberadas uma a uma. Preço, taxa, estado da assinatura, nota, suspensão e conexão com o Mercado Pago nunca vêm do navegador; o valor da cobrança é lido do banco |
| 9 | Proteger cookies | 🟡 Atenção | `@supabase/supabase-js` | A sessão fica no `localStorage` do navegador (padrão do Supabase quando o site fala direto com o banco). Mitigações: CSP `script-src 'self'` sem scripts inline e varredura de XSS. Alternativa: sessão em cookie `HttpOnly` com o backend intermediando as chamadas — refatoração grande, avaliar antes de escalar |
| 10 | Hash nas senhas | ✅ OK | Supabase Auth | Senhas tratadas pelo Supabase Auth (bcrypt). O Bico BR nunca vê nem guarda senha |
| 11 | Rate limit | 🟡 Atenção | backend e painel do Supabase | Backend: limites por IP e por usuário (CNPJ, CEP, checkout, conexão Mercado Pago, empresas). Banco: 30 mensagens/min, tetos diários de projetos, denúncias e curtidas. **Falta:** revisar os limites de login, cadastro e recuperação de senha em *Authentication > Rate Limits* no Supabase. Com mais de uma instância do backend, mover os contadores para Redis |
| 12 | Bot protection | 🟡 Atenção | `web/js/core.js` (`mountCaptcha`) | Implementado: Cloudflare Turnstile no cadastro, login e recuperação de senha, validado pelo Supabase Auth; campo-isca invisível. **Falta configurar:** `TURNSTILE_SITE_KEY` e a chave secreta no painel do Supabase. Em produção o servidor avisa se estiver faltando |
| 13 | Queries parametrizadas | ✅ OK | — | Nenhum SQL montado com texto no backend nem no navegador (supabase-js parametriza). O único SQL dinâmico do banco usa `format('%I')` com argumentos fixos das migrations |
| 14 | Validação dos inputs | 🟡 Atenção | `server/src/routes/*`, `CHECK` no banco | Cada campo é validado no backend (CNPJ, CEP, URLs, valores) e o banco tem restrições de tipo, tamanho e formato em todas as colunas de texto. Não usa uma biblioteca de schema (Zod). Recomendado quando as rotas do backend crescerem |
| 15 | Evitar vazamento de conteúdo | ✅ OK | `web/js/*` | O scanner aponta 32 usos de `innerHTML`. Auditei as interpolações uma a uma: todo dado vindo do banco passa por `esc()`, e as 20 sinalizadas vão para `textContent`, `document.title` ou são textos fixos. O teste de navegador injeta `<script>` e `<img onerror>` em títulos, descrições, propostas, chat, entregas, anúncios e denúncias e confirma que nada executa. Erros genéricos para o usuário; logs com segredos redigidos |
| 16 | Restringir uploads | 🟡 Atenção | buckets do Storage, `mensagens.js`, `perfil.js` | Lista branca de tipos, tamanho máximo, nome em UUID, SVG recusado, anexos do chat em bucket privado com link assinado de 5 minutos só para participantes. A checagem do conteúdo real (bytes iniciais) é feita no navegador; o Storage confere o tipo declarado e o tamanho. **Falta:** antivírus nos anexos antes de abrir ao público |
| 17 | Limitar respostas de API | ✅ OK | `web/js/*` | Colunas explícitas em todas as consultas (o último `select('*')` foi removido nesta revisão); paginação com limite em todas as listas |
| 18 | Security headers | ✅ OK | `server/src/app.js` | CSP restrita a `'self'` (`frame-ancestors 'none'`, `object-src 'none'`), HSTS de 2 anos com preload, `nosniff`, `Referrer-Policy`, `Permissions-Policy` desligando câmera, microfone, localização e pagamento do navegador. Sem CORS liberado |
| 19 | Forçar HTTPS | ✅ OK | `server/src/app.js` | Em produção, toda requisição HTTP é redirecionada para HTTPS (308). Webhooks e links de anúncio só `https://`. Exige `TRUST_PROXY=1` atrás do proxy da hospedagem |
| 20 | Scan de dependências | ✅ OK | `package-lock.json`, `.github/dependabot.yml` | `npm audit`: 0 vulnerabilidades. Lockfile versionado. Dependabot semanal configurado |

### Correções aplicadas nesta revisão

1. **Último `select('*')` removido** da tela de contrato (regra 17).
2. **HTTPS forçado** em produção e **HSTS com preload** (regras 18 e 19).
3. **`Permissions-Policy`** desligando recursos do navegador que o site não usa (regra 18).
4. **CAPTCHA (Turnstile) + campo-isca** no cadastro, login e recuperação de senha (regra 12). A CSP só libera o domínio do CAPTCHA quando ele está configurado.
5. **Webhook do Mercado Pago:** o id do pagamento precisa ser numérico, antes de qualquer consulta. Um id forjado com assinatura válida é recusado (teste incluso).
6. **Coluna `pix_key` removida** do banco: deixou de ser necessária e era dado sensível (regra 5).
7. **`.gitignore`** cobrindo `*.pem`, `*.key`, credenciais e dumps (regra 2).
8. **Dependabot** semanal (regra 20).

## Mercado Pago: o que protege o dinheiro

| Ameaça | Proteção | Testado |
|---|---|---|
| Alguém forjar "pagamento aprovado" | O webhook só é aceito com assinatura HMAC válida (comparação em tempo constante). Mesmo assim, o corpo é ignorado: o pagamento é consultado na API do Mercado Pago | Sim |
| Pagar menos que o combinado | Valor e moeda do Mercado Pago são conferidos com o valor guardado no banco; divergência não aprova nada | Sim |
| Usar um pagamento real para liberar outro registro | A referência devolvida pelo Mercado Pago precisa bater com o registro; o mesmo pagamento não é associado a dois registros | Sim |
| Reenvio do mesmo aviso (replay) | Cada evento é registrado uma vez; repetições não reprocessam | Sim |
| Navegador mudar o valor ou a taxa da cobrança | Valor e taxa vêm do banco; o que o navegador envia é descartado | Sim |
| Iniciar cobrança de outra pessoa | Só o pagador da cobrança consegue abrir o checkout; para os outros, ela "não existe" | Sim |
| Roubo do token da conta do profissional | Token cifrado (AES-256-GCM) em tabela sem acesso pela API; chave de cifra só na variável de ambiente | Sim |
| Conectar a conta Mercado Pago de outra pessoa | O retorno do Mercado Pago só vale com um `state` assinado, com validade de 15 minutos, ligado ao usuário que iniciou | Sim |
| Vazamento do Access Token da plataforma | Só no servidor; nunca no navegador, nos logs nem no repositório | Sim |
| Funcionário mal-intencionado | Ações financeiras exigem segundo fator e ficam numa trilha de auditoria que não pode ser alterada nem apagada | Sim |

**Dados de cartão.** O pagamento acontece na página do próprio Mercado Pago (Checkout Pro). Número, validade e
código do cartão nunca passam pelo Bico BR, e um teste confirma que nenhuma tabela tem coluna desse tipo. A guarda
desses dados é do Mercado Pago, que é certificado para isso (PCI DSS).

**Para onde vai o dinheiro.** A parte do profissional vai direto da empresa para a conta Mercado Pago dele.
Na conta do Bico BR cai só a taxa de serviço de 10% e as assinaturas. O Mercado Pago separa a taxa no momento do
pagamento (é assim que a divisão funciona), mas o Bico BR só conta a taxa como **receita depois da entrega
validada**. Enquanto o projeto está em andamento, ela aparece no painel como "taxa a reconhecer", porque volta para
quem pagou se o projeto for cancelado.

## O que ainda depende de configuração ou de terceiros

1. Turnstile: criar o site na Cloudflare, pôr `TURNSTILE_SITE_KEY` no servidor e a chave secreta no Supabase.
2. Supabase Auth: confirmação de e-mail obrigatória, limites de login/cadastro, MFA (TOTP) habilitado, proteção contra senhas vazadas.
3. Hospedagem: `TRUST_PROXY=1`, `PUBLIC_URL` com `https://`, `MP_TOKEN_ENCRYPTION_KEY` gerada com `openssl rand -hex 32` e guardada no cofre de segredos da hospedagem.
4. Backups: ativar PITR no Supabase e testar uma restauração.
5. Antivírus nos anexos do chat.
6. Teste de invasão feito por terceiros antes de volume relevante de dinheiro.

## Responsabilidade jurídica

Os Termos de Uso dizem que o pagamento é processado pelo Mercado Pago e que o Bico BR não guarda dados de
cartão. Isso não afasta todas as responsabilidades: pelo Código de Defesa do Consumidor, quem participa da
cadeia de fornecimento pode responder junto. A redação final precisa de revisão de advogado(a).

## Como repetir esta revisão

```bash
python3 scripts/scan_secrets.py .   # varredura de segredos e padrões arriscados
npm audit                           # dependências
npm test && npm run test:db && npm run test:e2e
```

Falsos positivos esperados do scanner: `service_role` nos arquivos SQL (nome do papel), "senha fixa" em
`server/test/` (valores falsos), `innerHTML` em `web/js/` (auditado: dados escapados por `esc()`),
"HTTP sem TLS" em `companies.js` e `seo.js` (texto de validação e namespace XML).
