// Gateway de TESTE: imita o mínimo do Supabase (Auth + REST via PostgREST) e os serviços
// externos (ViaCEP, BrasilAPI, Mercado Pago). Não é código de produção.
import http from 'node:http';
import crypto from 'node:crypto';

const { PORT, PGRST_URL, JWT_SECRET, APP_URL, MP_WEBHOOK_SECRET } = process.env;
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function signJwt(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...payload });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, p, s] = String(token || '').split('.');
  if (!s) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  return payload.exp > Date.now() / 1000 ? payload : null;
}
const SERVICE = signJwt({ role: 'service_role' });
const rpc = async (fn, args) => {
  const r = await fetch(`${PGRST_URL}/rpc/${fn}`, { method: 'POST', headers: { authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
};
const readBody = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });
const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };

function sessionFor(u) {
  const now = Math.floor(Date.now() / 1000);
  const aal = u.admin ? 'aal2' : 'aal1'; // admins de teste já entram com 2º fator verificado
  const user = {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.meta, app_metadata: {},
    factors: u.admin ? [{ id: 'f1', factor_type: 'totp', status: 'verified' }] : [],
    created_at: new Date().toISOString(),
  };
  const access_token = signJwt({ sub: u.id, role: 'authenticated', email: u.email, aal, amr: [{ method: 'password', timestamp: now }, ...(u.admin ? [{ method: 'totp', timestamp: now }] : [])], session_id: crypto.randomUUID() });
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `r.${u.id}`, user };
}

