import { $, esc, fmtDateTime, getClient, imageKind, looksLikeContact, mountChrome, requireSession, rpcMessage, showNotice } from './core.js';

mountChrome();
const PAGE = 30;
const aviso = $('#aviso');
const thread = $('#thread');
const MAX_FILE = 20 * 1024 * 1024;
const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const SELECT = 'id, sender_id, body, attachments, blocked, created_at';

/** Confere se o conteúdo do arquivo bate com a extensão (não confia no nome nem no tipo declarado). */
async function fileKind(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!TYPES[ext]) return null;
  const b = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const is = (sig) => sig.every((v, i) => b[i] === v);
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) { const k = await imageKind(file); return k ? { ext: k.ext, mime: k.mime } : null; }
  if (ext === 'pdf') return is([0x25, 0x50, 0x44, 0x46]) ? { ext, mime: TYPES[ext] } : null;
  if (['xlsx', 'docx', 'pptx'].includes(ext)) return is([0x50, 0x4b, 0x03, 0x04]) ? { ext, mime: TYPES[ext] } : null;
  if (['xls', 'doc'].includes(ext)) return is([0xd0, 0xcf, 0x11, 0xe0]) ? { ext, mime: TYPES[ext] } : null;
  return b.includes(0) ? null : { ext, mime: TYPES[ext] }; // csv/txt: texto puro, sem bytes nulos
}
const sizeLabel = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

