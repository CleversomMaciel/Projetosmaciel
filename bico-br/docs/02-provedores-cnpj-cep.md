# 2. Provedores de CNPJ e CEP

> As APIs externas estavam inacessíveis no ambiente de desenvolvimento. O que está abaixo vem da
> documentação pública e de pesquisa; **preços e limites precisam ser confirmados na fonte antes de contratar.**

## CNPJ

| | BrasilAPI | SERPRO Consulta CNPJ | Fornecedores comerciais |
|---|---|---|---|
| Fonte | Base pública da Receita, republicada | Receita Federal (oficial) | Variam; em geral a base pública enriquecida |
| Preço | Gratuita | **Paga**, por faixa de consumo mensal; exige contrato na Loja Serpro. Tabela vigente não localizada — consultar a Loja | Pagos, por consulta ou pacote |
| Chave | Não | Sim (OAuth) | Sim |
| SLA | Nenhum (projeto comunitário) | Contratual | Contratual, varia |
| Atualização | Periódica, não em tempo real | Oficial | Varia |
| Limite | Sem limite publicado; uso em massa é desencorajado | Conforme contrato | Conforme plano |
| Risco | Indisponibilidade sem aviso; pode não aceitar CNPJ alfanumérico | Custo e burocracia de contratação | Dependência comercial |

**Decisão adotada:** começar com a BrasilAPI atrás de cache de 7 dias, com a camada pronta para o Serpro.
Com cache, cada CNPJ é consultado uma vez por semana no máximo, o que mantém o volume baixo no início.

**Quando contratar um provedor pago:** antes da abertura comercial em escala. Um cadastro de empresa não pode
depender de um serviço sem SLA. Critério objetivo: taxa de `unavailable` acima de 1% nos logs
(`external_api_logs`) ou qualquer recusa de CNPJ alfanumérico.

**Para ativar o Serpro:** contratar na Loja Serpro, preencher `SERPRO_CONSUMER_KEY` e
`SERPRO_CONSUMER_SECRET`, definir `CNPJ_PROVIDERS=serpro,brasilapi` e validar o mapeamento de campos no
ambiente de demonstração — esse provedor foi escrito pela documentação e nunca recebeu uma resposta real.

### Como a camada funciona (`server/src/providers`)

1. Valida formato e dígitos verificadores (numérico e alfanumérico) antes de qualquer chamada.
2. Cache em memória → cache no banco (`registry_cache`) → provedores na ordem configurada.
3. Timeout por chamada; uma repetição apenas para falha transitória; 429 nunca é repetido.
4. Disjuntor: três falhas seguidas tiram o provedor da fila por 60 segundos.
5. "Não encontrado" só é conclusivo quando todos os provedores consultados dizem isso.
6. Tudo indisponível: o cadastro segue em modo manual e a empresa fica marcada como "dados não consultados".
7. O quadro societário devolvido pela API é descartado no servidor.

O CNPJ é público em exibição parcial (`12.***.***/0001-**`); o número completo fica em tabela restrita ao dono e ao suporte.

## CEP

| | ViaCEP | BrasilAPI |
|---|---|---|
| Preço / chave | Gratuito, sem chave | Gratuito, sem chave |
| Código IBGE | Sim | Não |
| SLA | Nenhum | Nenhum |

**Decisão adotada:** ViaCEP primeiro (traz o código IBGE), BrasilAPI como alternativa, cache de 30 dias.
O usuário sempre confirma o endereço antes de salvar, e a falha da consulta nunca bloqueia o cadastro.

## Fontes consultadas

- [Catálogo Conecta gov.br — Consulta CNPJ](https://www.gov.br/conecta/catalogo/apis/consulta-cnpj)
- [Serpro — CNPJ alfanumérico](https://serpro.gov.br/menu/noticias/noticias-2024/cnpj-alfanumerico)
- [Receita Federal — perguntas e respostas sobre o CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf)
