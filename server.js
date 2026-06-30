require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// ── Data store ──────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'registrations.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE))  fs.writeFileSync(DB_FILE, '[]');

function readDB()      { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function newRef()      { return 'NGS-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }

// ── Admin guard ─────────────────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'nextgen-admin-2026';
function adminGuard(req, res, next) {
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t !== ADMIN_TOKEN) return res.status(401).json({ success: false, message: 'Unauthorized.' });
  next();
}

// ── PUBLIC: Submit registration ─────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  try {
    const { institutionName, institutionType, board, studentCount, staffCount,
            address, city, province, contactName, contactRole,
            phone, email, plan, startPreference, requirements } = req.body;

    if (!institutionName || !institutionType || !studentCount || !address ||
        !city || !contactName || !contactRole || !phone || !plan) {
      return res.status(400).json({ success: false, message: 'Required fields missing.' });
    }
    if (!['silver','gold','diamond'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan.' });
    }

    const record = {
      ref: newRef(), plan, institutionName, institutionType,
      board: board||'', studentCount, staffCount: staffCount||'',
      address, city, province: province||'',
      contactName, contactRole, phone, email: email||'',
      startPreference: startPreference||'', requirements: requirements||'',
      status: 'new', submittedAt: new Date().toISOString()
    };

    const db = readDB();
    db.push(record);
    writeDB(db);
    res.status(201).json({ success: true, ref: record.ref });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUBLIC: Stats (for homepage counter) ───────────────────────────────────
app.get('/api/stats', (req, res) => {
  try {
    const db = readDB();
    res.json({ success: true, total: db.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── ADMIN: Stats ────────────────────────────────────────────────────────────
app.get('/api/admin/stats', adminGuard, (req, res) => {
  try {
    const db = readDB();
    res.json({
      success: true,
      total:     db.length,
      new:       db.filter(r => r.status === 'new').length,
      silver:    db.filter(r => r.plan === 'silver').length,
      gold:      db.filter(r => r.plan === 'gold').length,
      diamond:   db.filter(r => r.plan === 'diamond').length,
      converted: db.filter(r => r.status === 'converted').length,
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── ADMIN: List ─────────────────────────────────────────────────────────────
app.get('/api/admin/registrations', adminGuard, (req, res) => {
  try {
    let data = readDB();
    const { plan, status, search } = req.query;
    if (plan)   data = data.filter(r => r.plan === plan);
    if (status) data = data.filter(r => r.status === status);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        [r.institutionName, r.city, r.contactName, r.phone, r.email]
          .join(' ').toLowerCase().includes(q)
      );
    }
    res.json({ success: true, data: data.slice().reverse() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── ADMIN: Update status / notes ────────────────────────────────────────────
app.patch('/api/admin/registrations/:ref', adminGuard, (req, res) => {
  try {
    const db = readDB();
    const idx = db.findIndex(r => r.ref === req.params.ref);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Not found.' });
    const { status, notes } = req.body;
    if (status) db[idx].status = status;
    if (notes !== undefined) db[idx].notes = notes;
    db[idx].updatedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, data: db[idx] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── ADMIN: Delete ───────────────────────────────────────────────────────────
app.delete('/api/admin/registrations/:ref', adminGuard, (req, res) => {
  try {
    const db = readDB();
    const filtered = db.filter(r => r.ref !== req.params.ref);
    if (filtered.length === db.length)
      return res.status(404).json({ success: false, message: 'Not found.' });
    writeDB(filtered);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Pages ───────────────────────────────────────────────────────────────────
app.get('/register',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/admin',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/demo',           (req, res) => res.sendFile(path.join(__dirname, 'public', 'demo.html')));
app.get('/what-we-build',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'what-we-build.html')));
app.get('/agency',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'agency-index.html')));
app.get('/agency-services', (req, res) => res.sendFile(path.join(__dirname, 'public', 'agency-services.html')));
app.get('/agency-work',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'agency-work.html')));
app.get('/agency-contact',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'agency-contact.html')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nNextgen Sys Portfolio running on http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`Admin token: ${ADMIN_TOKEN}`);
  console.log('Set ADMIN_TOKEN env var to change the token.\n');
});
