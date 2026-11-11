import { $, esc, getClient, mountChrome, warnIfUnconfigured } from './core.js';

mountChrome();

(async () => {
  const list = $('#categorias');
  if (!(await warnIfUnconfigured($('#aviso')))) { list.innerHTML = ''; return; }
  const { sb } = await getClient();
  const { data, error } = await sb.from('categories').select('slug, name, description').order('sort_order');
  if (error || !data?.length) { list.innerHTML = '<li class="card text-sm text-tinta-500">Não foi possível carregar as áreas agora.</li>'; return; }
  list.innerHTML = data.map((c) => `
    <li><a class="card block h-full transition hover:-translate-y-0.5 hover:border-mata-500" href="/projetos?categoria=${encodeURIComponent(c.slug)}">
      <strong class="block">${esc(c.name)}</strong>
      <span class="mt-1 block text-sm text-tinta-500">${esc(c.description)}</span>
    </a></li>`).join('');
})();
