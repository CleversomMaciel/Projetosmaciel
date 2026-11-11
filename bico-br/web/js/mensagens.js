import { $, esc, fmtDateTime, getClient, mountChrome, requireSession, rpcMessage, showNotice } from './core.js';

mountChrome();
const PAGE = 30;
const aviso = $('#aviso');
const thread = $('#thread');

(async () => {
  const session = await requireSession();
  const uid = session.user.id;
  const { sb } = await getClient();
  let current = null; let oldest = null; let newest = 0; let channel = null; let poll = null;
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
  }).join('') || '<li class="px-4 py-3 text-tinta-500">Nenhuma conversa ainda. Elas começam a partir de uma proposta ou de um contrato.</li>';

  const bubble = (m) => `<div class="flex ${m.sender_id === uid ? 'justify-end' : ''}" data-id="${m.id}">
    <div class="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.sender_id === uid ? 'bg-mata-600 text-white' : 'bg-areia'}">
      <span class="block text-xs opacity-70">${esc(m.sender_id === uid ? 'Você' : names.get(m.sender_id) ?? 'Participante')} · ${fmtDateTime(m.created_at)}</span>
      <span class="whitespace-pre-line break-words">${esc(m.body)}</span></div></div>`;
  const append = (rows) => {
    for (const m of rows) {
      if (m.id <= newest) continue; // evita duplicar o que chegou por tempo real e por consulta
      thread.insertAdjacentHTML('beforeend', bubble(m));
      newest = m.id;
    }
    thread.scrollTop = thread.scrollHeight;
  };
  const markRead = () => sb.from('conversation_participants').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', current).eq('user_id', uid);

  async function loadOlder() {
    let q = sb.from('messages').select('id, sender_id, body, created_at').eq('conversation_id', current).order('id', { ascending: false }).limit(PAGE + 1);
    if (oldest) q = q.lt('id', oldest);
    const { data } = await q;
    const rows = (data ?? []).slice(0, PAGE);
    $('#mais-antigas')?.remove();
    if (!rows.length) return;
    const first = !oldest;
    oldest = rows.at(-1).id;
    const html = rows.slice().reverse().map(bubble).join('');
    const before = thread.scrollHeight;
    thread.insertAdjacentHTML('afterbegin', html);
    if ((data ?? []).length > PAGE) thread.insertAdjacentHTML('afterbegin', '<div class="text-center"><button id="mais-antigas" class="linkish text-xs" type="button">Carregar mensagens anteriores</button></div>');
    if (first) { newest = rows[0].id; thread.scrollTop = thread.scrollHeight; } else thread.scrollTop = thread.scrollHeight - before;
  }
  async function fetchNew() {
    const { data } = await sb.from('messages').select('id, sender_id, body, created_at').eq('conversation_id', current).gt('id', newest).order('id').limit(100);
    if (data?.length) { append(data); markRead(); }
  }

  async function open(convId) {
    if (channel) sb.removeChannel(channel);
    clearInterval(poll);
    current = convId; oldest = null; newest = 0;
    thread.innerHTML = '';
    const conv = convs.find((m) => m.conversation_id === convId);
    $('#topo').textContent = conv?.conversations.projects?.title ?? 'Conversa';
    $('#enviar').hidden = false;
    const { data: parts } = await sb.from('conversation_participants').select('user_id, profiles(display_name)').eq('conversation_id', convId);
    for (const p of parts ?? []) names.set(p.user_id, p.profiles?.display_name);
    await loadOlder();
    markRead();
    // tempo real: o servidor só entrega linhas que a RLS permite a este usuário ler
    channel = sb.channel(`conv:${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, (payload) => { append([payload.new]); markRead(); })
      .subscribe();
    poll = setInterval(fetchNew, 15000); // rede de segurança se o tempo real cair
    history.replaceState(null, '', `/mensagens?c=${convId}`);
  }

  $('#conversas').addEventListener('click', (ev) => { const b = ev.target.closest('[data-conv]'); if (b) open(b.dataset.conv); });
  thread.addEventListener('click', (ev) => { if (ev.target.id === 'mais-antigas') loadOlder(); });
  $('#texto').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('#enviar').requestSubmit(); } });
  $('#enviar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = $('#texto').value.trim();
    if (!body || !current) return;
    const btn = ev.submitter ?? $('#enviar button');
    btn.disabled = true;
    const { data, error: err } = await sb.from('messages').insert({ conversation_id: current, sender_id: uid, body }).select('id, sender_id, body, created_at').single();
    btn.disabled = false;
    if (err) return showNotice(aviso, 'error', rpcMessage(err, 'Não foi possível enviar a mensagem.'));
    aviso.hidden = true;
    $('#texto').value = '';
    append([data]);
  });

  const wanted = new URLSearchParams(location.search).get('c');
  if (wanted && convs.some((m) => m.conversation_id === wanted)) open(wanted);
  else if (convs.length === 1) open(convs[0].conversation_id);
})();
