// Modelo financeiro do Bico BR — 6 primeiros meses de operação comercial.
// Uso: npm run model  (gera docs/modelo-financeiro/resultado.md)
// TODAS as premissas abaixo são hipóteses a validar com dados reais. Altere-as aqui e gere de novo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMUM = {
  takeRate: 0.10,            // receita da plataforma sobre o valor contratado (hipótese: a entrada de 10%)
  processedShare: 1.10,      // a empresa paga valor + taxa pela plataforma: 110% do GMV passa pelo meio de pagamento
  paymentFee: 0.035,         // tarifa média do meio de pagamento sobre o volume processado (estimativa)
  taxRate: 0.145,            // tributos sobre receita (estimativa; depende do regime — validar com contador)
  lossRate: 0.02,            // fraudes, estornos e reembolsos sobre a receita
  supportPerContract: 6,     // R$ de atendimento por contrato
  proPrice: 25,              // R$ / mês — assinatura única definida pela direção
  proMonthlyChurn: 0.15,
  enterprisePrice: 299,      // R$ / mês — plano empresarial hipotético
  subscriptionPaymentFee: 0.04,
};

const CENARIOS = {
  conservador: {
    marketing: [30, 40, 50, 60, 70, 80].map((k) => k * 1000),
    cacEmpresa: 400, projetosPorEmpresaMes: 0.8, taxaContratacao: 0.35, ticket: 900, churnEmpresas: 0.15,
    conversaoPro: 0.20, shareEnterprise: 0.01,
    equipe: [60, 60, 75, 75, 90, 90].map((k) => k * 1000), infra: [1.5, 1.5, 2, 2, 3, 3].map((k) => k * 1000),
  },
  base: {
    marketing: [60, 90, 130, 170, 210, 250].map((k) => k * 1000),
    cacEmpresa: 300, projetosPorEmpresaMes: 1.0, taxaContratacao: 0.45, ticket: 1200, churnEmpresas: 0.12,
    conversaoPro: 0.30, shareEnterprise: 0.02,
    equipe: [90, 110, 140, 170, 200, 230].map((k) => k * 1000), infra: [2, 3, 4, 6, 8, 10].map((k) => k * 1000),
  },
  agressivo: {
    marketing: [150, 250, 400, 550, 700, 800].map((k) => k * 1000),
    cacEmpresa: 220, projetosPorEmpresaMes: 1.3, taxaContratacao: 0.55, ticket: 1500, churnEmpresas: 0.10,
    conversaoPro: 0.40, shareEnterprise: 0.03,
    equipe: [150, 200, 280, 360, 440, 520].map((k) => k * 1000), infra: [4, 6, 10, 15, 22, 30].map((k) => k * 1000),
  },
};

