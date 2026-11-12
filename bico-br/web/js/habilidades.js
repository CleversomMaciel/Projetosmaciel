// Seletor de habilidades: busca + marcações. Usado no perfil do profissional e na publicação de projetos.
import { esc, getClient } from './core.js';

let cache = null;
export async function allSkills() {
  if (!cache) {
    const { sb } = await getClient();
    const { data } = await sb.from('skills').select('id, name').order('name').limit(500);
    cache = data ?? [];
  }
  return cache;
}

/** Monta o seletor dentro de `root`. Devolve { get(): ids[], set(ids) }. */
export async function mountSkillPicker(root, { max = 12, selected = [] } = {}) {
  const skills = await allSkills();
  const chosen = new Set(selected);
  const uid = `sk-${Math.random().toString(36).slice(2, 8)}`;
  root.innerHTML = `
    <label class="sr-only" for="${uid}">Buscar habilidade</label>
    <input class="input" id="${uid}" type="search" placeholder="Buscar habilidade (ex.: Excel, edição de vídeo)" autocomplete="off">
    <p class="hint" data-count></p>
    <div class="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-2xl bg-creme p-3 ring-1 ring-tinta/[.06]" data-list role="group" aria-label="Habilidades"></div>`;
  const list = root.querySelector('[data-list]');
  const count = root.querySelector('[data-count]');
  const input = root.querySelector('input');
  const draw = () => {
    const term = input.value.trim().toLowerCase();
    const rows = skills.filter((s) => chosen.has(s.id) || !term || s.name.toLowerCase().includes(term))
      .sort((a, b) => chosen.has(b.id) - chosen.has(a.id) || a.name.localeCompare(b.name, 'pt-BR'));
    list.innerHTML = rows.map((s) => `<button type="button" data-skill="${esc(s.id)}" aria-pressed="${chosen.has(s.id)}"
      class="rounded-full border px-3 py-1.5 text-sm font-semibold transition ${chosen.has(s.id) ? 'border-marinho-900 bg-marinho-900 text-white' : 'border-tinta/15 bg-white text-tinta-700 hover:border-mata-500'}">${esc(s.name)}</button>`).join('')
      || '<span class="text-sm text-tinta-500">Nenhuma habilidade com esse nome.</span>';
    count.textContent = `${chosen.size} de ${max} selecionadas`;
  };
  list.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-skill]');
    if (!b) return;
    if (chosen.has(b.dataset.skill)) chosen.delete(b.dataset.skill);
    else if (chosen.size < max) chosen.add(b.dataset.skill);
    draw();
  });
  input.addEventListener('input', draw);
  draw();
  return { get: () => [...chosen], set: (ids) => { chosen.clear(); ids.forEach((i) => chosen.add(i)); draw(); } };
}

/** Troca o conjunto de habilidades de um dono (perfil ou projeto) pela seleção atual. */
export async function saveSkills(table, ownerColumn, ownerId, ids) {
  const { sb } = await getClient();
  const { data: current } = await sb.from(table).select('skill_id').eq(ownerColumn, ownerId);
  const have = new Set((current ?? []).map((r) => r.skill_id));
  const want = new Set(ids);
  const remove = [...have].filter((i) => !want.has(i));
  const add = [...want].filter((i) => !have.has(i));
  if (remove.length) { const { error } = await sb.from(table).delete().eq(ownerColumn, ownerId).in('skill_id', remove); if (error) throw error; }
  if (add.length) { const { error } = await sb.from(table).insert(add.map((skill_id) => ({ [ownerColumn]: ownerId, skill_id }))); if (error) throw error; }
}
