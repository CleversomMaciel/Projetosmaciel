# Casa Pátio — Memorial descritivo e índice do pacote

| | |
|---|---|
| Documento | CP-MEM-01 |
| Revisão | R02 — 15/11/2026 |
| Local | Cascavel/PR — terreno 8,00 × 25,00 m (200 m²), plano, no nível da rua |
| Situação | Anteprojeto para cotação. Não substitui os projetos legais e executivos assinados por profissionais habilitados (ART/RRT). |

## 1. Índice do pacote

| Código | Conteúdo | Arquivo |
|---|---|---|
| CP-ARQ-01 | Planta baixa da Etapa 1, áreas e esquadrias | `plantas/CP-ARQ-01_planta-etapa1_R02` |
| CP-ARQ-02 | Planta baixa da Etapa 2 (área gourmet) | `plantas/CP-ARQ-02_planta-etapa2_R02` |
| CP-ARQ-03 | Cobertura, cortes A-A e B-B, fachada | `plantas/CP-ARQ-03_cobertura-cortes-fachada_R02` |
| CP-ARQ-04 | Fachada frontal com portão basculante, corte do portão e muros | `plantas/CP-ARQ-04_fachada-portao-muros_R02` |
| CP-EST-01 | Locação de pilares, baldrames e estacas | `plantas/CP-EST-01_estrutura-fundacoes_R02` |
| CP-ELE-01 | Pontos elétricos e quadro de cargas | `plantas/CP-ELE-01_eletrica_R02` |
| CP-HID-01 | Água fria, esgoto e pluvial | `plantas/CP-HID-01_hidrossanitario_R02` |
| CP-ORC-01 | Estimativa de custo, quantitativos, orçamento, quadro de cargas e cronograma | `planilhas/CP-ORC-01_quantitativos-orcamento_R02.xlsx` |
| CP-EST-CUSTO-01 | Estimativa paramétrica de custo, em três cenários | `03-estimativa-de-custo.md` |
| CP-DIAG-01 | Diagnóstico inicial | `01-diagnostico-fase1.md` |

Cada prancha existe em PDF (A3, escala 1:100), SVG (editável) e PNG. Os desenhos são gerados por `scripts/gerar_projeto.py`.

## 2. Decisões do proprietário registradas

- Planta aprovada: ala dos quartos em fila como na imagem de referência; banho compartilhado com acesso pelos dois quartos; lavanderia junto à cozinha.
- Garagem descoberta com 5,50 m de profundidade.
- Corredor com vidro de correr do piso ao teto, abrindo para o pátio.
- Spa: só infraestrutura na Etapa 1.
- Terreno plano, no nível da rua.
- Taxa de ocupação informada: 60 %.
- Obra em duas etapas: casa primeiro, área gourmet depois.
- O terreno não tem muros: construir 31,45 m de muro de divisa (h = 2,20 m) e o fechamento frontal.
- Portão da garagem basculante (abre para cima), 6,10 × 2,40 m, mais portão social de 1,00 m.

## 3. Áreas

| Grandeza | Valor |
|---|---:|
| Terreno | 200,00 m² |
| Área útil total | 95,81 m² |
| Área construída = projeção coberta (Etapa 1) | 112,05 m² |
| Taxa de ocupação (Etapa 1) | 56,0 % |
| Saldo de projeção até 60 % | 7,95 m² |
| Garagem descoberta | 44,00 m² |
| Pátio central | 33,32 m² |
| Pátio do spa | 6,72 m² |

### Consequência da taxa de ocupação de 60 % na Etapa 2

- A área gourmet de 14 m² totalmente coberta levaria a ocupação a 63 %. Não atende.
- Soluções: pergolado vazado (ripado, sem telha), ou cobertura fechada limitada a 7,95 m² com o restante vazado.
- A cobertura da garagem (44 m²) não cabe no limite.
- Como a Prefeitura computa pergolados deve ser confirmado na Consulta Prévia.

## 4. Sistema construtivo adotado