function simular(nome, c) {
  const p = { ...COMUM, ...c };
  let empresasAtivas = 0; let assinantes = 0; let caixa = 0; let piorCaixa = 0;
  const meses = [];
  for (let m = 0; m < 6; m += 1) {
    const novasEmpresas = p.marketing[m] / p.cacEmpresa;
    empresasAtivas = empresasAtivas * (1 - p.churnEmpresas) + novasEmpresas;
    const projetos = empresasAtivas * p.projetosPorEmpresaMes;
    const contratos = projetos * p.taxaContratacao;
    const gmv = contratos * p.ticket;
    const comissao = gmv * p.takeRate;
    // cada contrato concluído por um freelancer novo gera um candidato ao Pro (aprox.: 60% são "primeiro bico")
    assinantes = assinantes * (1 - p.proMonthlyChurn) + contratos * 0.6 * p.conversaoPro;
    const assinaturas = assinantes * p.proPrice;
    const empresarial = empresasAtivas * p.shareEnterprise * p.enterprisePrice;
    const receitaBruta = comissao + assinaturas + empresarial;
    const tributos = receitaBruta * p.taxRate;
    const receitaLiquida = receitaBruta - tributos;
    const tarifas = gmv * p.processedShare * p.paymentFee + (assinaturas + empresarial) * p.subscriptionPaymentFee;
    const perdas = receitaBruta * p.lossRate;
    const atendimento = contratos * p.supportPerContract;
    const margemContribuicao = receitaLiquida - tarifas - perdas - atendimento - p.marketing[m];
    const resultado = margemContribuicao - p.equipe[m] - p.infra[m];
    caixa += resultado; piorCaixa = Math.min(piorCaixa, caixa);
    meses.push({ m: m + 1, novasEmpresas, empresasAtivas, projetos, contratos, gmv, comissao, assinantes, assinaturas, empresarial,
      receitaBruta, tributos, receitaLiquida, tarifas, perdas, atendimento, marketing: p.marketing[m], margemContribuicao,
      equipe: p.equipe[m], infra: p.infra[m], resultado, caixa });
  }
  const soma = (k) => meses.reduce((a, x) => a + x[k], 0);
  return { nome, p, meses, receitaAcumulada: soma('receitaBruta'), gmvAcumulado: soma('gmv'), marketingAcumulado: soma('marketing'),
    receitaMes6: meses[5].receitaBruta, resultadoAcumulado: caixa, necessidadeCapital: -piorCaixa };
}

/** Quanto seria preciso para atingir uma meta de receita, mantendo a economia unitária do cenário. */
function necessario(c, { receitaAlvo, mensal }) {
  const p = { ...COMUM, ...c };
  const receitaPorContrato = p.ticket * p.takeRate;
  // receitas acessórias (assinatura + empresarial) observadas no cenário, como fração da comissão
  const sim = simular('x', c);
  const acess = (sim.meses[5].assinaturas + sim.meses[5].empresarial) / sim.meses[5].comissao;
  const comissaoAlvo = receitaAlvo / (1 + acess);
  const gmv = comissaoAlvo / p.takeRate;
  const contratos = gmv / p.ticket;
  const empresasAtivasMes = mensal ? contratos / (p.projetosPorEmpresaMes * p.taxaContratacao) : null;
  // freelancers ativos: 1 contrato/mês por freelancer ativo em média, e ~8 propostas por contrato (hipótese)
  return { comissaoAlvo, gmv, contratos, receitaPorContrato, empresasAtivasMes, fatorAcessorio: acess,
    multiplo: receitaAlvo / (mensal ? sim.receitaMes6 : sim.receitaAcumulada) };
}

const R = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const N = (v) => Math.round(v).toLocaleString('pt-BR');
const sims = Object.entries(CENARIOS).map(([n, c]) => simular(n, c));
let md = '<!-- Gerado por modelo.mjs — não edite à mão. -->\n\n';

md += '## Premissas por cenário\n\n| Premissa | Conservador | Base | Agressivo |\n|---|---|---|---|\n';
const linha = (rot, f) => `| ${rot} | ${sims.map((s) => f(s.p)).join(' | ')} |\n`;
md += linha('Marketing mês 1 → mês 6', (p) => `${R(p.marketing[0])} → ${R(p.marketing[5])}`);
md += linha('CAC por empresa contratante', (p) => R(p.cacEmpresa));
md += linha('Projetos por empresa ativa / mês', (p) => p.projetosPorEmpresaMes.toLocaleString('pt-BR'));
md += linha('Projetos que viram contrato', (p) => `${p.taxaContratacao * 100}%`);
md += linha('Ticket médio do contrato', (p) => R(p.ticket));
md += linha('Churn mensal de empresas', (p) => `${p.churnEmpresas * 100}%`);
md += linha('Conversão para Pro após o 1º bico', (p) => `${p.conversaoPro * 100}%`);
md += linha('Empresas com plano empresarial', (p) => `${p.shareEnterprise * 100}%`);
md += linha('Equipe mês 1 → mês 6', (p) => `${R(p.equipe[0])} → ${R(p.equipe[5])}`);
md += `\nComum aos três: comissão de ${COMUM.takeRate * 100}% sobre o valor contratado; ${COMUM.processedShare * 100}% do GMV passa pelo meio de pagamento (a entrada), com tarifa média de ${COMUM.paymentFee * 100}%; tributos de ${COMUM.taxRate * 100}% sobre a receita; perdas de ${COMUM.lossRate * 100}%; Pro a ${R(COMUM.proPrice)}/mês com churn de ${COMUM.proMonthlyChurn * 100}%; plano empresarial a ${R(COMUM.enterprisePrice)}/mês.\n\n`;

