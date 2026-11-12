# 5. Decisões tomadas e pendências

## Decisões tomadas (com autonomia delegada pela direção)

Critério de desempate em todas: a opção mais segura e de menor risco regulatório. Todas são reversíveis.

| # | Decisão | Por quê | Onde mudar |
|---|---|---|---|
| D1 | Taxa de serviço de **10% cobrada de quem contrata, por cima** do valor do profissional. O profissional recebe 100% do que propôs. A taxa só é receita em projeto concluído | Definido pela direção. Cobrar assinatura e ainda descontar comissão do profissional é a principal queixa contra concorrentes | `platform_settings.deposit_rate` |
| D2 | **O Bico BR não guarda dinheiro.** A empresa paga pelo Mercado Pago (cartão, Pix); o Mercado Pago divide o pagamento: a parte do profissional vai direto para a conta Mercado Pago dele e a taxa de 10% vai para o Bico BR. O profissional conecta a conta por autorização (OAuth) e o token fica cifrado | Definido pela direção. Elimina o risco regulatório de custódia. Consequência: a proteção do profissional contra calote é o pagamento antecipado; a da empresa é a reclamação com devolução pelo Mercado Pago | migration 0019, `server/src/routes/mp.js` |
| D3 | Assinatura do profissional é **pagamento único por 30 dias, sem renovação automática** | Elimina cobrança surpresa por construção | função `request_pro` |
| D4 | **Plano único: R$ 25,00 por 30 dias, com propostas e projetos ilimitados.** Primeiro projeto continua gratuito | Definido pela direção. Manter o primeiro bico grátis é o que traz profissionais antes de a plataforma ter volume | tela de administração → Planos |
| D11 | Quem solicita serviço publica projetos e vagas **sem limite e sem custo** (há só um teto antiabuso de 30 por dia) | Definido pela direção: demanda é o que atrai profissionais | gatilho `projects_cap` |
| D12 | Entrega **obrigatoriamente dentro da plataforma, item a item**; a empresa valida ou pede ajuste por item; sem resposta em 7 dias, validação automática | É o registro que libera o crédito e que vale em reclamação. O prazo protege o profissional de empresa que some | `platform_settings.auto_approve_days` |
| D14 | **Proibido divulgar telefone, e-mail, redes sociais ou aplicativos de mensagem**, e linguagem ofensiva, em qualquer campo. Texto público é recusado na gravação; no chat a mensagem não é entregue. Três ocorrências em 24 h ou cinco em 30 dias suspendem a conta por 7 dias; a moderação revisa e pode retirar | Definido pela direção: protege a taxa de serviço e o ambiente. O filtro é por padrões — pode errar e pode ser driblado, por isso há revisão humana | migration 0018; tela de administração → Conduta |
| D15 | **Arquivos do projeto circulam pelo chat** (imagens, PDF, planilhas, documentos, até 20 MB), guardados em área privada e baixados por link temporário só por quem participa da conversa | Definido pela direção | bucket `chat-attachments` |
| D16 | **Cadastro do profissional só com e-mail, nome, título e habilidades.** Endereço e CPF não são pedidos. Chave Pix é opcional e só para receber. Empresa informa CNPJ (dado de negócio) | Definido pela direção: menos dado sensível, menos risco | tela de cadastro |
| D17 | Perfil estilo rede profissional: publicações com imagem, curtidas, avaliações, **tempo de resposta medido no chat**, e botão “Solicitar serviço” que convida para um projeto e abre a conversa | Definido pela direção | páginas `/vitrine` e `/profissional` |
| D18 | **Sem vagas de emprego (CLT, estágio etc.). Só bicos remotos de tecnologia.** Páginas de vagas removidas e endereços antigos redirecionados; o banco recusa novas vagas | Definido pela direção | migration 0019 |
| D19 | **Cupom de lançamento `LANCAMENTO15`: 15 dias de assinatura grátis**, um por profissional, até 5.000 usos, válido por 120 dias. Os dias começam a contar quando a assinatura passaria a ser cobrada (fim do primeiro projeto), para não serem desperdiçados no período que já é gratuito | Definido pela direção; a contagem a partir do fim do primeiro projeto é escolha minha | tela de administração → Cupons |
| D20 | **Controle de vencimento:** aviso 3 dias antes; renovação aberta nos últimos 7 dias, somando os 30 dias novos ao fim do período atual; sem renovação automática | Pedido da direção ("assinaturas a vencer") sem abrir mão de D3 | tela de administração → Assinaturas a vencer |
| D13 | Reclamação pelo contrato até 30 dias após a conclusão; congela o crédito ainda não repassado; decisão com justificativa escrita libera ao profissional ou devolve à empresa | Canal de reclamação pedido pela direção | função `open_dispute` / `resolve_dispute` |
| D5 | Propostas ilimitadas até a conclusão e aprovação do primeiro projeto; depois exigem plano | Modelo aprovado | função `submit_proposal` |
| D6 | Teto antiabuso de 50 propostas por dia | Protege empresas de spam; não é limite comercial | `platform_settings.proposal_abuse_daily_limit` |
| D7 | Contratante pessoa física desligado | Depende de política comercial e jurídica | `ALLOW_PF_CONTRACTORS` |
| D8 | Área administrativa **só abre com verificação em duas etapas** | Senha de administrador vazada, sozinha, não dá acesso a dados financeiros nem a decisões | funções `private.is_admin` / `has_admin_role` |
| D10 | Anúncios: a empresa procura o Bico BR, contrata o espaço e envia a **imagem** (banner). Um administrador sobe a arte, define link e período e coloca no ar. Espaços próprios (início, feed, lateral), preço fixo por período, sempre com o selo “Patrocinado”; sem rede de anúncios de terceiros; nunca em contrato, chat ou pagamento. Só PNG, JPG e WebP até 2 MB (SVG recusado), com o tipo real do arquivo conferido | Receita extra sem abrir a página a scripts de terceiros. Exibições e cliques são informativos, porque contadores públicos podem ser inflados | tela de administração → Anúncios de empresas |
| D9 | Primeiro bico cancelado por decisão de disputa não consome o benefício do primeiro projeto gratuito | Justo com o profissional | função `resolve_dispute` |

