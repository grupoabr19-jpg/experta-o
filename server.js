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

const ideaRecipients = {
  to: 'grupoabr19@gmail.com',
  cc: ['thiago.almeida@grupoabr.com.br', 'marcelo.silva@grupoabr.com.br', 'anderson.silva@grupoabr.com.br', 'pietra.leite@grupoabr.com.br']
};
const ideaRateLimit = new Map();
const cleanText = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);

function ideaMailTransport() {
  const user = process.env.IDEAACO_EMAIL_USER;
  const pass = process.env.IDEAACO_EMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({ service:'gmail', auth:{ user, pass } });
}

function ideaRequestAllowed(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const recent = (ideaRateLimit.get(ip) || []).filter(timestamp => now - timestamp < 10 * 60 * 1000);
  if (recent.length >= 3) return false;
  recent.push(now); ideaRateLimit.set(ip, recent); return true;
}

async function sendIdeaMessage(input) {
  const transport = ideaMailTransport();
  if (!transport) throw new Error('IDEAACO_EMAIL_NOT_CONFIGURED');
  const name=cleanText(input.name,120),email=cleanText(input.email,180),category=cleanText(input.category,80),title=cleanText(input.title,180),message=cleanText(input.message,5000);
  if (!name || !category || !title || !message) throw new Error('IDEAACO_INVALID');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('IDEAACO_INVALID');
  const subject=`[#IdeAÇO] ${category}: ${title}`;
  const html=`<h2>Nova contribuição para o #IdeAÇO</h2><p><b>Nome:</b> ${escapeHtml(name)}</p><p><b>E-mail:</b> ${escapeHtml(email||'Não informado')}</p><p><b>Categoria:</b> ${escapeHtml(category)}</p><p><b>Título:</b> ${escapeHtml(title)}</p><p><b>Mensagem:</b></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;
  await transport.sendMail({ from:`Expertaço — #IdeAÇO <${process.env.IDEAACO_EMAIL_USER}>`, to:ideaRecipients.to, cc:ideaRecipients.cc, replyTo:email||undefined, subject, text:`Nova contribuição para o #IdeAÇO\n\nNome: ${name}\nE-mail: ${email||'Não informado'}\nCategoria: ${category}\nTítulo: ${title}\n\n${message}`, html });
}
const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL || '';
const corporateEmail = email => typeof email === 'string' && /^[^\s@]+@grupoabr\.com\.br$/i.test(email.trim());
const allowedAuthRoutes = new Set(['sign-up/email','sign-in/email','sign-out','get-session']);

async function proxyNeonAuth(req, res, route) {
  if (!neonAuthBaseUrl) return send(res, 503, { error:'Autenticação ainda não configurada.' });
  if (!allowedAuthRoutes.has(route)) return send(res, 404, { error:'Rota de autenticação não encontrada.' });
  try {
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await parseBody(req);
      if ((route === 'sign-up/email' || route === 'sign-in/email') && !corporateEmail(body.email)) return send(res, 403, { error:'Use exclusivamente seu e-mail @grupoabr.com.br.' });
    }
    const response = await fetch(`${neonAuthBaseUrl.replace(/\/$/,'')}/${route}`, {
      method:req.method,
      headers:{'Content-Type':'application/json','Accept':'application/json','Cookie':req.headers.cookie||'','Origin':process.env.APP_ORIGIN||'https://experta-o.onrender.com'},
      body:body?JSON.stringify(body):undefined,
      redirect:'manual'
    });
    const payload = await response.text();
    let parsed=null; try { parsed=JSON.parse(payload); } catch {}
    const sessionEmail=parsed?.user?.email||parsed?.session?.user?.email||parsed?.data?.user?.email;
    if (route === 'get-session' && sessionEmail && !corporateEmail(sessionEmail)) return send(res, 403, { error:'Conta fora do domínio corporativo.' });
    const headers={};
    const cookies=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];
    if(cookies.length)headers['Set-Cookie']=cookies;
    res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(payload);
  } catch (error) {
    console.error('Falha Neon Auth:',error.message);
    return send(res,502,{error:'Não foi possível acessar a autenticação agora.'});
  }
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
  if (url.pathname.startsWith('/api/auth/')) {
    const authRoute=url.pathname.slice('/api/auth/'.length);
    if (!['GET','POST'].includes(req.method)) return send(res,405,{error:'Método não permitido.'});
    return proxyNeonAuth(req,res,authRoute);
  }  if (url.pathname === '/api/ideaaco' && req.method === 'POST') {
    if (!ideaRequestAllowed(req)) return send(res, 429, { error:'Muitas mensagens em pouco tempo. Aguarde alguns minutos.' });
    try {
      const body = await parseBody(req);
      if (body.website) return send(res, 202, { sent:true });
      await sendIdeaMessage(body);
      return send(res, 202, { sent:true });
    } catch (error) {
      if (error.message === 'IDEAACO_INVALID') return send(res, 400, { error:'Confira os campos obrigatórios e tente novamente.' });
      if (error.message === 'IDEAACO_EMAIL_NOT_CONFIGURED') return send(res, 503, { error:'O canal de e-mail ainda não foi ativado.' });
      console.error('Falha no envio #IdeAÇO:', error.message);
      return send(res, 502, { error:'Não foi possível enviar agora. Tente novamente em instantes.' });
    }
  }  if (url.pathname === '/api/ranking' && req.method === 'GET') {
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
