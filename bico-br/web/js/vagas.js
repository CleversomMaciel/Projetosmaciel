import { $, brl, esc, getClient, getSession, mountChrome, showNotice, timeAgo, warnIfUnconfigured } from './core.js';
import { createFeed, fillCategories } from './listagem.js';

mountChrome();
const CONTRACT = { clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário', freelancer: 'Freelancer', projeto: 'Por projeto' };
const params = new URLSearchParams(location.search);
$('#q').value = params.get('q') ?? '';
$('#contrato').value = CONTRACT[params.get('contrato')] ? params.get('contrato') : '';

const salary = (j) => (j.salary_min_cents || j.salary_max_cents
  ? [j.salary_min_cents, j.salary_max_cents].filter(Boolean).map(brl).join(' – ')
  : 'Remuneração não informada');

(async () => {
  if (!(await warnIfUnconfigured($('#aviso')))) return;
  const categories = await fillCategories($('#categoria'), params.get('categoria'));
  const feed = createFeed({
    table: 'jobs',
    select: 'id, title, description, requirements, benefits, workload, contract_type, salary_min_cents, salary_max_cents, application_deadline, apply_mode, apply_url, published_at, categories(name), companies(display_name, uf)',
    emptyText: 'Nenhuma vaga remota aberta com esses filtros no momento.',
    applyFilters(query) {
      let q = query.eq('work_mode', 'remote'); // nunca misturar presencial/híbrido
      const cat = categories.find((c) => c.slug === $('#categoria').value);
      if (cat) q = q.eq('category_id', cat.id);
      if ($('#contrato').value) q = q.eq('contract_type', $('#contrato').value);
      if ($('#q').value.trim()) q = q.textSearch('search', $('#q').value.trim(), { config: 'portuguese', type: 'websearch' });
      return q;
    },
    renderItem: (j) => `
      <li class="card">
        <div class="flex flex-wrap items-center gap-2">
          <span class="chip-sol">${esc(CONTRACT[j.contract_type])}</span><span class="chip">100% remoto</span><span class="chip">${esc(j.categories?.name)}</span>
          <span class="text-xs text-tinta-500">${esc(timeAgo(j.published_at))}</span>
        </div>
        <h2 class="mt-2 text-lg font-semibold">${esc(j.title)}</h2>
        <p class="text-sm text-tinta-500">${esc(j.companies?.display_name)}${j.companies?.uf ? ` · ${esc(j.companies.uf)}` : ''} · ${esc(salary(j))}</p>
        <details class="mt-3 text-sm">
          <summary class="linkish cursor-pointer">Ver detalhes</summary>
          <div class="mt-3 space-y-3 whitespace-pre-line text-tinta-700">
            <p>${esc(j.description)}</p>
            ${j.requirements ? `<p><strong>Requisitos</strong>\n${esc(j.requirements)}</p>` : ''}
            ${j.benefits ? `<p><strong>Benefícios</strong>\n${esc(j.benefits)}</p>` : ''}
            ${j.workload ? `<p><strong>Jornada:</strong> ${esc(j.workload)}</p>` : ''}
            ${j.application_deadline ? `<p><strong>Inscrições até:</strong> ${new Date(`${j.application_deadline}T12:00:00`).toLocaleDateString('pt-BR')}</p>` : ''}
          </div>
          <div class="mt-4">
            ${j.apply_mode === 'external'
              ? `<a class="btn-primary" href="${esc(j.apply_url)}" target="_blank" rel="noopener noreferrer nofollow">Candidatar-se no site da empresa</a>`
              : `<button class="btn-primary" type="button" data-apply="${esc(j.id)}">Candidatar-se</button>`}
          </div>
        </details>
      </li>`,
  });

  $('#lista').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-apply]');
    if (!btn) return;
    const session = await getSession();
    if (!session) { location.href = `/entrar?next=${encodeURIComponent('/vagas')}`; return; }
    const { sb } = await getClient();
    btn.disabled = true;
    const { error } = await sb.from('job_applications').insert({ job_id: btn.dataset.apply, candidate_id: session.user.id });
    if (error && error.code !== '23505') { btn.disabled = false; return showNotice($('#aviso'), 'error', 'Não foi possível registrar a candidatura.'); }
    btn.textContent = 'Candidatura enviada';
  });
  $('#filtros').addEventListener('submit', (ev) => { ev.preventDefault(); feed.reload(); });
  feed.reload();
})();