**Pontos de atenção de D2:**

1. **Taxa e reconhecimento de receita.** O Mercado Pago separa a taxa no momento do pagamento. O Bico BR só a conta como receita quando a entrega é validada; antes disso ela aparece como "taxa a reconhecer", porque volta em caso de cancelamento.
2. **Devolução.** Se uma reclamação terminar em devolução, ela é feita pelo Mercado Pago sobre o pagamento original e depende do saldo da conta do profissional (limitação documentada do modelo 1:1). Hoje o sistema abre o pedido de devolução para o financeiro; a chamada automática à API de reembolso ainda não foi feita.
3. **Validação real.** A divisão do pagamento foi testada contra um Mercado Pago simulado, escrito a partir da documentação. Antes de dinheiro real: conta de vendedor com identificação completa, aplicação de marketplace aprovada e um pagamento de teste nas credenciais de teste do Mercado Pago.

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

1. **Homologação em Supabase real e teste de invasão independente.** Regras do banco (256 verificações) e fluxo de telas (23 passos, com tentativas de invasão) passam na simulação local; falta repetir no Supabase real.
2. **CAPTCHA no cadastro e no login** (o Supabase Auth integra Turnstile/hCaptcha) e política de senha forte no painel do Supabase.
3. **Rate limit compartilhado** (Redis) quando houver mais de uma instância do backend.
4. **Verificação de arquivos enviados** (tipo real e antivírus) antes de habilitar upload de portfólio e anexos.
5. **Monitoramento e alertas**: falhas de webhook, `amount_mismatch`, picos de 401/429.
6. **Revisão jurídica** dos termos, da política de privacidade e do contrato.
7. **Auditoria de segurança independente** antes de processar volume relevante. Nenhum sistema deve ser considerado seguro só porque quem o escreveu o testou.

## Não implementado

