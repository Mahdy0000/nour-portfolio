/* Local mirror server for the forged.build clone.
   Serves the static site and provides POST /visit, whose binary response the Aura
   Runtime hands straight to the scene bootstrap. Without a well-formed payload the
   WASM aborts with "Unsafe runtime: content key truncated" and the scene never boots.

   The payload is issued by the origin together with a `forged_visit_token` cookie.
   We relay it live, cache it to disk so the clone still boots offline, and hand the
   matching cookie to the browser so the local session mirrors the remote one. */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;
const UPSTREAM = process.env.UPSTREAM || 'https://forged.build';
const SESSION_FILE = path.join(ROOT, '.visit-session.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.aura': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

/* ---------------------------------------------------------------- session --- */

function loadSession() {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    if (s && s.payloadB64 && s.cookie) return s;
  } catch { /* no cache yet */ }
  return null;
}

function saveSession(session) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session));
  } catch { /* cache is best-effort */ }
}

function sessionCookieHeader(session) {
  if (!session || !session.cookie) return null;
  const value = session.cookie.split(';')[0];
  // Not Secure: the clone is served over plain http on localhost.
  return `${value}; Path=/; SameSite=Lax; Max-Age=86400`;
}

/* --------------------------------------------------------------- upstream --- */

function request(url, { method = 'GET', headers = {}, body = null, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const h = { 'User-Agent': UA, ...headers };
    if (body) h['Content-Length'] = Buffer.byteLength(body);
    const r = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers: h
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    r.on('error', reject);
    r.on('timeout', () => {
      r.destroy(new Error('upstream timeout'));
    });
    if (body) r.write(body);
    r.end();
  });
}

async function requestFollow(url, opts = {}, depth = 0) {
  const res = await request(url, opts);
  if ([301, 302, 307, 308].includes(res.status) && res.headers.location && depth < 5) {
    const next = new URL(res.headers.location, url).toString();
    return requestFollow(next, opts, depth + 1);
  }
  return res;
}

function pickCookie(setCookie) {
  if (!setCookie) return null;
  const hit = setCookie.find((c) => c.startsWith('forged_visit_token='));
  return hit ? hit.split(';')[0] : null;
}

/* Fetch a fresh origin session: the landing page hands out the visit cookie. */
async function upstreamSession() {
  const page = await requestFollow(UPSTREAM + '/', {
    headers: { Referer: UPSTREAM + '/' }
  });
  let cookie = pickCookie(page.headers['set-cookie']);
  if (!cookie && loadSession()) cookie = loadSession().cookie;
  if (!cookie) throw new Error('origin issued no forged_visit_token cookie');

  const body = JSON.stringify({ t: Date.now() });
  const visit = await requestFollow(UPSTREAM + '/visit', {
    method: 'POST',
    headers: {
      Referer: UPSTREAM + '/',
      Origin: UPSTREAM,
      'Content-Type': 'application/json',
      Cookie: cookie
    },
    body
  });
  const payload = visit.body;
  // The runtime only accepts a real "AKEY" blob; anything else wedges the boot.
  if (visit.status !== 200 || payload.length < 20 || payload.slice(0, 4).toString('latin1') !== 'AKEY') {
    throw new Error(`origin /visit returned ${visit.status} (${payload.length} bytes)`);
  }
  const refreshed = pickCookie(visit.headers['set-cookie']) || cookie;
  const session = { cookie: refreshed, payloadB64: payload.toString('base64'), savedAt: Date.now() };
  saveSession(session);
  return session;
}

/* ------------------------------------------------------------ visit token --- */

let inflight = null;

/* The origin issues the /visit token together with a forged_visit_token cookie,
   and the scene only boots with a valid pair — so a fresh session is fetched
   per request and the cached copy is only a fallback for offline use. */
async function visitSession() {
  const cached = loadSession();
  if (inflight) return inflight;
  inflight = upstreamSession()
    .catch(() => cached)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/* ---------------------------------------------------------------- static --- */

function serveFile(req, res, filePath, extraHeaders = {}) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + filePath);
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    // Media elements ask for byte ranges; answer with 206 so seeking works.
    const range = req.headers.range;
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        ...extraHeaders
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    res.writeHead(
      200,
      {
        'Content-Type': type,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        ...extraHeaders
      }
    );
    fs.createReadStream(filePath).pipe(res);
  });
}