md += '## Resultado em 6 meses\n\n| | Conservador | Base | Agressivo |\n|---|---|---|---|\n';
const res = (rot, f) => `| ${rot} | ${sims.map(f).join(' | ')} |\n`;
md += res('GMV acumulado', (s) => R(s.gmvAcumulado));
md += res('**Receita bruta acumulada**', (s) => `**${R(s.receitaAcumulada)}**`);
md += res('**Receita bruta no mês 6**', (s) => `**${R(s.receitaMes6)}**`);
md += res('Marketing acumulado', (s) => R(s.marketingAcumulado));
md += res('Resultado acumulado (lucro/prejuízo)', (s) => R(s.resultadoAcumulado));
md += res('Necessidade de capital (pior caixa)', (s) => R(s.necessidadeCapital));
md += res('Empresas ativas no mês 6', (s) => N(s.meses[5].empresasAtivas));
md += res('Contratos no mês 6', (s) => N(s.meses[5].contratos));
md += res('Assinantes Pro no mês 6', (s) => N(s.meses[5].assinantes));
md += res('Cenário A: % da meta de R$ 5 mi acumulados', (s) => `${(s.receitaAcumulada / 5e6 * 100).toFixed(1)}%`);
md += res('Cenário B: % da meta de R$ 5 mi no mês 6', (s) => `${(s.receitaMes6 / 5e6 * 100).toFixed(1)}%`);

for (const s of sims) {
  md += `\n## Mês a mês — ${s.nome}\n\n| Mês | Novas empresas | Empresas ativas | Contratos | GMV | Comissão | Assinaturas | Empresarial | Receita bruta | Receita líquida | Margem de contribuição | Resultado | Caixa acumulado |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const x of s.meses) {
    md += `| ${x.m} | ${N(x.novasEmpresas)} | ${N(x.empresasAtivas)} | ${N(x.contratos)} | ${R(x.gmv)} | ${R(x.comissao)} | ${R(x.assinaturas)} | ${R(x.empresarial)} | ${R(x.receitaBruta)} | ${R(x.receitaLiquida)} | ${R(x.margemContribuicao)} | ${R(x.resultado)} | ${R(x.caixa)} |\n`;
  }
}

md += '\n## O que as metas de R$ 5 milhões exigem\n\nMantendo a economia unitária de cada cenário (ticket, comissão, receitas acessórias):\n\n';
md += '| | Cenário A — R$ 5 mi acumulados em 6 meses | Cenário B — R$ 5 mi no mês 6 |\n|---|---|---|\n';
for (const [n, c] of Object.entries(CENARIOS)) {
  const a = necessario(c, { receitaAlvo: 5e6, mensal: false });
  const b = necessario(c, { receitaAlvo: 5e6, mensal: true });
  md += `| **${n}** — GMV necessário | ${R(a.gmv)} em 6 meses | ${R(b.gmv)} em um mês |\n`;
  md += `| ${n} — contratos necessários | ${N(a.contratos)} em 6 meses | ${N(b.contratos)} em um mês |\n`;
  md += `| ${n} — empresas ativas publicando | — | ${N(b.empresasAtivasMes)} no mês 6 |\n`;
  md += `| ${n} — distância da projeção | ${a.multiplo.toFixed(1)}× a receita projetada | ${b.multiplo.toFixed(1)}× a receita projetada |\n`;
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'resultado.md');
fs.writeFileSync(out, md);
console.log(md);
