// Teste de carga de LEITURA (página inicial, config, CEP em cache). NÃO EXECUTADO ainda:
// exige ambiente de homologação no ar. Nunca rode contra produção nem contra APIs de terceiros.
// Uso: k6 run -e BASE=https://homolog.exemplo.com -e VUS=100 loadtest/k6-leitura.js
// Repita com VUS=100, 500, 1000 e 5000 (usuários SIMULTÂNEOS, não cadastrados) e registre p95 e erros.
import http from 'k6/http';
import { check, sleep } from 'k6';

const VUS = Number(__ENV.VUS || 100);
export const options = {
  stages: [{ duration: '2m', target: VUS }, { duration: '5m', target: VUS }, { duration: '1m', target: 0 }],
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<800'] },
};

export default function () {
  const base = __ENV.BASE;
  check(http.get(`${base}/`), { 'home 200': (r) => r.status === 200 });
  check(http.get(`${base}/api/config`), { 'config 200': (r) => r.status === 200 });
  check(http.get(`${base}/projetos`), { 'projetos 200': (r) => r.status === 200 });
  sleep(1 + Math.random() * 4);
}
