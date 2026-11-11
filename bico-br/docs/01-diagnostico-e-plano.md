# 1. Diagnóstico e plano

## Diagnóstico

**Não havia projeto a auditar.** O repositório continha apenas arquivos de outros projetos; nenhum
código, banco ou configuração do Bico BR existia. Por decisão do responsável, o Bico BR foi iniciado do zero.
Consequência prática: não há dado nem funcionalidade a preservar, e nenhuma mudança destrutiva foi feita.

## Arquitetura adotada

Monólito simples, em três partes, sem microserviços:

| Camada | Responsabilidade |
|---|---|
| **Supabase / PostgreSQL** | Fonte da verdade. Esquema, RLS e as regras que não podem ser burladas (cota de propostas, máquina de estados da assinatura, contrato, confirmação de pagamento) vivem em funções transacionais. |
| **Backend Express** | Só o que exige segredo ou terceiro: consulta de CNPJ/CEP, criação de empresa com dados validados no servidor, webhook do Mercado Pago, sitemap/robots. |
| **Frontend estático** | HTML + Tailwind + JS. Lê e escreve no Supabase com a chave pública, sempre sob RLS. |

Motivo: o navegador falando direto com o Supabase reduz custo e latência; o backend fica pequeno e
fácil de escalar horizontalmente; e as regras de dinheiro ficam em um único lugar, testável.

## O que foi construído e verificado nesta entrega

| Área | Entregue | Como foi verificado |
|---|---|---|
| Banco | 13 migrations, 48 tabelas, 101 políticas RLS, reversão de cada migration | Aplicadas, revertidas e reaplicadas em Postgres 16 local |
| RLS e privilégios | Políticas em todas as tabelas; grants por coluna | 141 verificações automatizadas (escalada de privilégio, isolamento entre usuários, anônimo) |
| Primeiro Bico Gratuito / Pro | 7 estados, cota por ciclo, consentimento expresso com registro do preço exibido | Testado no banco de ponta a ponta |
| Contrato | aceite → confirmação → entrada → execução → entrega → aprovação → avaliação; cancelamento; disputa com protocolo | Testado no banco |
| Pagamento | Webhook com assinatura HMAC, idempotência, conferência de valor, sem regressão de estado | 5 testes de API + testes no banco |
| CNPJ | Camada de provedores com cache em 2 níveis, timeout, retry, disjuntor, fallback; CNPJ alfanumérico | Testes com respostas simuladas |
| CEP | ViaCEP → BrasilAPI; nunca bloqueia o cadastro | Testes com respostas simuladas |
| Categorias | 11 categorias e 96 subcategorias iniciais, administráveis por dados | Conferido nos testes de banco |
| Vagas remotas | Tabela separada dos projetos; banco recusa vaga não remota | Testado no banco |
| Chat | Conversa só com vínculo (proposta/convite), bloqueio, limite antispam, índice para paginação | Testado no banco |
| Portfólio | Selo "feito no Bico BR" só com contrato concluído do próprio profissional | Testado no banco |
| Auditoria | Trilha somente-inserção para contratos, pagamentos, reembolsos, disputas, planos, admins | Testado no banco |
| SEO | robots.txt, sitemap, canonical, Open Graph, JSON-LD, noindex nas áreas privadas; projeto, perfil e categoria pré-renderizados no servidor | Testes de API (incluindo injeção de HTML) + navegador |
| Frontend | 18 páginas: início, cadastro, login, onboarding (CNPJ/CEP), projetos, proposta, publicar projeto e vaga, vagas, painel, contrato, plano Pro, mensagens, perfil e portfólio, perfil público, administração, Central de Confiança | Teste de fumaça em navegador (desktop e celular): carregam sem erro e protegem as áreas privadas. **Fluxos com login não testados** |
| Checkout | Cobrança criada no banco; preferência do Mercado Pago criada pelo backend | Testes de API com Mercado Pago simulado |
| Administração | Indicadores (GMV separado de receita), planos, disputas, denúncias, categorias; MFA obrigatório | Regras testadas no banco; tela não testada com login |

**Limites da verificação** — leia antes de considerar qualquer item pronto para produção:

- Nada rodou contra um projeto Supabase real. Os fluxos de tela que dependem de login **não** foram exercitados de ponta a ponta.
- As APIs externas (BrasilAPI, ViaCEP, Mercado Pago, Serpro) estavam bloqueadas no ambiente de desenvolvimento: os testes usam respostas simuladas com base na documentação. O provedor Serpro, em particular, nunca recebeu uma resposta real.
- A migration de Storage não pôde ser executada localmente.
- Nenhum teste de carga foi executado.

## Plano em seis fases

Responsáveis são papéis; hoje quem acumula cada um precisa ser definido.

### Fase 1 — Fundação e estabilização
- **Entregáveis:** projeto Supabase de homologação; migrations aplicadas; variáveis configuradas; fluxos de tela validados com contas reais de teste; APIs externas validadas ao vivo; backup/PITR ligado.
- **Depende de:** conta Supabase, domínio, hospedagem do backend.
- **Responsável:** engenharia.
- **Concluída quando:** `npm test` e `npm run test:db` passam; roteiro manual cadastro → projeto → proposta → contrato executado em homologação; migration de Storage validada.

### Fase 2 — Produto completo
- **Entregáveis:** perfil público do profissional e da empresa; portfólio com upload; publicação de vagas; página individual de vaga; chat em tela (Realtime + paginação); notificações; busca por habilidades; painel administrativo (categorias, usuários, denúncias).
- **Depende de:** Fase 1.
- **Responsável:** engenharia + produto.
- **Concluída quando:** uma empresa e um profissional conseguem ir do cadastro à avaliação sem intervenção manual, no celular.

### Fase 3 — Monetização e confiança
- **Entregáveis:** checkout da entrada e da assinatura no Mercado Pago; tela de oferta do Pro; conciliação financeira; fluxo de reembolso; telas de disputa; termos e contrato revisados por advogado; e-mails transacionais (Brevo).
- **Depende de:** decisões 1 a 4 de `05-pendencias-e-decisoes.md`; conta Mercado Pago; parecer jurídico.
- **Responsável:** engenharia + financeiro + jurídico.
- **Concluída quando:** um pagamento de teste percorre webhook → contrato ativo → conciliação; termos publicados com revisão registrada.

### Fase 4 — Aquisição e SEO
- **Entregáveis:** páginas públicas renderizadas no servidor (projeto, vaga, profissional, categoria); páginas de destino com conteúdo próprio; programa de indicação; métricas de funil; prospecção B2B.
- **Depende de:** Fase 2; domínio definitivo.
- **Responsável:** crescimento + engenharia.
- **Concluída quando:** páginas indexadas no Search Console; funil medido do clique ao contrato.

### Fase 5 — Escala
- **Entregáveis:** testes de carga (100/500/1.000/5.000 simultâneos) em homologação; correção dos gargalos medidos; monitoramento e alertas; fila para e-mails e tarefas agendadas; rate limit compartilhado.
- **Depende de:** Fases 2 e 3 em homologação.
- **Responsável:** engenharia.
- **Concluída quando:** relatório de carga com p95 e taxa de erro por patamar, e plano de capacidade baseado nele.

### Fase 6 — Crescimento acelerado
- **Entregáveis:** planos empresariais; parcerias; otimização de preço e comissão com dados reais; revisão do modelo financeiro com números observados.
- **Depende de:** três meses de operação com dados.
- **Responsável:** direção + crescimento + financeiro.
- **Concluída quando:** CAC, conversão, ticket e retenção reais substituem as hipóteses do modelo.
