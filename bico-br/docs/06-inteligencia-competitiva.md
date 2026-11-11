# 6. Inteligência competitiva

**Consulta feita em 11/11/2026**, por busca na web. Limites desta pesquisa:

- Li resumos de páginas e títulos de reclamações; não abri cada reclamação individualmente.
- Reclamações são relatos de uma das partes. Servem como **hipóteses** sobre onde os usuários sofrem, não como prova de falha da empresa.
- Taxas e planos de concorrentes vêm de blogs e comparativos que **divergem entre si**. Confirme nas páginas oficiais antes de usar em material comercial.
- Não encontrei, nesta busca, reclamações específicas do 99Freelas nem páginas do Fiverr no Reclame Aqui ou Trustpilot. Essas duas lacunas continuam em aberto.

## O que apareceu

### Workana
- Reputação no Reclame Aqui oscilou em 2026: uma leitura mostra nota 6,3 (regular), outra 7,7 (boa), em períodos diferentes. Responde a todas as reclamações; cerca de 80% resolvidas.
- Temas recorrentes nos títulos: [valores retidos após conta banida](https://www.reclameaqui.com.br/workana/conta-banida-e-valores-retidos_4RRQXBj0FrW6q3O1/), [retenção no cartão após cancelamento sem prestação de serviço](https://www.reclameaqui.com.br/workana/workana-retencao-de-valor-em-cartao-de-credito-apos-cancelamento-de-projeto-sem-prestacao-de-servico_KysbiMj3-jsffdtL/), [erro que impede cancelar projeto](https://www.reclameaqui.com.br/workana/erro-na-plataforma-impede-cancelamento-do-projeto_HFqccqIQNjkN5N7c/), [perfil reprovado sem justificativa com oferta de serviço pago de reavaliação](https://www.reclameaqui.com.br/workana/workana-reprova-perfil-sem-justificativa-e-oferece-servico-pago-para-reavaliacao_ltId9leloknlR0Bp/), [conexões que sumiram após mudança de política](https://www.reclameaqui.com.br/workana/conexoes-sumiram-apos-novas-politicas-anti-spam-da-workana_26Bdspi36aTGyBrB/), cobranças contestadas.
- Comissão sobre o profissional: comparativos citam 20% caindo para 10% e 5% conforme o acumulado com o mesmo cliente; outra fonte cita 12–15%.
- Fonte: [página da empresa no Reclame Aqui](https://www.reclameaqui.com.br/empresa/workana/), [comparativo de taxas](https://www.freelasemcrise.com.br/blog/taxas-plataformas-hotmart-upwork-workana).

### 99Freelas
- Notas citadas por terceiros: 7,7 e 8,1 no Reclame Aqui (datas diferentes, não confirmadas na fonte).
- Comparativos citam comissão de 15–20% no plano gratuito, mais taxa de saque, e planos pagos por volta de R$ 39–43/mês que reduzem a comissão; limite de conexões mensais.
- Queixas mencionadas de forma genérica: reembolsos e cobranças indevidas.
- Fonte: [comparativo Workana × 99Freelas × Upwork](https://www.freelasemcrise.com.br/blog/workana-99freelas-upwork-comparativo), [guia de taxas 2026](https://ecarts.com.br/tecnologia/99freelas-em-2026-quanto-paga-taxas-e-como-ganhar-dinheiro/).

### GetNinjas
- Modelo: o profissional compra moedas para desbloquear contatos de clientes.
- Temas recorrentes: [moedas gastas em contatos inválidos ou desatualizados sem reembolso](https://www.reclameaqui.com.br/getninjas/cobranca-indevida-por-contatos-desatualizados-e-falta-de-reembolso_bcVYyz20uPtKhPF4/), [pedidos de devolução de moedas sem resposta](https://www.reclameaqui.com.br/getninjas/meus-pedidos-de-devolucao-de-moedas-nao-estao-sendo-atendidos_hvl-6LXizv_Y8Hm2/), [atendimento que dificulta o reembolso](https://www.reclameaqui.com.br/getninjas/plataforma-pessima-nao-presta-um-bom-atendimento-so-dificulta-a-conversa-pra-voce-desistir-de-tentar-o-reembolso_aJNYqtuJS6aLE2ad/).
- Nota média citada na página de comparação do Reclame Aqui: 7,44, com mais de mil reclamações.

### Fiverr
- Pela própria central de ajuda: conta desativada por violação [não pode ser revertida](https://help.fiverr.com/hc/pt/articles/34551010553489-Restri%C3%A7%C3%B5es-da-conta) e o saldo fica indisponível por até 90 dias; em [estornos](https://help.fiverr.com/hc/pt/articles/360010978618-Estornos-e-prote%C3%A7%C3%A3o-ao-freelancer) não há garantia de resultado favorável ao profissional.
- Comissão sobre o profissional citada por blogs: 20% (divergem sobre faixas menores).

## Padrões de dor e a resposta do Bico BR

| Dor observada (hipótese) | Resposta do Bico BR | Situação |
|---|---|---|
| Dinheiro do profissional retido pela plataforma (conta banida, ciclo de saque, estorno) | A plataforma não guarda o dinheiro do profissional: o saldo é pago direto pela empresa. Não existe saldo a reter | Implementado (decisão D2) |
| Comissão de 15–20% descontada do profissional | O profissional recebe 100% do saldo; a taxa de serviço de 10% é paga pela empresa | Implementado (decisão D1) |
| Pagar para tentar (moedas, conexões) sem garantia de contato real | Propostas ilimitadas e gratuitas até concluir o primeiro projeto; plano só depois de um resultado concreto | Implementado |
| Créditos consumidos em contatos inválidos | Não há crédito por contato. Projetos pertencem a empresas com cadastro e CNPJ consultado | Implementado |
| Cobrança recorrente inesperada, dificuldade de cancelar | Plano é pagamento único por 30 dias, sem renovação automática; o aceite registra o preço exibido | Implementado (decisão D3) |
| Cancelamento travado ou valor retido após cancelar | Cancelar antes do início é um clique, sem penalidade; pagamento que chega depois do cancelamento abre reembolso automático | Implementado; tela de reembolso pendente |
| Perfil reprovado ou conta bloqueada sem explicação | Toda decisão de moderação e de disputa exige justificativa escrita, visível às partes e gravada em auditoria | Disputas: implementado. Moderação de perfil: pendente |
| Atendimento que não resolve | Protocolo por caso, histórico e evidências no próprio contrato | Implementado; SLA e equipe a definir |
| Regras que mudam e retiram benefícios já pagos | Alterações de plano valem só para novas compras; o que foi aceito fica registrado | Implementado |

## Riscos do nosso próprio modelo

A pesquisa também mostra por que os concorrentes retêm o dinheiro: é o que protege o profissional contra o calote.
No Bico BR o profissional entrega antes de receber o saldo. Mitigações existentes: registro do contrato, disputa com protocolo,
e o indicador "saldos sem confirmação há 7+ dias" no painel administrativo. Mitigações a construir:
exibir no perfil da empresa a taxa de saldos confirmados, e suspender a publicação de novos projetos por empresas com saldo em disputa.

## Próximos passos da pesquisa

1. Abrir e ler uma amostra de 30 reclamações por concorrente, classificando por tema e data.
2. Consultar diretamente as páginas do 99Freelas e do Fiverr no Reclame Aqui e Trustpilot.
3. Conferir taxas e planos nas páginas oficiais.
4. Entrevistar 10 profissionais e 10 empresas que usam essas plataformas.