| Item | Situação |
|---|---|
| Antivírus nos arquivos do chat | Não há. Os tipos são restritos e o conteúdo é conferido, mas um PDF ou planilha pode carregar código malicioso. Avaliar verificação antes de abrir ao público |
| Comentários nas publicações | Não feito de propósito nesta etapa: é mais uma superfície de moderação. Há curtidas e “Solicitar serviço” |
| Links profissionais no perfil | Desativados: conflitam com a proibição de divulgar redes sociais |
| Devolução automática pela API do Mercado Pago | O pedido de devolução é aberto para o financeiro, que executa no painel do Mercado Pago |
| Aviso ao profissional quando surge projeto com as habilidades dele | Não iniciado; hoje ele vê o selo “combina com você” e o filtro |
| E-mails transacionais (Brevo) | Não iniciado; notificações existem só dentro da plataforma |
| Upload de arquivos (avatar, portfólio, anexos do chat, evidências de disputa) | Buckets e políticas escritos, não validados; telas usam apenas texto e links |
| Perfil público da empresa | Banco pronto; sem tela |
| Página individual de vaga; gestão de candidaturas pela empresa | Listagem e candidatura prontas; falta a tela de gestão |
| Reembolso: tela de solicitação e de decisão; execução do estorno no Mercado Pago | Tabela, políticas, auditoria e abertura automática prontas |
| Inteligência competitiva | Primeira rodada em `06-inteligencia-competitiva.md`; falta leitura de amostra de reclamações e as páginas do 99Freelas e do Fiverr |
| Agendamentos | Criados automaticamente se a extensão pg_cron estiver habilitada antes das migrations |
| Páginas de destino por busca | Não iniciado |
| Anúncios: cobrança online e relatório para o anunciante | A venda é combinada pela equipe e o valor fica registrado na campanha. O envio da imagem funciona na simulação; as permissões reais do Storage ainda precisam ser validadas no Supabase |
| Programa de indicação, cupons, campanhas, planos empresariais | Indicação tem tabelas e regra de qualificação; o resto não foi iniciado |
| Gestão de usuários e de habilidades no painel administrativo | Painel cobre indicadores, planos, disputas, denúncias e categorias |
| Tela de solicitações LGPD do titular | Tabela e políticas prontas |
| Testes de carga | Roteiro pronto, não executado |

## Verificado em simulação local (`npm run test:e2e`)

Postgres real + PostgREST (o mesmo motor de API de dados do Supabase) + servidor real + navegador. O login,
o ViaCEP, a BrasilAPI e o Mercado Pago são simulados por um gateway de teste; o webhook é assinado de verdade.
23 passos: cadastro de empresa com CNPJ/CEP → projeto → cadastro de profissional → busca → proposta → chat →
aceite → confirmação → pagamento da taxa → entrega → aprovação → saldo → avaliação → compra do Pro →
perfil público → vaga e candidatura → 15 tentativas de invasão pela API → administração → celular.
Os textos carregam uma carga de ataque (XSS) e o teste confirma que ela nunca executa.

## Não verificado

- **Supabase real**: Auth (confirmação de e-mail, redefinição de senha, cadastro do segundo fator), Storage (anexos do chat, imagens de publicações e de anúncios — na simulação as permissões são imitadas pelo programa de teste) e tempo real do chat. Na simulação o chat funciona pela consulta periódica.
- Respostas reais de BrasilAPI, ViaCEP, Mercado Pago e Serpro.
- Migration de Storage e agendamentos com pg_cron.
- Carga.

## Para colocar em homologação

1. Criar o projeto Supabase e aplicar as migrations em ordem.
2. Em Authentication: confirmação de e-mail obrigatória, MFA (TOTP) habilitado, URL do site e redirecionamentos (`/onboarding`, `/entrar`), CAPTCHA.
3. Preencher o `.env` conforme `.env.example`.
4. `npm install && npm run build && npm start`.
5. Criar o primeiro administrador por SQL (ver README) e cadastrar o segundo fator em `/admin`.
6. No Mercado Pago (credenciais de teste): apontar o webhook para `https://<domínio>/api/webhooks/mercadopago` e copiar a assinatura secreta para `MP_WEBHOOK_SECRET`.
7. Roteiro manual: cadastro de empresa → projeto → cadastro de profissional → proposta → conversa → aceite → confirmação → pagamento de teste → entrega → aprovação → saldo → avaliação → compra de plano.
