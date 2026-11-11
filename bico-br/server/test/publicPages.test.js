import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, fakeStore } from './helpers.js';

const ID = '3f0e7a52-8a43-4b7e-9c1d-2f6f8f1f2a10';
const XSS = '</title><script>window.__pwned=1</script><img src=x onerror=alert(1)>';

test('página de projeto: pré-renderiza conteúdo e neutraliza HTML vindo do banco', async (t) => {
  const store = fakeStore();
  store.public.project = async (id) => (id === ID ? {
    id: ID, kind: 'project', status: 'open', title: `Dashboard ${XSS}`, description: `Preciso de um painel. ${XSS}`,
    budget_type: 'range', budget_min_cents: 100000, budget_max_cents: 200000, deadline_days: 10,
    categories: { name: 'Dados "BI"', slug: 'dados' }, companies: { display_name: '<b>Acme</b>', uf: 'SP' },
  } : null);
  const app = await startApp({ store });
  t.after(app.close);
  const res = await app.get(`/projeto?id=${ID}`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(html.includes('<script>window.__pwned'), false, 'script do banco não entra no HTML');
  assert.equal(/<img src=x/.test(html), false);
  assert.equal(html.includes('<b>Acme</b>'), false);
  assert.match(html, /<title>Dashboard &lt;\/title&gt;/);
  assert.match(html, /&lt;b&gt;Acme&lt;\/b&gt; · Orçamento R\$\s?1\.000 a R\$\s?2\.000 · Prazo 10 dias/);
  assert.match(html, new RegExp(`<link rel="canonical" href="https://bicobr.example/projeto\\?id=${ID}">`));
  assert.equal(res.headers.get('x-robots-tag'), null);
  assert.equal((html.match(/<title>/g) || []).length, 1);
});

test('página de projeto: inexistente => 404 noindex; encerrado => 200 noindex; id malformado nem consulta o banco', async (t) => {
  let queries = 0;
  const store = fakeStore();
  store.public.project = async () => { queries += 1; return queries === 1 ? null : { id: ID, kind: 'quick', status: 'completed', title: 'Planilha', description: 'x', budget_type: 'fixed', budget_min_cents: 15000, categories: { name: 'Adm' }, companies: {} }; };
  const app = await startApp({ store });
  t.after(app.close);
  const missing = await app.get(`/projeto?id=${ID}`);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('x-robots-tag'), /noindex/);
  const closed = await app.get(`/projeto?id=${ID}`);
  assert.equal(closed.status, 200);
  assert.match(closed.headers.get('x-robots-tag'), /noindex/);
  assert.match(await closed.text(), /<meta name="robots" content="noindex, follow">/);
  const bad = await app.get("/projeto?id=1'%20or%201=1--");
  assert.equal(bad.status, 404);
  assert.equal(queries, 2);
});

test('perfil público: JSON-LD não permite sair da tag script; perfil não público => 404', async (t) => {
  const store = fakeStore();
  store.public.freelancer = async (slug) => (slug === 'ana-dados' ? {
    slug: 'ana-dados', headline: 'Analista </script><script>window.__pwned=1</script>', bio: 'Bio "com aspas" </script>', tools: ['SQL', '</script>'],
    completed_projects: 3, rating_avg: 4.9, rating_count: 3, updated_at: '2026-11-01T00:00:00Z', profiles: { display_name: 'Ana', city: 'Recife', uf: 'PE' },
  } : null);
  const app = await startApp({ store });
  t.after(app.close);
  const res = await app.get('/profissional?u=ana-dados');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(html.includes('<script>window.__pwned'), false);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const parsed = JSON.parse(ld);
  assert.equal(parsed.mainEntity.name, 'Ana');
  assert.equal(parsed.mainEntity.address.addressRegion, 'PE');
  assert.equal(ld.includes('<'), false, 'nenhum "<" cru dentro do JSON-LD');
  assert.match(html, /<title>Ana — Analista/);

  assert.equal((await app.get('/profissional?u=perfil-privado')).status, 404);
  assert.equal((await app.get('/profissional?u=../../etc')).status, 404);
});

test('categoria: título próprio; busca e filtros combinados não são indexados', async (t) => {
  const store = fakeStore();
  store.public.category = async (slug) => (slug === 'design' ? { slug, name: 'Design', description: 'Identidade visual e interfaces.', seo_title: null, seo_description: null } : null);
  const app = await startApp({ store });
  t.after(app.close);
  const cat = await app.get('/projetos?categoria=design');
  const html = await cat.text();
  assert.match(html, /<title>Projetos remotos de Design \| Bico BR<\/title>/);
  assert.match(html, /Projetos remotos de Design<\/h1>\s*<p[^>]*>Identidade visual e interfaces\.<\/p>/);
  assert.equal(cat.headers.get('x-robots-tag'), null);
  assert.match((await app.get('/projetos?q=logo')).headers.get('x-robots-tag'), /noindex/);
  assert.match((await app.get('/projetos?categoria=design&q=logo')).headers.get('x-robots-tag'), /noindex/);
  assert.equal((await app.get('/projetos?categoria=nao-existe')).status, 404);
  const plain = await app.get('/projetos');
  assert.equal(plain.status, 200);
  assert.equal(plain.headers.get('x-robots-tag'), null);
});

test('falha do banco na pré-renderização não derruba a página', async (t) => {
  const store = fakeStore();
  store.public.project = async () => { throw new Error('db fora'); };
  const app = await startApp({ store });
  t.after(app.close);
  const res = await app.get(`/projeto?id=${ID}`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Carregando…/);
});
