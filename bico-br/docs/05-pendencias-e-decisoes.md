# 5. Pendências e decisões

## Decisões que só a direção pode tomar

Estas travam a Fase 3. O código foi escrito para funcionar com qualquer resposta, mas nada de pagamento vai ao ar sem elas.

1. **O que são os 10%?** O sistema hoje calcula uma entrada de 10% do contrato (`platform_settings.deposit_rate`).
   Falta decidir: essa entrada é a comissão da plataforma, ou é um adiantamento ao profissional com a comissão cobrada à parte?
   E o saldo de 90%: passa pela plataforma ou é pago direto ao profissional? Isso define tarifa de pagamento,
   tributação e risco regulatório (reter e repassar dinheiro de terceiros pode caracterizar arranjo de pagamento).
2. **Modelo no Mercado Pago.** Para repassar valores a profissionais é preciso o modelo de marketplace/split,
   em que cada profissional conecta a própria conta. Precisa ser confirmado com o Mercado Pago, incluindo regras de reembolso e disputa no split.
   Não foi implementado checkout: fazê-lo antes dessa definição seria inventar a integração.
3. **Preços dos planos.** Pro (10 propostas), Pro Plus (30) e Premium (60) estão cadastrados **sem preço e inativos**. Defina os preços no painel/banco para ativá-los.
4. **Contratante pessoa física.** Desligado (`ALLOW_PF_CONTRACTORS=false`) até decisão comercial e jurídica.
5. **Propostas durante o primeiro projeto.** Adotei: ilimitadas enquanto o primeiro projeto está em andamento; exigem Pro depois que ele é concluído e aprovado. Confirme.
6. **Teto antiabuso de 50 propostas por dia.** Não é limite comercial; existe para proteger empresas de spam. Ajustável ou desligável em `platform_settings`.

## Revisão jurídica obrigatória antes de produção

- Termos de uso (empresa, freelancer, candidato a vaga), política de privacidade, termo da assinatura e modelo de contrato de prestação de serviços. Hoje o sistema registra o aceite de uma versão `rascunho-0` e a tela avisa que os documentos são preliminares.
- Entrada de 10%, cancelamento e reembolso: aderência ao Código de Defesa do Consumidor e ao Marco Civil.
- Risco de vínculo trabalhista: vagas CLT ficam em tabela e fluxo separados e não geram comissão. Em projetos recorrentes com um mesmo contratante, a plataforma deve alertar as partes — ainda não implementado.
- LGPD: base legal de cada tratamento, prazo de retenção, encarregado (DPO) e canal do titular. O banco já tem registro de consentimentos e de solicitações de titulares; falta a tela e a política de retenção.

## Não implementado nesta entrega

| Item | Situação |
|---|---|
| Checkout Mercado Pago (entrada e assinatura) | Depende das decisões 1 e 2. Webhook e confirmação já prontos |
| E-mails transacionais (Brevo) | Não iniciado. Variável e integração a criar |
| Painel administrativo | Banco e permissões por função prontos; sem telas |
| Perfil público do profissional e da empresa | Banco pronto; sem telas |
| Portfólio (upload, coleções) | Banco e buckets prontos; sem telas |
| Publicação de vagas e página individual de vaga | Banco e listagem prontos; sem formulário |
| Chat em tela | Banco, RLS e Realtime configurados; sem telas |
| Telas de disputa, reembolso, avaliação e oferta do Pro | Funções no banco prontas e testadas; sem telas |
| Renderização no servidor das páginas públicas | Hoje o conteúdo de projeto é montado no navegador; para SEO precisa vir pronto do servidor |
| Páginas de destino por busca ("freelancer Power BI" etc.) | Não iniciado; exige conteúdo próprio por página |
| Programa de indicação | Tabelas e regra de qualificação prontas; sem telas nem recompensa |
| Cupons, campanhas, planos empresariais | Não iniciado |
| Proteção contra bots no cadastro (CAPTCHA) | Não iniciado; o Supabase Auth oferece integração |
| Inteligência competitiva (Workana, 99Freelas, Fiverr, GetNinjas, Reclame Aqui) | Não iniciada. Exige pesquisa com links e datas; não foi feita para não registrar afirmações sem evidência |
| Agendador de expiração de assinaturas | Função `expire_subscriptions()` pronta; falta agendar (pg_cron) |
| Limpeza do cache de CNPJ/CEP expirado | Falta agendar |
| Testes de carga | Roteiro pronto, não executado |

## Não verificado

- Fluxos de tela com login, contra um Supabase real.
- Respostas reais de BrasilAPI, ViaCEP, Mercado Pago e Serpro (hosts bloqueados no ambiente de desenvolvimento).
- Migration de Storage (`20261111000900_storage.sql`).
- Suporte da BrasilAPI ao CNPJ alfanumérico.

## Para colocar em homologação

1. Criar o projeto Supabase e aplicar as migrations em ordem.
2. Em Authentication: confirmar e-mail obrigatório, URL do site e redirecionamentos (`/onboarding`, `/entrar`).
3. Preencher o `.env` conforme `.env.example`.
4. `npm install && npm run build && npm start`.
5. Criar o primeiro administrador por SQL (ver README).
6. No Mercado Pago (credenciais de teste): apontar o webhook para `https://<domínio>/api/webhooks/mercadopago` e copiar a assinatura secreta para `MP_WEBHOOK_SECRET`.
7. Executar o roteiro manual: cadastro de empresa com CNPJ real → publicar projeto → cadastro de profissional → proposta → aceite → confirmação.
