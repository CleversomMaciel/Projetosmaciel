# Rotina do gerenciador de Instagram — Renan Santos Patrimônio

Perfil de consultoria imobiliária em Cascavel/PR: aquisição, construção e patrimônio.
Frase da marca: "Cada aquisição deve construir a próxima."

Esta rotina roda de segunda a sexta, numa tarefa agendada. Cada execução produz **um post**.

## 1. Preparar
- Trabalhe na pasta `instagram-renan/` do repositório `Projetosmaciel`, na branch `claude/gracious-hopper-996qy8`.
  Faça `git pull` dessa branch antes de começar.
- Leia `config.json` e `historico.json`. Não repita um tema ou notícia que já está no histórico dos últimos 30 dias.

## 2. Tema do dia
| Dia | Tipo | Assunto |
|---|---|---|
| Segunda | notícia | Financiamento: Caixa, Minha Casa Minha Vida, bancos, taxa de juros, Selic, FGTS |
| Terça | dica | Comprar bem: documentação, avaliação, erros comuns, negociação |
| Quarta | notícia | Cascavel e oeste do Paraná: lançamentos, obras, valorização de bairros, terrenos |
| Quinta | dica | "Verdades" e mitos do mercado; construir x comprar pronto; terreno como patrimônio |
| Sexta | notícia ou dica | O fato mais relevante da semana; se não houver, um passo a passo de financiamento |

## 3. Pesquisar (só para notícias)
- Use a busca na web com o mês e o ano atuais na consulta. Só valem notícias dos **últimos 7 dias**.
- Prefira fontes oficiais ou grandes: caixa.gov.br, gov.br (Ministério das Cidades), Banco Central,
  Agência Brasil, g1 PR / RPC, CGN e Catve (Cascavel), Valor, InfoMoney.
- Confirme o fato em **pelo menos duas fontes**. Anote os links em `fontes`.
- **Nunca invente número, taxa, prazo ou regra.** Se não achar uma notícia confirmada, faça um post de dica no lugar.

## 4. Escrever o post
Crie `posts/AAAA-MM-DD-slug.json` (data de hoje, slug curto sem acento). Campos:

```json
{
  "tipo": "noticia",                 // ou "dica"
  "chapeu": "Mercado imobiliário",   // 2-3 palavras
  "data": "07/11/2026",              // só em notícia
  "titulo": "Caixa retoma atendimento em <mark>Cascavel</mark>",
  "sub": "Uma frase que explica o fato.",
  "chips": [{"icone": "banco", "titulo": "Financiamento", "texto": "até 6 palavras"}],
  "muda": "O que isso muda para quem quer comprar (1-2 frases).",
  "itens": [{"titulo": "...", "texto": "..."}],   // só em dica, 3 a 5 itens
  "fecho": "Frase final em itálico",               // só em dica (opcional)
  "cta": "Fale comigo no direct",
  "tam": 104,                                      // opcional: tamanho do título se ficar grande
  "legenda": "Texto da legenda",
  "hashtags": ["cascavel", "imoveiscascavel"],
  "fontes": ["https://..."]
}
```
- Notícia: título em CAIXA ALTA automática, até 7 palavras; destaque uma palavra com `<mark>`. Exatamente 3 chips.
- Dica: título em serifa; destaque o fim com `<em>`.
- Ícones dos chips: casa, doc, gente, grafico, dinheiro, chave, banco, calendario, terreno, alerta.
- Legenda: de 500 a 1.100 caracteres. Primeira linha é o gancho. Depois o fato ou a dica em parágrafos curtos,
  o que muda para o leitor, e termina com a chamada "Me chama no direct" ou "Salve este post".
  Tom: consultor próximo, direto, sem exagero e sem promessa ("garantido", "aprovação certa" são proibidos).
- 8 a 12 hashtags, misturando locais (cascavel, cascavelpr, imoveiscascavel, oestedoparana) e de tema
  (minhacasaminhavida, financiamentoimobiliario, primeiroimovel, investimentoimobiliario).

## 5. Gerar a arte
```bash
node scripts/render.mjs posts/AAAA-MM-DD-slug.json
```
Se aparecer "ATENÇÃO: texto encostando no rodapé", encurte o texto ou ponha `"tam"` menor e gere de novo.
Olhe a imagem `.jpg` antes de seguir.

## 6. Enviar ao GitHub
```bash
git add posts/ && git commit -m "Post AAAA-MM-DD: slug" && git push origin claude/gracious-hopper-996qy8
```
A imagem fica pública em `config.site_imagens` + nome do arquivo `.jpg` (GitHub Pages).

## 7. Aprovar e publicar
- Se `config.aprovacao` for `true`: mande a imagem e a legenda para o Renan e **pare**.
  Só publique quando ele responder "aprovar" ou "publicar". Se ele pedir mudança, ajuste, gere de novo e mande outra vez.
- Para publicar: `scripts/publicar.sh posts/AAAA-MM-DD-slug.json`
- Se der erro de autenticação (401/403 ou "token"), avise que a chave do Instagram precisa ser renovada
  (ela vence a cada 60 dias) e não tente de novo.

## 8. Registrar
Acrescente ao `historico.json` um item `{data, tipo, titulo, fontes, link}` e faça commit e push.