(async () => {
  const session = await requireSession();
  const uid = session.user.id;
  const { sb } = await getClient();
  let current = null; let oldest = null; let newest = 0; let channel = null; let poll = null; let pending = [];
  const names = new Map();

  const { data: mine, error } = await sb.from('conversation_participants')
    .select('conversation_id, last_read_at, conversations(id, last_message_at, projects(title))')
    .eq('user_id', uid).limit(100);
  if (error) return showNotice(aviso, 'error', 'Não foi possível carregar as conversas.');
  const convs = (mine ?? []).filter((m) => m.conversations)
    .sort((a, b) => String(b.conversations.last_message_at ?? '').localeCompare(String(a.conversations.last_message_at ?? '')));
  $('#conversas').innerHTML = convs.map((m) => {
    const unread = m.conversations.last_message_at && (!m.last_read_at || m.conversations.last_message_at > m.last_read_at);
    return `<li><button type="button" class="block w-full px-4 py-3 text-left hover:bg-mata-50" data-conv="${esc(m.conversation_id)}">
      <span class="${unread ? 'font-bold' : 'font-medium'}">${esc(m.conversations.projects?.title ?? 'Conversa')}</span>
      <span class="block text-xs text-tinta-500">${m.conversations.last_message_at ? fmtDateTime(m.conversations.last_message_at) : 'Sem mensagens'}</span></button></li>`;
  }).join('') || '<li class="px-4 py-3 text-tinta-500">Nenhuma conversa ainda. Elas começam a partir de uma proposta, de um convite ou de um contrato.</li>';

  const attachment = (a) => `<button type="button" class="mt-1.5 flex w-full items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-left text-xs font-semibold text-tinta ring-1 ring-tinta/10 hover:ring-mata-500" data-file="${esc(a.path)}" data-name="${esc(a.name)}">
    <svg class="icon h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/></svg><span class="min-w-0 flex-1 truncate">${esc(a.name)}</span><span class="font-normal text-tinta-500">${sizeLabel(a.size)}</span></button>`;
  const bubble = (m) => {
    const own = m.sender_id === uid;
    if (m.blocked) return `<div class="flex justify-end" data-id="${m.id}"><div class="notice-warn max-w-[85%]"><strong>Mensagem não enviada.</strong> ${esc(m.body)}<br><span class="text-xs">Tentativas repetidas levam à suspensão da conta.</span></div></div>`;
    return `<div class="flex ${own ? 'justify-end' : ''}" data-id="${m.id}">
    <div class="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${own ? 'bg-floresta-900 text-white' : 'bg-areia'}">
      <span class="block text-xs opacity-70">${esc(own ? 'Você' : names.get(m.sender_id) ?? 'Participante')} · ${fmtDateTime(m.created_at)}</span>
      ${m.body ? `<span class="whitespace-pre-line break-words">${esc(m.body)}</span>` : ''}
      ${(m.attachments ?? []).map(attachment).join('')}</div></div>`;
  };
  const append = (rows) => {
    for (const m of rows) {
      if (m.id <= newest) continue;
      thread.insertAdjacentHTML('beforeend', bubble(m));
      newest = m.id;
    }
    thread.scrollTop = thread.scrollHeight;
  };
  const markRead = () => sb.from('conversation_participants').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', current).eq('user_id', uid);

  async function loadOlder() {
    let q = sb.from('messages').select(SELECT).eq('conversation_id', current).order('id', { ascending: false }).limit(PAGE + 1);
    if (oldest) q = q.lt('id', oldest);
    const { data } = await q;
    const rows = (data ?? []).slice(0, PAGE);
    $('#mais-antigas')?.remove();
    if (!rows.length) return;
    const first = !oldest;
    oldest = rows.at(-1).id;
    const before = thread.scrollHeight;
    thread.insertAdjacentHTML('afterbegin', rows.slice().reverse().map(bubble).join(''));
    if ((data ?? []).length > PAGE) thread.insertAdjacentHTML('afterbegin', '<div class="text-center"><button id="mais-antigas" class="linkish text-xs" type="button">Carregar mensagens anteriores</button></div>');
    if (first) { newest = rows[0].id; thread.scrollTop = thread.scrollHeight; } else thread.scrollTop = thread.scrollHeight - before;
  }
  async function fetchNew() {
    const { data } = await sb.from('messages').select(SELECT).eq('conversation_id', current).gt('id', newest).order('id').limit(100);
    if (data?.length) { append(data); markRead(); }
  }

  const drawPending = () => {
    $('#pendentes').innerHTML = pending.map((p, i) => `<span class="chip-neutral">${esc(p.file.name)} · ${sizeLabel(p.file.size)} <button type="button" class="ml-1 font-bold" data-remove="${i}" aria-label="Remover ${esc(p.file.name)}">×</button></span>`).join('');
  };

  async function open(convId) {
    if (channel) sb.removeChannel(channel);
    clearInterval(poll);
    current = convId; oldest = null; newest = 0; pending = []; drawPending();
    thread.innerHTML = '';
    const conv = convs.find((m) => m.conversation_id === convId);
    $('#topo').textContent = conv?.conversations.projects?.title ?? 'Conversa';
    $('#enviar').hidden = false;
    const { data: parts } = await sb.from('conversation_participants').select('user_id, profiles!conversation_participants_user_id_fkey(display_name)').eq('conversation_id', convId);
    for (const p of parts ?? []) names.set(p.user_id, p.profiles?.display_name);
    await loadOlder();
    markRead();
    // tempo real: o servidor só entrega linhas que a RLS permite a este usuário ler
    channel = sb.channel(`conv:${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, (payload) => { append([payload.new]); markRead(); })
      .subscribe();
    poll = setInterval(fetchNew, 15000);
    history.replaceState(null, '', `/mensagens?c=${convId}`);
  }

  $('#conversas').addEventListener('click', (ev) => { const b = ev.target.closest('[data-conv]'); if (b) open(b.dataset.conv); });
  thread.addEventListener('click', async (ev) => {
    if (ev.target.id === 'mais-antigas') return loadOlder();
    const f = ev.target.closest('[data-file]');
    if (!f) return undefined;
    // link temporário (5 min), gerado só para participantes da conversa
    const { data, error: err } = await sb.storage.from('chat-attachments').createSignedUrl(f.dataset.file, 300, { download: f.dataset.name });
    if (err || !data?.signedUrl) return showNotice(aviso, 'error', 'Não foi possível abrir o arquivo.');
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = f.dataset.name; a.rel = 'noopener'; a.target = '_blank';
    document.body.append(a); a.click(); a.remove();
    return undefined;
  });

  $('#arquivo').addEventListener('change', async (ev) => {
    for (const file of ev.target.files) {
      if (pending.length >= 5) { showNotice(aviso, 'warn', 'No máximo 5 arquivos por mensagem.'); break; }
      if (file.size > MAX_FILE) { showNotice(aviso, 'error', `"${file.name}" passa de 20 MB.`); continue; }
      const kind = await fileKind(file);
      if (!kind) { showNotice(aviso, 'error', `"${file.name}" não é um tipo de arquivo aceito (imagem, PDF, planilha, documento ou texto).`); continue; }
      pending.push({ file, kind });
    }
    ev.target.value = '';
    drawPending();
  });
  $('#pendentes').addEventListener('click', (ev) => { const r = ev.target.closest('[data-remove]'); if (r) { pending.splice(Number(r.dataset.remove), 1); drawPending(); } });

  $('#texto').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('#enviar').requestSubmit(); } });
  $('#enviar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = $('#texto').value.trim();
    if ((!body && !pending.length) || !current) return;
    if (body && looksLikeContact(body) && !confirm('Parece que a mensagem tem telefone, e-mail ou rede social. Isso é proibido e pode suspender a sua conta. Enviar mesmo assim?')) return;
    const btn = ev.submitter ?? $('#enviar button');
    btn.disabled = true;
    const attachments = [];
    for (const p of pending) {
      const path = `${current}/${uid}/${crypto.randomUUID()}.${p.kind.ext}`;
      const up = await sb.storage.from('chat-attachments').upload(path, await p.file.arrayBuffer(), { contentType: p.kind.mime, upsert: false });
      if (up.error) { btn.disabled = false; return showNotice(aviso, 'error', `Não foi possível enviar "${p.file.name}".`); }
      attachments.push({ path, name: p.file.name.slice(0, 120), size: p.file.size, mime: p.kind.mime });
    }
    const { data, error: err } = await sb.from('messages').insert({ conversation_id: current, sender_id: uid, body: body || null, attachments }).select(SELECT).single();
    btn.disabled = false;
    if (err) return showNotice(aviso, 'error', rpcMessage(err, 'Não foi possível enviar a mensagem.'));
    aviso.hidden = true;
    $('#texto').value = ''; pending = []; drawPending();
    append([data]);
  });

  const wanted = new URLSearchParams(location.search).get('c');
  if (wanted && convs.some((m) => m.conversation_id === wanted)) open(wanted);
  else if (convs.length === 1) open(convs[0].conversation_id);
})();
