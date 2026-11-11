# 5. Decisões tomadas e pendências

## Decisões tomadas (com autonomia delegada pela direção)

Critério de desempate em todas: a opção mais segura e de menor risco regulatório. Todas são reversíveis.

| # | Decisão | Por quê | Onde mudar |
|---|---|---|---|
| D1 | A entrada de 10% **é a taxa de serviço da plataforma**, paga pela empresa ao fechar o contrato | Receita simples de explicar e de tributar | `platform_settings.deposit_rate` |
| D2 | O saldo (90%) é pago pela empresa **diretamente ao profissional**. A plataforma registra a declaração de pagamento e a confirmação de recebimento, mas não recebe, não guarda e não repassa esse dinheiro | Guardar e repassar dinheiro de terceiros pode enquadrar a empresa como arranjo de pagamento e exige split no Mercado Pago. Sem custódia não há esse risco | `platform_settings.payment_model` + nova migration |
| D3 | Planos Pro são **pagamento único por 30 dias, sem renovação automática** | Elimina cobrança surpresa por construção: sem nova compra e novo aceite, não há cobrança | função `request_pro` |
| D4 | Preços de lançamento: Pro R$ 29,90 (10 propostas), Pro Plus R$ 59,90 (30), Premium R$ 99,90 (60) | Ponto de partida; devem ser testados | tela de administração → Planos |
| D5 | Propostas ilimitadas até a conclusão e aprovação do primeiro projeto; depois exigem plano | Modelo aprovado | função `submit_proposal` |
| D6 | Teto antiabuso de 50 propostas por dia | Protege empresas de spam; não é limite comercial | `platform_settings.proposal_abuse_daily_limit` |
| D7 | Contratante pessoa física desligado | Depende de política comercial e jurídica | `ALLOW_PF_CONTRACTORS` |
| D8 | Área administrativa **só abre com verificação em duas etapas** | Senha de administrador vazada, sozinha, não dá acesso a dados financeiros nem a decisões | funções `private.is_admin` / `has_admin_role` |
| D9 | Primeiro bico cancelado por decisão de disputa não consome o benefício do primeiro projeto gratuito | Justo com o profissional | função `resolve_dispute` |

**Consequência de D2 que precisa estar clara para a direção:** o profissional entrega antes de receber o saldo.
A proteção é registro + disputa + reputação da empresa, não retenção de valores. É a troca feita para não operar custódia.
Se no futuro a decisão for intermediar 100% do valor, isso exige o modelo de split do Mercado Pago, parecer jurídico e nova migration.

## Segurança: o que foi feito

- Nenhuma tabela acessível por padrão; 101 políticas RLS e privilégios por coluna.
- Funções internas (assinatura, contrato, notificação) não são executáveis pelos papéis de API — testado.
- Estado de assinatura, cota, contrato, pagamento e reputação só mudam por funções transacionais no banco.
- Páginas públicas pré-renderizadas pelo servidor usam o papel anônimo (a RLS decide o que é público) e escapam todo dado do banco — testado com cargas de injeção.
- Pagamento recebido fora do fluxo (contrato cancelado, plano em duplicidade) abre reembolso automático em vez de ficar silencioso.
- Pagamento: valor lido do banco (nunca do navegador); só o pagador inicia; confirmação apenas por webhook com assinatura HMAC + consulta à API do Mercado Pago + conferência de valor e moeda; idempotente; sem regressão de estado.
- Dados cadastrais da empresa vêm da consulta feita pelo servidor; o que o navegador envia nesses campos é descartado.
- Administração exige segundo fator (aal2) no nível do banco, não só na tela.
- Trilha de auditoria somente-inserção para contratos, pagamentos, reembolsos, disputas, planos, configurações e administradores.
- Limites de tamanho em todo campo livre e limites de quantidade/diários por usuário (projetos, vagas, candidaturas, denúncias, portfólio).
- Chat: só entre partes com vínculo real, bloqueio respeitado, 30 mensagens por minuto, remetente não falsificável.
- Frontend: todo dado do banco é escapado antes de entrar no HTML; links de terceiros só `http(s)` e com `rel="noopener noreferrer nofollow"`; redirecionamento pós-login restrito a caminhos internos; CSP `'self'` sem scripts inline.
- Backend: Helmet, limite de corpo de 100 kB, rate limit por IP e por usuário, logs com redação de segredos, erros internos sem detalhes para o cliente.
- Segredos só em variáveis de ambiente; `/api/config` devolve apenas valores públicos — testado.

