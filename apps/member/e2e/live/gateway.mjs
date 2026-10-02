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
  if (p === '/auth/v1/signup') {
    const { email, password, data } = await readBody(req);
    if (users.has(email)) return json(res, 422, { msg: 'User already registered', error_code: 'user_already_exists' });
    const id = crypto.randomUUID();
    psql(`insert into auth.users (id, email, raw_user_meta_data) values ('${id}', '${email}', '${JSON.stringify(data || {}).replace(/'/g, "''")}')`);
    users.set(email, { id, password, confirmed: false });
    return json(res, 200, userObj(id, email));
  }
  if (p === '/auth/v1/verify') {
    const { email, token } = await readBody(req);
    const u = users.get(email);
    if (!u || token !== '123456') return json(res, 403, { msg: 'Token has expired or is invalid', error_code: 'otp_expired' });
    u.confirmed = true;
    return json(res, 200, session(u.id, email));
  }
  if (p === '/auth/v1/token') {
    const { email, password } = await readBody(req);
    const u = users.get(email);
    if (!u || u.password !== password || !u.confirmed) return json(res, 400, { msg: 'Invalid login credentials', error_code: 'invalid_credentials' });
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
