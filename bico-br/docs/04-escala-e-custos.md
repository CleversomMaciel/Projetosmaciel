# 4. Escalabilidade e custos

**Nenhuma capacidade é declarada aqui.** Não houve teste de carga: não existe ainda ambiente de
homologação. O roteiro está em `loadtest/k6-leitura.js` e deve rodar com 100, 500, 1.000 e 5.000
usuários simultâneos. Usuários simultâneos não são usuários cadastrados: como regra de bolso,
1% a 3% da base ativa no mês costuma estar online no pico.

## O que o desenho já faz

| Tema | Situação |
|---|---|
| Índices | Todas as chaves estrangeiras usadas em filtros e todos os feeds têm índice (parciais para "aberto e público") |
| Paginação | Por cursor em projetos, vagas e mensagens; nenhuma listagem carrega tudo |
| Busca | Texto completo em português com índice GIN; sem `LIKE '%termo%'` |
| RLS | Políticas usam `(select auth.uid())` e funções auxiliares, o padrão recomendado para não reavaliar por linha |
| Cache | CNPJ/CEP em dois níveis; sitemap por 10 minutos |
| Realtime | Só `messages` e `notifications` publicadas; RLS decide quem recebe |
| Backend | Sem estado em memória além de cache e rate limit; escala horizontal exige apenas mover o rate limit para um store compartilhado |

## Gargalos previsíveis, em ordem provável

1. **Validação de token** — cada chamada autenticada ao backend consulta o Supabase Auth. Trocar por verificação local do JWT quando o backend passar de dezenas de requisições por segundo.
2. **Conexões** — o navegador usa a API do Supabase (pool próprio). Se o backend passar a abrir conexão direta ao Postgres, usar o pooler em modo transação.
3. **Antispam do chat** — conta mensagens do último minuto por remetente a cada envio. Tem índice, mas é o primeiro ponto a medir no teste de carga do chat.
4. **Contadores** — `proposals_count` atualiza a linha do projeto a cada proposta; projetos muito disputados geram contenção.
5. **Egress de Storage** — vídeos de portfólio são o maior risco de custo. Limites por arquivo já estão nos buckets; definir cota por usuário antes de abrir upload de vídeo.
6. **Rate limit em memória** — vale para uma instância só.

## Evolução por etapas

| Etapa | Gatilho medido | Mudança |
|---|---|---|
| 0 | Lançamento | 1 instância do backend, Supabase Pro, PITR ligado |
| 1 | CPU do banco > 60% sustentado ou p95 > 500 ms | Subir o compute do banco; revisar consultas lentas |
| 2 | Backend > 1 instância | Rate limit em Redis; verificação local de JWT |
| 3 | E-mails e tarefas atrasando | Fila simples no próprio Postgres (pgmq ou tabela + worker) |
| 4 | Leituras dominando o banco | Réplica de leitura; cache de páginas públicas na CDN |

Microserviços, Kafka e afins não entram enquanto um gargalo medido não exigir.

## Estimativa de custo de infraestrutura

Ordens de grandeza para planejamento, **não cotação**. Os preços do Supabase e da hospedagem mudam;
confirme nas páginas de preços antes de orçar. Não inclui Mercado Pago, e-mail, CNPJ pago nem equipe.

| Usuários cadastrados | Simultâneos no pico (hipótese) | Infraestrutura mensal (ordem de grandeza) | Principal fator de custo |
|---|---|---|---|
| 1.000 | 10–30 | US$ 30–60 | Plano base |
| 10.000 | 100–300 | US$ 60–150 | Compute do banco |
| 100.000 | 1.000–3.000 | US$ 400–1.200 | Compute, usuários ativos mensais, egress |
| 500.000 | 5.000–15.000 | US$ 2.000–6.000 | Egress de mídia, réplicas, Realtime |
| 1.000.000 | 10.000–30.000 | US$ 5.000–15.000 | Idem, mais suporte e observabilidade |

As faixas são largas de propósito: o custo real depende do volume de mídia e da proporção de
usuários ativos, que só se conhece operando.

## Backups e recuperação

- Ligar PITR no Supabase antes de qualquer dado real.
- Testar restauração em um projeto separado antes do lançamento — backup não testado não conta.
- Toda migration tem reversão, validada pelo `npm run test:db`.
