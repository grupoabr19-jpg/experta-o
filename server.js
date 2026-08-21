const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { rankingFromCsv } = require('./csv-ranking-sheets');

const root = __dirname;
const publicDir = fs.existsSync(path.join(root, 'dist')) ? path.join(root, 'dist') : path.join(root, 'public');
const rankingFile = path.join(root, 'data', 'ranking.json');
const port = Number(process.env.PORT || 3000);
const mode = ['mock', 'manual', 'api'].includes(process.env.SALES_DATA_MODE) ? process.env.SALES_DATA_MODE : 'mock';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif' };

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function readRanking() {
  return JSON.parse(fs.readFileSync(rankingFile, 'utf8'));
}

function validRanking(input) {
  const teams = input?.teams || input?.regions;
  return input && typeof input.period === 'string' && Array.isArray(teams) && Array.isArray(input.sellers) && [...teams, ...input.sellers].every(item => item && typeof item.name === 'string');
}

async function getRanking() {
  if (mode !== 'api') return { ...readRanking(), source: mode };
  if (!process.env.SALES_DATA_URL) throw new Error('SALES_DATA_URL não configurada');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(process.env.SALES_DATA_URL, { signal: controller.signal, headers: process.env.ASTER_AUTH_TOKEN ? { Authorization: `Bearer ${process.env.ASTER_AUTH_TOKEN.replace(/^Bearer\s+/i, '')}` } : {} });
    if (!response.ok) throw new Error(`Fonte externa respondeu ${response.status}`);
    const raw = await response.text();
    const data = raw.trim().startsWith('{') ? JSON.parse(raw) : rankingFromCsv(raw);
    if (!validRanking(data)) throw new Error('Contrato de ranking inválido');
    return { ...data, source: 'api' };
  } finally { clearTimeout(timer); }
}

function authorized(req) {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 250000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}

function serveFile(req, res) {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (requested === '/expertaço.png') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
    return fs.createReadStream(path.join(root, 'expertaço.png')).pipe(res);
  }
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const candidate = path.resolve(publicDir, relative);
  if (!candidate.startsWith(path.resolve(publicDir)) || !fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    const index = path.join(publicDir, 'index.html');
    res.writeHead(200, { 'Content-Type': mime['.html'] }); return fs.createReadStream(index).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(candidate)] || 'application/octet-stream', 'Cache-Control': candidate.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(candidate).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') return send(res, 200, { status: 'ok', mode, timestamp: new Date().toISOString() });
  if (url.pathname === '/api/ranking' && req.method === 'GET') {
    try { return send(res, 200, await getRanking()); }
    catch (error) { return send(res, 502, { error: 'Não foi possível atualizar o ranking.', fallbackAvailable: true }); }
  }
  if (url.pathname === '/api/ranking/manual' && req.method === 'POST') {
    if (!authorized(req)) return send(res, 401, { error: 'Não autorizado.' });
    if (mode !== 'manual') return send(res, 409, { error: 'O modo manual não está ativo.' });
    try {
      const body = await parseBody(req);
      if (!validRanking(body)) return send(res, 400, { error: 'Dados de ranking inválidos.' });
      const saved = { ...body, updatedAt: new Date().toISOString() };
      fs.writeFileSync(rankingFile, JSON.stringify(saved, null, 2));
      return send(res, 200, { ...saved, source: 'manual' });
    } catch { return send(res, 400, { error: 'Não foi possível processar os dados.' }); }
  }
  if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Endpoint não encontrado.' });
  serveFile(req, res);
});

if (require.main === module) server.listen(port, '0.0.0.0', () => console.log(`Playbook ABR disponível na porta ${port}`));
module.exports = { server, validRanking };
