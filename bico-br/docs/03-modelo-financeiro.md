# 3. Modelo financeiro e a meta de R$ 5 milhões

Os números completos, mês a mês, estão em [modelo-financeiro/resultado.md](modelo-financeiro/resultado.md),
gerados por `npm run model`. Todas as premissas são **hipóteses**: ainda não existe um único dado real
de CAC, conversão, ticket ou retenção do Bico BR.

## Conclusão

| | Conservador | Base | Agressivo |
|---|---|---|---|
| Receita acumulada em 6 meses | R$ 62 mil | R$ 476 mil | R$ 3,96 milhões |
| Receita no mês 6 | R$ 20 mil | R$ 167 mil | R$ 1,45 milhão |
| Capital necessário | R$ 0,75 milhão | R$ 1,5 milhão | R$ 1,9 milhão |
| % do Cenário A (R$ 5 mi acumulados) | 1% | 10% | 79% |
| % do Cenário B (R$ 5 mi no mês 6) | 0,4% | 3% | 29% |

**Cenário A — R$ 5 milhões acumulados em seis meses.** Exige cerca de R$ 40 milhões em contratos
fechados no período, entre 27 mil e 44 mil contratos. Nenhum dos três cenários chega lá. O agressivo
chega a 79%, mas pressupõe que o CAC *caia* enquanto o investimento em marketing quintuplica, o que
raramente acontece — canais pagos saturam e o CAC sobe. Trate o agressivo como teto teórico.
**Avaliação: muito improvável sem alguns milhões de reais de capital e uma base de demanda pronta
(parceria ou carteira de clientes).**

**Cenário B — R$ 5 milhões de receita no sexto mês.** Exige cerca de R$ 40 milhões em contratos *em um
único mês* e de 38 mil a 158 mil empresas publicando ativamente. É de 3,5 a 250 vezes a projeção.
**Avaliação: inviável em seis meses para uma plataforma que parte do zero.**

## Por que a conta é tão dura

A plataforma fica com 10% do valor contratado. Cada R$ 1 de receita pede R$ 10 de contratos fechados.
Com ticket médio de R$ 1.200, cada contrato rende R$ 120. As assinaturas ajudam pouco no início: só
existem depois que há profissionais concluindo projetos.

## Objetivo intermediário recomendado

Trocar a meta de faturamento por metas de validação, que dizem se o negócio funciona antes de gastar para escalar:

| Mês | Meta | Critério para avançar |
|---|---|---|
| 1 | Homologação fechada; 30 empresas e 300 profissionais convidados | Fluxo completo sem intervenção manual |
| 2 | 100 empresas; 50 contratos concluídos | ≥ 35% dos projetos publicados viram contrato |
| 3 | 250 empresas ativas; R$ 150 mil de GMV no mês | CAC por empresa medido e ≤ R$ 400; disputas ≤ 3% dos contratos |
| 4 | R$ 350 mil de GMV no mês | ≥ 30% das empresas publicam o segundo projeto em 60 dias |
| 5 | R$ 600 mil de GMV no mês | ≥ 20% de conversão para o Pro após o primeiro bico |
| 6 | R$ 1 milhão de GMV no mês (≈ R$ 100–130 mil de receita) | Margem de contribuição positiva antes de marketing |

Atingido o mês 6 com esses indicadores, o Cenário A vira uma meta plausível para os 12 a 18 meses
seguintes, com captação baseada em dados reais.

## Alavancas que mudam a conta

1. **Ticket médio.** Dobrar o ticket dobra a receita por contrato; favorece focar em empresas, não em bicos de R$ 100.
2. **Recorrência.** Cliente que publica todo mês dilui o CAC; é o indicador mais importante a medir.
3. **Receita que não depende de GMV.** Planos empresariais e destaque de vaga.
4. **Tarifa de pagamento.** Se a plataforma processar 100% do valor (e não só a entrada), a tarifa do meio de pagamento consome perto de um terço da comissão. Isso pesa na decisão 1 das pendências.

## Hipóteses que precisam de validação externa

- Tributos de 14,5% sobre a receita: estimativa. O regime tributário deve ser definido com contador.
- Tarifa de 3,5% do meio de pagamento: estimativa; conferir a tabela vigente do Mercado Pago.
- O modelo usa R$ 39 de receita média por assinante; os preços de lançamento definidos são R$ 29,90, R$ 59,90 e R$ 99,90. O plano empresarial (R$ 299) é ilustrativo.
