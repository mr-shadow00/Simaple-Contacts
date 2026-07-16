const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'contacts.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// ---------- Storage helpers ----------

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ contacts: [] }, null, 2));
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak-' + Date.now());
    return { contacts: [] };
  }
}

function writeData(data) {
  ensureDataFile();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- Small helpers ----------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 15 * 1024 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- Request handler ----------

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsed.pathname;

    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, pathname);
    }

    const parts = pathname.split('/').filter(Boolean);

    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/export' && req.method === 'GET') {
      const data = readData();
      const body = JSON.stringify(data, null, 2);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="contacts-backup.json"',
        'Content-Length': Buffer.byteLength(body)
      });
      return res.end(body);
    }

    if (pathname === '/api/import' && req.method === 'POST') {
      const incoming = await readBody(req);
      if (!incoming || !Array.isArray(incoming.contacts)) {
        return sendJson(res, 400, { error: 'Invalid backup file' });
      }
      const data = readData();
      const existingIds = new Set(data.contacts.map(c => c.id));
      let added = 0;
      for (const c of incoming.contacts) {
        if (!c.id || !existingIds.has(c.id)) {
          data.contacts.push({ ...c, id: c.id || crypto.randomUUID() });
          added++;
        }
      }
      writeData(data);
      return sendJson(res, 200, { added, total: data.contacts.length });
    }

    if (pathname === '/api/contacts' && req.method === 'GET') {
      const data = readData();
      const sorted = [...data.contacts].sort((a, b) => {
        const an = (a.firstName + ' ' + a.lastName).trim().toLowerCase();
        const bn = (b.firstName + ' ' + b.lastName).trim().toLowerCase();
        return an.localeCompare(bn);
      });
      return sendJson(res, 200, sorted);
    }

    if (pathname === '/api/contacts' && req.method === 'POST') {
      const body = await readBody(req);
      const data = readData();
      const now = new Date().toISOString();
      const contact = {
        id: crypto.randomUUID(),
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        company: body.company || '',
        relationship: body.relationship || '',
        birthday: body.birthday || '',
        photo: body.photo || '',
        phones: Array.isArray(body.phones) ? body.phones : [],
        emails: Array.isArray(body.emails) ? body.emails : [],
        socialProfiles: Array.isArray(body.socialProfiles) ? body.socialProfiles : [],
        address: body.address || '',
        notes: body.notes || '',
        favorite: !!body.favorite,
        createdAt: now,
        updatedAt: now
      };
      data.contacts.push(contact);
      writeData(data);
      return sendJson(res, 201, contact);
    }

    if (parts[0] === 'api' && parts[1] === 'contacts' && parts[2]) {
      const id = decodeURIComponent(parts[2]);
      const data = readData();
      const idx = data.contacts.findIndex(c => c.id === id);

      if (req.method === 'GET') {
        if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
        return sendJson(res, 200, data.contacts[idx]);
      }

      if (req.method === 'PUT') {
        if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
        const body = await readBody(req);
        const existing = data.contacts[idx];
        const updated = {
          ...existing,
          firstName: body.firstName ?? existing.firstName,
          lastName: body.lastName ?? existing.lastName,
          company: body.company ?? existing.company,
          relationship: body.relationship ?? existing.relationship,
          birthday: body.birthday ?? existing.birthday,
          photo: body.photo ?? existing.photo,
          phones: Array.isArray(body.phones) ? body.phones : existing.phones,
          emails: Array.isArray(body.emails) ? body.emails : existing.emails,
          socialProfiles: Array.isArray(body.socialProfiles) ? body.socialProfiles : existing.socialProfiles,
          address: body.address ?? existing.address,
          notes: body.notes ?? existing.notes,
          favorite: body.favorite ?? existing.favorite,
          updatedAt: new Date().toISOString()
        };
        data.contacts[idx] = updated;
        writeData(data);
        return sendJson(res, 200, updated);
      }

      if (req.method === 'DELETE') {
        if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
        const [removed] = data.contacts.splice(idx, 1);
        writeData(data);
        return sendJson(res, 200, removed);
      }
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 400, { error: err.message || 'Bad request' });
  }
});

server.listen(PORT, () => {
  console.log(`Simple Contacts running at http://localhost:${PORT}`);
  console.log(`Data stored at ${DATA_FILE}`);
});