/* Pull any asset the scene asks for that we do not have yet, and keep it on disk. */
function mirrorAsset(pathname, filePath) {
  return requestFollow(UPSTREAM + pathname, {
    headers: { Referer: UPSTREAM + '/' },
    timeout: 60000
  })
    .then((res) => {
      if (res.status !== 200 || !res.body.length) return false;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFile(filePath, res.body, () => true);
    })
    .catch(() => false);
}

/* The scene asks the origin's shader cache whether a compiled pipeline is already
   cached. That endpoint rejects requests without the visit cookie, so we forward
   ours along and hand the answer straight back. Answers are cached on disk so the
   clone keeps working offline and does not hammer the origin. */
const SHADER_CACHE_DIR = path.join(ROOT, '.shadercache');

function proxyShaderCache(req, res, pathname) {
  const key = decodeURIComponent(pathname.split('/').pop() || '');
  const cacheFile = path.join(SHADER_CACHE_DIR, key + '.json');

  fs.readFile(cacheFile, 'utf8', (err, body) => {
    if (!err && body) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store'
      });
      res.end(body);
      return;
    }
    fetchShaderCache(pathname).then((up) => {
      if (up.status === 200) {
        fs.mkdirSync(SHADER_CACHE_DIR, { recursive: true });
        fs.writeFile(cacheFile, up.body, () => { });
      }
      res.writeHead(up.status, {
        'Content-Type': up.headers['content-type'] || 'application/json',
        'Content-Length': up.body.length,
        'Cache-Control': 'no-store'
      });
      res.end(up.body);
    });
  });
}

/* The origin resets bursts of parallel connections, so retry a couple of times. */
async function fetchShaderCache(pathname, attempts = 2) {
  const session = loadSession();
  const headers = { Referer: UPSTREAM + '/', 'Content-Type': 'application/json' };
  if (session && session.cookie) headers.Cookie = session.cookie;
  for (let i = 0; i < attempts; i++) {
    try {
      const up = await requestFollow(UPSTREAM + pathname, { method: 'GET', headers, timeout: 6000 });
      if (up.status !== 502 && up.status !== 503) return up;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  // A clean miss lets the scene compile the shader locally instead of erroring.
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from('{"success":false,"miss":true}')
  };
}

/* ------------------------------------------------------------------ server --- */

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const decoded = decodeURIComponent(pathname);

    if (req.method === 'POST' && decoded === '/visit') {
      visitSession()
        .then((session) => {
          const payload = session ? Buffer.from(session.payloadB64, 'base64') : null;
          if (!payload || payload.length < 20) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'no visit token available' }));
            return;
          }
          const headers = {
            'Content-Type': 'application/octet-stream',
            'Content-Length': payload.length,
            'Cache-Control': 'no-store'
          };
          const cookie = sessionCookieHeader(session);
          if (cookie) headers['Set-Cookie'] = cookie;
          res.writeHead(200, headers);
          res.end(payload);
        })
        .catch(() => {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'no visit token available' }));
        });
      return;
    }

    const session = loadSession();
    const cookie = sessionCookieHeader(session);

    if (decoded.startsWith('/shaderCache/')) {
      proxyShaderCache(req, res, req.url);
      return;
    }

    if (decoded === '/') {
      serveFile(req, res, path.join(ROOT, 'index.html'), cookie ? { 'Set-Cookie': cookie } : {});
      return;
    }

    const filePath = path.join(ROOT, decoded);
    if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) {
        serveFile(req, res, filePath, cookie ? { 'Set-Cookie': cookie } : {});
        return;
      }
      if (req.method === 'GET' && decoded.startsWith('/assets/')) {
        mirrorAsset(decoded, filePath).then((ok) => {
          if (!ok) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found: ' + decoded);
            return;
          }
          serveFile(req, res, filePath);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + decoded);
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log('forged.build clone -> http://127.0.0.1:' + PORT + '/');
  });