| Item | Especificação |
|---|---|
| Fundação | Estacas escavadas Ø25 cm e vigas baldrame 15 × 30 cm. Profundidade de 4,0 m é premissa de orçamento; a definitiva depende da sondagem SPT. |
| Estrutura | 29 pilares 15 × 30 cm de concreto armado embutidos na alvenaria; cinta de respaldo 15 × 25 cm. |
| Vedação | Bloco cerâmico 14 cm nas paredes externas e de divisa (0,20 m acabadas) e 11,5 cm nas internas (0,15 m acabadas). |
| Cobertura | Telha termoacústica, inclinação de 10 %, estrutura metálica leve, duas águas independentes, platibanda nas divisas e na fachada. |
| Forro | Gesso acartonado, pé-direito de 2,80 m. |
| Reservatório | 1.000 L em volume elevado de alvenaria sobre o banho compartilhado. |
| Pisos | Porcelanato nas áreas internas, antiderrapante nas áreas molhadas, piso drenante na garagem. |
| Esquadrias | Alumínio com vidro temperado 8 mm de correr no corredor e no social; janelas de alumínio de correr; portas internas de madeira. |
| Ventilação de banheiros e closet | Exaustão mecânica com duto até a cobertura. |
| Impermeabilização | Argamassa polimérica e emulsão asfáltica nos baldrames; argamassa polimérica nos pisos molhados; membrana acrílica nos boxes; manta asfáltica na laje do reservatório e na base do spa. |
| Água | Reservatório superior, PVC soldável, chuveiros elétricos. |
| Esgoto | Rede pública (a confirmar com a Sanepar), caixas de inspeção no pátio e na garagem. |
| Pluvial | Calhas, seis condutores, caixas de areia e coletor enterrado até a sarjeta. |
| Elétrica | Entrada trifásica 127/220 V, 18 circuitos, DR e DPS, aterramento TN-S. |

## 5. Preparação para a Etapa 2 (executar na Etapa 1)

- Quatro blocos de fundação com arranque para os pilares do pergolado.
- Ponto de água fria e ponto de esgoto com caixa de gordura junto à futura bancada.
- Dois eletrodutos secos e disjuntor reservado no quadro.
- Base estrutural, ponto de água, dreno e eletroduto do spa.

## 6. Custo: o que existe e o que falta

- A planilha CP-ORC-01 traz 112 itens com unidade e quantidade, nas 24 etapas pedidas. As colunas de preço estão em branco e a planilha soma sozinha quando forem preenchidas.
- **Preços SINAPI-PR não foram aplicados.** Não tive acesso à tabela oficial nesta sessão e não vou preencher preços de memória.
- Ordem de grandeza pelo CUB-PR: o valor encontrado para o padrão R-1 normal é de R$ 3.365,21/m² (setembro/2026, fonte secundária, a conferir no Sinduscon-PR). Aplicado a 112,05 m², dá cerca de **R$ 377 mil**. O CUB não inclui fundações especiais, projetos, taxas, muros, portão, paisagismo nem BDI da construtora. Serve como referência, não como orçamento.

## 7. Pendências

| # | Pendência | Quem resolve |
|---|---|---|
| 1 | Consulta Prévia do lote: confirmar ocupação de 60 %, recuo frontal, permeabilidade e como o pergolado é computado | Proprietário / Prefeitura |
| 2 | Aceitação da ventilação dos quartos através do corredor envidraçado | Arquiteto / Prefeitura |
| 3 | Sondagem SPT (mínimo de dois furos) | Empresa de sondagem |
| 4 | Rede pública de esgoto na rua | Sanepar |
| 5 | Categoria de atendimento e disjuntor geral | Copel / projetista elétrico |
| 6 | Projeção do portão basculante sobre o passeio (0,80 m) e altura máxima de muros | Prefeitura |
| 7 | Preços SINAPI-PR e cotações locais | Fase 6 |
| 8 | Projetos legais e executivos com ART/RRT | Profissionais habilitados |