const mp = { prefs: new Map(), payments: new Map(), seq: 9000 };
const files = new Map(); // armazenamento de teste (bucket ads)

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

    if (path.startsWith('/rest/v1')) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
      const headers = { ...req.headers };
      for (const h of ['host', 'content-length', 'connection', 'accept-encoding']) delete headers[h];
      if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
      const r = await fetch(`${PGRST_URL}${path.slice(8)}${url.search}`, { method: req.method, headers, body });
      const out = { ...CORS };
      for (const h of ['content-type', 'content-range', 'location', 'preference-applied']) if (r.headers.get(h)) out[h] = r.headers.get(h);
      res.writeHead(r.status, out);
      return res.end(Buffer.from(await r.arrayBuffer()));
    }

    if (path === '/auth/v1/signup' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)).toString());
      if (String(b.password || '').length < 8) return send(res, 422, { msg: 'weak password' }, CORS);
      const id = await rpc('e2e_signup', { p_email: b.email, p_password: b.password, p_meta: b.data ?? {} });
      return send(res, 200, sessionFor({ id, email: b.email, meta: b.data ?? {} }), CORS);
    }
    if (path === '/auth/v1/token' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)).toString());
      let u = null;
      if (url.searchParams.get('grant_type') === 'password') u = await rpc('e2e_login', { p_email: b.email, p_password: b.password });
      else if (String(b.refresh_token || '').startsWith('r.')) u = await rpc('e2e_user', { p_id: b.refresh_token.slice(2) });
      if (!u) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, CORS);
      return send(res, 200, sessionFor(u), CORS);
    }
    if (path === '/auth/v1/user') {
      const claims = verifyJwt((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!claims?.sub) return send(res, 401, { msg: 'invalid JWT' }, CORS);
      const u = await rpc('e2e_user', { p_id: claims.sub });
      return u ? send(res, 200, sessionFor(u).user, CORS) : send(res, 401, { msg: 'no user' }, CORS);
    }
    if (path === '/auth/v1/logout') { res.writeHead(204, CORS); return res.end(); }

    // ---------------- Storage de TESTE: imita as políticas reais de cada bucket
    let sm;
    const IMG = ['image/png', 'image/jpeg', 'image/webp'];
    const DOCS = [...IMG, 'application/pdf', 'text/plain', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
    const isParticipant = async (conv, uid) => {
      const r = await fetch(`${PGRST_URL}/conversation_participants?conversation_id=eq.${conv}&user_id=eq.${uid}&select=user_id`, { headers: { authorization: `Bearer ${bearer}` } });
      return r.ok && (await r.json()).length === 1;
    };
    if ((sm = path.match(/^\/storage\/v1\/object\/(ads|portfolio-public|chat-attachments)\/(.+)$/)) && req.method === 'POST') {
      const [, bucket, key] = sm;
      const claims = verifyJwt(bearer);
      const deny = () => send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, CORS);
      if (!claims?.sub) return deny();
      const type = req.headers['content-type'] || '';
      if (bucket === 'ads') {
        const u = await rpc('e2e_user', { p_id: claims.sub });
        if (!u?.admin || claims.aal !== 'aal2') return deny();
      } else if (bucket === 'portfolio-public') {
        if (key.split('/')[0] !== claims.sub) return deny();
      } else if (key.split('/')[1] !== claims.sub || !(await isParticipant(key.split('/')[0], claims.sub))) return deny();
      if (!(bucket === 'chat-attachments' ? DOCS : IMG).includes(type)) return send(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: 'mime type not supported' }, CORS);
      const body = await readBody(req);
      if (body.length > (bucket === 'chat-attachments' ? 20971520 : 5242880)) return send(res, 413, { statusCode: '413', error: 'Payload too large' }, CORS);
      files.set(`${bucket}/${key}`, { type, body });
      return send(res, 200, { Key: `${bucket}/${key}`, Id: crypto.randomUUID() }, CORS);
    }
    if ((sm = path.match(/^\/storage\/v1\/object\/public\/(ads|portfolio-public)\/(.+)$/))) {
      const f = files.get(`${sm[1]}/${sm[2]}`);
      if (!f) return send(res, 404, { message: 'not found' }, CORS);
      res.writeHead(200, { 'content-type': f.type, 'x-content-type-options': 'nosniff', ...CORS });
      return res.end(f.body);
    }
    // anexos do chat: privados; link temporário só para participantes da conversa
    if ((sm = path.match(/^\/storage\/v1\/object\/sign\/chat-attachments\/(.+)$/)) && req.method === 'POST') {
      const claims = verifyJwt(bearer);
      if (!claims?.sub || !(await isParticipant(sm[1].split('/')[0], claims.sub)) || !files.has(`chat-attachments/${sm[1]}`)) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' }, CORS);
      const token = signJwt({ url: `chat-attachments/${sm[1]}`, exp: Math.floor(Date.now() / 1000) + 300 });
      return send(res, 200, { signedURL: `/object/sign/chat-attachments/${sm[1]}?token=${token}` }, CORS);
    }
    if ((sm = path.match(/^\/storage\/v1\/object\/sign\/chat-attachments\/(.+)$/)) && req.method === 'GET') {
      const claims = verifyJwt(url.searchParams.get('token'));
      const f = claims?.url === `chat-attachments/${sm[1]}` ? files.get(claims.url) : null;
      if (!f) return send(res, 400, { message: 'invalid token' }, CORS);
      res.writeHead(200, { 'content-type': f.type, 'content-disposition': 'attachment', 'x-content-type-options': 'nosniff', ...CORS });
      return res.end(f.body);
    }

    if (path === '/fake/make-admin') { await rpc('e2e_make_admin', { p_email: url.searchParams.get('email'), p_role: url.searchParams.get('role') }); return send(res, 200, { ok: true }); }
    if (path === '/fake/tokens') return send(res, 200, { anon: signJwt({ role: 'anon' }), service: SERVICE });

    let m;
    if ((m = path.match(/^\/fake\/viacep\/ws\/(\d{8})\/json\/$/))) {
      if (m[1] === '99999999') return send(res, 200, { erro: true });
      return send(res, 200, { cep: `${m[1].slice(0, 5)}-${m[1].slice(5)}`, logradouro: 'Praça da Sé', complemento: 'lado ímpar', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', ibge: '3550308' });
    }
    if ((m = path.match(/^\/fake\/brasilapi\/api\/cnpj\/v1\/([0-9A-Z]{14})$/))) {
      return send(res, 200, {
        cnpj: m[1], razao_social: 'ACME TECNOLOGIA LTDA', nome_fantasia: 'Acme Tech', descricao_situacao_cadastral: 'ATIVA',
        data_inicio_atividade: '2019-03-11', natureza_juridica: 'Sociedade Empresária Limitada', porte: 'MICRO EMPRESA',
        cnae_fiscal: 6201501, cnae_fiscal_descricao: 'Desenvolvimento de programas de computador sob encomenda', cnaes_secundarios: [],
        descricao_tipo_de_logradouro: 'AVENIDA', logradouro: 'PAULISTA', numero: '1000', complemento: 'CJ 101', bairro: 'BELA VISTA',
        municipio: 'SAO PAULO', uf: 'SP', cep: '01310100', ddd_telefone_1: '1130000000', email: 'CONTATO@ACME.EXAMPLE', codigo_municipio_ibge: 3550308,
        qsa: [{ nome_socio: 'SOCIO QUE NAO DEVE APARECER' }],
      });
    }

    if (path === '/fake/mp/checkout/preferences' && req.method === 'POST') {
      if (req.headers.authorization !== 'Bearer TEST-TOKEN') return send(res, 401, { message: 'unauthorized' });
      const b = JSON.parse((await readBody(req)).toString());
      const id = `pref-${crypto.randomUUID()}`;
      mp.prefs.set(id, b);
      return send(res, 201, { id, init_point: `http://127.0.0.1:${PORT}/fake/mp/pay?pref=${id}` });
    }
    if (path === '/fake/mp/pay') {
      // o "comprador" abriu o checkout: aprova, dispara o webhook ASSINADO e volta para o site
      const pref = mp.prefs.get(url.searchParams.get('pref'));
      if (!pref) return send(res, 404, { message: 'pref' });
      const id = String(mp.seq += 1);
      mp.payments.set(id, { id: Number(id), status: 'approved', status_detail: 'accredited', transaction_amount: pref.items[0].unit_price, currency_id: 'BRL', external_reference: pref.external_reference });
      const ts = String(Date.now()); const requestId = crypto.randomUUID();
      const v1 = crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
      const hook = await fetch(`${APP_URL}/api/webhooks/mercadopago?data.id=${id}&type=payment`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${v1}` },
        body: JSON.stringify({ type: 'payment', action: 'payment.created', data: { id } }),
      });
      if (!hook.ok) return send(res, 500, { message: `webhook ${hook.status}` });
      res.writeHead(302, { location: pref.back_urls.success });
      return res.end();
    }
    if ((m = path.match(/^\/fake\/mp\/v1\/payments\/(\d+)$/))) {
      const p = mp.payments.get(m[1]);
      return p ? send(res, 200, p) : send(res, 404, { message: 'not found' });
    }
    return send(res, 404, { message: 'gateway: rota desconhecida', path }, CORS);
  } catch (err) {
    console.error('gateway', path, err);
    return send(res, 500, { message: String(err.message) }, CORS);
  }
}).listen(Number(PORT), '127.0.0.1', () => console.log(`gateway de teste em :${PORT}`));