## Segurança: o que ainda falta antes de abrir ao público

1. **Teste de ponta a ponta e teste de invasão em homologação.** As regras do banco estão testadas (141 verificações); as telas com login ainda não rodaram contra um Supabase real.
2. **CAPTCHA no cadastro e no login** (o Supabase Auth integra Turnstile/hCaptcha) e política de senha forte no painel do Supabase.
3. **Rate limit compartilhado** (Redis) quando houver mais de uma instância do backend.
4. **Verificação de arquivos enviados** (tipo real e antivírus) antes de habilitar upload de portfólio e anexos.
5. **Monitoramento e alertas**: falhas de webhook, `amount_mismatch`, picos de 401/429.
6. **Revisão jurídica** dos termos, da política de privacidade e do contrato.
7. **Auditoria de segurança independente** antes de processar volume relevante. Nenhum sistema deve ser considerado seguro só porque quem o escreveu o testou.

## Não implementado

| Item | Situação |
|---|---|
| E-mails transacionais (Brevo) | Não iniciado; notificações existem só dentro da plataforma |
| Upload de arquivos (avatar, portfólio, anexos do chat, evidências de disputa) | Buckets e políticas escritos, não validados; telas usam apenas texto e links |
| Perfil público da empresa | Banco pronto; sem tela |
| Página individual de vaga; gestão de candidaturas pela empresa | Listagem e candidatura prontas; falta a tela de gestão |
| Reembolso: tela de solicitação e de decisão; execução do estorno no Mercado Pago | Tabela, políticas, auditoria e abertura automática prontas |
| Inteligência competitiva | Primeira rodada em `06-inteligencia-competitiva.md`; falta leitura de amostra de reclamações e as páginas do 99Freelas e do Fiverr |
| Agendamentos | Criados automaticamente se a extensão pg_cron estiver habilitada antes das migrations |
| Páginas de destino por busca | Não iniciado |
| Programa de indicação, cupons, campanhas, planos empresariais | Indicação tem tabelas e regra de qualificação; o resto não foi iniciado |
| Gestão de usuários e de habilidades no painel administrativo | Painel cobre indicadores, planos, disputas, denúncias e categorias |
| Tela de solicitações LGPD do titular | Tabela e políticas prontas |
| Testes de carga | Roteiro pronto, não executado |

## Não verificado

- **Telas com login contra um Supabase real** — inclusive as escritas nesta etapa (contrato, plano, mensagens, perfil, publicar vaga, administração). Verificado apenas: todas carregam sem erro de script, redirecionam para o login quando não há sessão e não têm rolagem horizontal.
- Fluxo de cadastro do segundo fator na tela de administração.
- Tempo real do chat (há consulta periódica como rede de segurança).
- Respostas reais de BrasilAPI, ViaCEP, Mercado Pago e Serpro.
- Migration de Storage.

## Para colocar em homologação

1. Criar o projeto Supabase e aplicar as migrations em ordem.
2. Em Authentication: confirmação de e-mail obrigatória, MFA (TOTP) habilitado, URL do site e redirecionamentos (`/onboarding`, `/entrar`), CAPTCHA.
3. Preencher o `.env` conforme `.env.example`.
4. `npm install && npm run build && npm start`.
5. Criar o primeiro administrador por SQL (ver README) e cadastrar o segundo fator em `/admin`.
6. No Mercado Pago (credenciais de teste): apontar o webhook para `https://<domínio>/api/webhooks/mercadopago` e copiar a assinatura secreta para `MP_WEBHOOK_SECRET`.
7. Roteiro manual: cadastro de empresa → projeto → cadastro de profissional → proposta → conversa → aceite → confirmação → pagamento de teste → entrega → aprovação → saldo → avaliação → compra de plano.
