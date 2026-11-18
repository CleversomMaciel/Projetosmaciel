# Automação de publicação — @renansantos.patrimonio

Aprovado pelo usuário: publicação 100% automática, sem aprovação prévia (18/11/2026).

## Cada rodada (2x por dia)
1. `cd /home/user/Projetosmaciel && git fetch origin claude/focused-goodall-75vbpw && git checkout claude/focused-goodall-75vbpw && git pull`.
2. Ler `instagram/GUIA-DE-ESTILO.md` e `instagram/HISTORICO.md` (não repetir tema publicado nos últimos 14 dias).
3. Pesquisar (WebSearch, modo extended) notícias das últimas 48–72h sobre: Selic/Copom, juros de financiamento (Caixa, BB, bancos privados), Minha Casa Minha Vida, FGTS, aluguel (FipeZAP, IGP-M, IVAR), preços de imóveis, reforma tributária, crédito imobiliário (Abecip), mercado de Cascavel/PR e Paraná.
4. Escolher o tema mais relevante e ainda não publicado. Sem notícia nova forte: usar um tema educativo atemporal (ex.: SAC x Price, escritura x registro, como usar FGTS, custos de cartório e ITBI, como calcular entrada, amortização).
5. Criar `instagram/posts/AAAA-MM-DD-HHMM-<tema>/post.json` com 5–7 slides, story e legenda, seguindo o guia de estilo (sem emojis, tom profissional, números com fonte, só conteúdo educativo — nunca anunciar imóvel nem se apresentar como corretor).
6. `node instagram/render.js instagram/posts/<pasta>`; conferir visualmente a capa (Read do slide-1.jpg); corrigir quebras de layout.
7. Commit + push para `claude/focused-goodall-75vbpw`; conferir que as URLs raw retornam 200 e batem com os arquivos locais.
8. Publicar via Windsor.ai (connector `instagram`, account `17841433033142206`):
   - `create_carousel_post` com as URLs `https://raw.githubusercontent.com/CleversomMaciel/Projetosmaciel/claude/focused-goodall-75vbpw/instagram/posts/<pasta>/slide-N.jpg` e a legenda.
   - Se der timeout: conferir com `get_data` (media_permalink, last_3dT) antes de repetir. Nunca publicar duplicado.
   - `create_story` com `story.jpg`.
9. Registrar em `HISTORICO.md` (data, tema, link) e fazer commit + push.
10. Avisar o usuário em português: tema e link. Se algo falhar (ex.: plano trial do Windsor expirado), avisar e deixar imagens e legenda prontas para postagem manual.

## Limites
- Não publicar números sem fonte recente. Na dúvida, escolher outro tema.
- No máximo 2 carrosséis por dia.
