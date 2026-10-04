// Local stand-in for the Supabase gateway: /rest/v1 → PostgREST, /auth/v1 → a minimal fake GoTrue.
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import http from 'node:http';

const SECRET = 'packpass-local-test-secret-0123456789abcdef';
const DB = process.env.DB || 'packpass_api';
const PG = ['-h', process.env.PGHOST || '/tmp', '-p', process.env.PGPORT || '5432', '-U', process.env.PGUSER || 'postgres', '-d', DB];
const users = new Map(); // email -> { id, password, confirmed }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (claims) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' }), body = b64(claims);
  return `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
};
const psql = (sql) => execFileSync('psql', [...PG, '-Atqc', sql]).toString().trim();
const userObj = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
const session = (id, email) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: sign({ sub: id, role: 'authenticated', aud: 'authenticated', email, exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + id, user: userObj(id, email) };
};
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d ? JSON.parse(d) : {})); });

// ---- Storage stand-in --------------------------------------------------------------------------
// Bytes live in memory; every object row goes through storage.objects as the signed-in member, so the
// bucket policies in the migrations decide what's allowed, as they do in Supabase Storage.
const files = new Map(); // "bucket/path" -> Buffer
const tokens = new Map(); // signed URL token -> "bucket/path"
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const subOf = (req) => {
  try { return JSON.parse(Buffer.from(((req.headers.authorization || '').split(' ')[1] || '').split('.')[1], 'base64url').toString()).sub; } catch { return null; }
};
// psql prints each statement's result; the last line is the query's.
const asMember = (sub, sql) => psql(`set role authenticated; select set_config('request.jwt.claim.sub', ${q(sub)}, false); ${sql}`).split('\n').pop();
const readRaw = (req) => new Promise((r) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => r(Buffer.concat(ch))); });

async function storage(req, res, p, url) {
  const sub = subOf(req);
  const signed = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
  if (req.method === 'GET' && signed) {
    const key = tokens.get(url.searchParams.get('token'));
    if (key !== `${signed[1]}/${decodeURIComponent(signed[2])}` || !files.has(key)) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    return res.end(files.get(key));
  }
  if (!sub) return json(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'invalid JWT' });
  const sign = p.match(/^\/object\/sign\/([^/]+)$/);
  if (req.method === 'POST' && sign) {
    const { paths } = await readBody(req);
    return json(res, 200, paths.map((path) => {
      const ok = asMember(sub, `select count(*) from storage.objects where bucket_id = ${q(sign[1])} and name = ${q(path)}`) === '1';
      if (!ok) return { path, error: 'Either the object does not exist or you do not have access to it', signedURL: null };
      const token = crypto.randomUUID();
      tokens.set(token, `${sign[1]}/${path}`);
      return { path, error: null, signedURL: `/object/sign/${sign[1]}/${path}?token=${token}` };
    }));
  }
  const obj = p.match(/^\/object\/([^/]+)\/(.+)$/);
  if (obj) obj[2] = decodeURIComponent(obj[2]); // stored by the decoded name, as Supabase Storage does
  if (req.method === 'POST' && obj) {
    const body = await readRaw(req);
    try {
      asMember(sub, `insert into storage.objects (bucket_id, name, owner) values (${q(obj[1])}, ${q(obj[2])}, ${q(sub)})`);
    } catch {
      return json(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    }
    files.set(`${obj[1]}/${obj[2]}`, body);
    return json(res, 200, { Key: `${obj[1]}/${obj[2]}`, Id: crypto.randomUUID() });
  }
  const bucket = p.match(/^\/object\/([^/]+)$/);
  if (req.method === 'DELETE' && bucket) {
    const { prefixes } = await readBody(req);
    const gone = asMember(sub, `with d as (delete from storage.objects where bucket_id = ${q(bucket[1])} and name in (${prefixes.map(q).join(', ')}) returning name) select coalesce(string_agg(name, ','), '') from d`);
    const names = gone ? gone.split(',') : [];
    names.forEach((n) => files.delete(`${bucket[1]}/${n}`));
    return json(res, 200, names.map((name) => ({ name, bucket_id: bucket[1] })));
  }
  json(res, 404, { msg: 'not found ' + p });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/rest/v1')) {
    const target = 'http://127.0.0.1:3011' + url.pathname.slice('/rest/v1'.length) + url.search;
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((r) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => r(Buffer.concat(ch))); });
    const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
    const r = await fetch(target, { method: req.method, headers, body });
    res.writeHead(r.status, Object.fromEntries([...r.headers].filter(([k]) => !['content-encoding', 'transfer-encoding', 'content-length'].includes(k))));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const p = url.pathname;
  if (p.startsWith('/storage/v1/')) return storage(req, res, p.slice('/storage/v1'.length), url);
  if (p === '/auth/v1/signup') {
    const { email, password, data } = await readBody(req);
    // Like GoTrue with email confirmation on: a confirmed email gets a stand-in user with no identities and
    // no email; an unconfirmed one gets the code again.
    if (users.has(email)) return json(res, 200, { ...userObj(users.get(email).id, email), identities: users.get(email).confirmed ? [] : [{ provider: 'email' }] });
    const id = crypto.randomUUID();
    psql(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ('${id}', '${email}', '${JSON.stringify(data || {}).replace(/'/g, "''")}', null)`);
    users.set(email, { id, password, confirmed: false });
    return json(res, 200, { ...userObj(id, email), identities: [{ provider: 'email' }] });
  }
  if (p === '/auth/v1/verify') {
    const { email, token } = await readBody(req);
    const u = users.get(email);
    if (!u || token !== '123456') return json(res, 403, { msg: 'Token has expired or is invalid', error_code: 'otp_expired' });
    if (!u.confirmed) psql(`update auth.users set email_confirmed_at = now() where id = '${u.id}'`);
    u.confirmed = true;
    return json(res, 200, session(u.id, email));
  }
  if (p === '/auth/v1/token') {
    const { email, password } = await readBody(req);
    const u = users.get(email);
    if (u && u.password === password && !u.confirmed) return json(res, 400, { msg: 'Email not confirmed', error_code: 'email_not_confirmed' });
    if (!u || u.password !== password) return json(res, 400, { msg: 'Invalid login credentials', error_code: 'invalid_credentials' });
    return json(res, 200, session(u.id, email));
  }
  if (p === '/auth/v1/recover') {
    await readBody(req); // Always 200, like GoTrue, so it doesn't reveal which emails have accounts.
    return json(res, 200, {});
  }
  if (p === '/auth/v1/user' && req.method === 'PUT') {
    const tok = (req.headers.authorization || '').split(' ')[1] || '';
    const claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
    const { password } = await readBody(req);
    if (!password || password.length < 8) return json(res, 422, { msg: 'Password should be at least 8 characters.', error_code: 'weak_password' });
    users.get(claims.email).password = password;
    return json(res, 200, userObj(claims.sub, claims.email));
  }
  if (p === '/auth/v1/user') {
    const tok = (req.headers.authorization || '').split(' ')[1] || '';
    try {
      const claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
      if (claims.role !== 'authenticated') throw 0;
      return json(res, 200, userObj(claims.sub, claims.email));
    } catch { return json(res, 401, { msg: 'invalid JWT' }); }
  }
  if (p === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
  if (p === '/auth/v1/resend') return json(res, 200, {});
  json(res, 404, { msg: 'not found ' + p });
}).listen(54399, () => console.log('gateway on 54399'));
