require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 10000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });
const fallback = {
  site: { heroTitle: 'Where young talent becomes lasting impact.', heroCopy: 'We create safe, inclusive spaces where young people discover their strengths, build confidence, and lead positive change in Liberia.', aboutTitle: 'Potential is everywhere. Opportunity should be too.', aboutBody: 'YBAT exists to help young people turn energy, imagination, and talent into real pathways forward.', contactEmail: 'info.ybat2023@gmail.com', phonePrimary: '0880 555 318', phoneSecondary: '0775 663 145' },
  programs: [
    { title: 'Sports & wellbeing', summary: 'Teamwork, discipline, confidence, and healthy community through youth sports.' },
    { title: 'Creative talents', summary: 'Spaces for young people to discover, practice, and showcase what they can do.' },
    { title: 'Leadership', summary: 'Mentorship and responsibility that help youth become active contributors.' },
    { title: 'Skills & opportunity', summary: 'Practical learning and connections that support sustainable success stories.' }
  ],
  events: [], stories: [], impact: [{ label: 'Young people reached', value: '0' }, { label: 'Community programs', value: '0' }, { label: 'Volunteer mentors', value: '0' }]
};

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map(v => v.trim()) : true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const memory = { content: {}, submissions: [], users: [], programs: [], events: [], stories: [], impact: [] };
let adminPasswordHash;
const q = (text, params = []) => pool.query(text, params);
const tokenFor = user => jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'development-only-secret', { expiresIn: '7d' });
const auth = (req, res, next) => { const raw = req.headers.authorization || ''; try { req.user = jwt.verify(raw.replace(/^Bearer\s+/i, ''), process.env.JWT_SECRET || 'development-only-secret'); next(); } catch { res.status(401).json({ error: 'Please sign in to continue.' }); } };
const staff = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Staff access required.' });
const clean = value => typeof value === 'string' ? value.trim() : value;

async function initDb() {
  if (!process.env.DATABASE_URL) { adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'change-me-now', 12); return; }
  await q(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', organization TEXT, created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS site_content (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS programs (id SERIAL PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL, image_url TEXT, published BOOLEAN DEFAULT true, sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL, event_date DATE, location TEXT, image_url TEXT, published BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS stories (id SERIAL PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, image_url TEXT, published BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS impact_metrics (id SERIAL PRIMARY KEY, label TEXT NOT NULL, value TEXT NOT NULL, detail TEXT, updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS submissions (id SERIAL PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, organization TEXT, message TEXT, payload JSONB DEFAULT '{}'::jsonb, status TEXT DEFAULT 'new', created_at TIMESTAMPTZ DEFAULT now());`);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await q(`INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'admin') ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, password_hash=EXCLUDED.password_hash, role='admin'`, ['YBAT Staff Admin', process.env.ADMIN_EMAIL.toLowerCase(), hash]);
  }
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'ybat-api' }));
app.get('/api/public', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ ...fallback, site: { ...fallback.site, ...memory.content }, programs: memory.programs.length ? memory.programs : fallback.programs, events: memory.events, stories: memory.stories, impact: memory.impact.length ? memory.impact : fallback.impact });
  try {
    const [content, programs, events, stories, impact] = await Promise.all([
      q('SELECT key,value FROM site_content'), q('SELECT * FROM programs WHERE published=true ORDER BY sort_order,id'), q('SELECT * FROM events WHERE published=true ORDER BY event_date NULLS LAST,created_at DESC'), q('SELECT * FROM stories WHERE published=true ORDER BY created_at DESC'), q('SELECT * FROM impact_metrics ORDER BY id')
    ]);
    const site = Object.fromEntries(content.rows.map(row => [row.key, row.value]));
    res.json({ site: { ...fallback.site, ...site }, programs: programs.rows.length ? programs.rows : fallback.programs, events: events.rows, stories: stories.rows, impact: impact.rows.length ? impact.rows : fallback.impact });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load YBAT content.' }); }
});

app.post('/api/auth/register', async (req, res) => { const { name, email, password, role = 'member', organization = '' } = req.body; if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required.' }); try { const hash = await bcrypt.hash(password, 12); const result = await q('INSERT INTO users (name,email,password_hash,role,organization) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,organization', [clean(name), clean(email).toLowerCase(), hash, ['member','mentor','partner'].includes(role) ? role : 'member', clean(organization)]); const user = result.rows[0]; res.status(201).json({ user, token: tokenFor(user) }); } catch (error) { res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'That email is already registered.' : 'Unable to create account.' }); } });
app.post('/api/auth/login', async (req, res) => { const { email, password } = req.body; try { if (!process.env.DATABASE_URL) { const ok = clean(email).toLowerCase() === clean(process.env.ADMIN_EMAIL || '').toLowerCase() && await bcrypt.compare(password || '', adminPasswordHash); if (!ok) return res.status(401).json({ error: 'Invalid email or password.' }); const user = { id: 1, name: 'YBAT Staff Admin', email: clean(email).toLowerCase(), role: 'admin', organization: '' }; return res.json({ user, token: tokenFor(user) }); } const result = await q('SELECT * FROM users WHERE email=$1', [clean(email).toLowerCase()]); const user = result.rows[0]; if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' }); delete user.password_hash; res.json({ user, token: tokenFor(user) }); } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to sign in.' }); } });
app.get('/api/auth/me', auth, async (req, res) => { if (!process.env.DATABASE_URL) return res.json({ user: req.user }); const result = await q('SELECT id,name,email,role,organization,created_at FROM users WHERE id=$1', [req.user.id]); res.json({ user: result.rows[0] || null }); });
app.post('/api/submissions', async (req, res) => { const { kind, name, email, phone = '', organization = '', message = '', ...payload } = req.body; if (!['contact','partnership','application','volunteer'].includes(kind) || !name || !email) return res.status(400).json({ error: 'Please complete the required fields.' }); try { if (!process.env.DATABASE_URL) { memory.submissions.unshift({ id: memory.submissions.length + 1, kind, name: clean(name), email: clean(email).toLowerCase(), phone: clean(phone), organization: clean(organization), message: clean(message), payload, status: 'new', created_at: new Date().toISOString() }); return res.status(201).json({ message: 'Thanks — your submission is now in the YBAT staff dashboard.' }); } await q('INSERT INTO submissions (kind,name,email,phone,organization,message,payload) VALUES ($1,$2,$3,$4,$5,$6,$7)', [kind, clean(name), clean(email).toLowerCase(), clean(phone), clean(organization), clean(message), JSON.stringify(payload)]); res.status(201).json({ message: 'Thanks — your submission is now in the YBAT staff dashboard.' }); } catch { res.status(500).json({ error: 'Unable to save your submission right now.' }); } });

app.get('/api/admin/submissions', auth, staff, async (req, res) => { if (!process.env.DATABASE_URL) return res.json({ submissions: memory.submissions }); const result = await q('SELECT * FROM submissions ORDER BY created_at DESC'); res.json({ submissions: result.rows }); });
app.get('/api/admin/users', auth, staff, async (req, res) => { const result = await q('SELECT id,name,email,role,organization,created_at FROM users ORDER BY created_at DESC'); res.json({ users: result.rows }); });
app.put('/api/admin/content/:key', auth, staff, async (req, res) => { if (!process.env.DATABASE_URL) { memory.content[req.params.key] = req.body.value; return res.json({ key: req.params.key, value: req.body.value }); } const result = await q('INSERT INTO site_content (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now() RETURNING key,value', [req.params.key, JSON.stringify(req.body.value)]); res.json(result.rows[0]); });
app.post('/api/admin/programs', auth, staff, async (req, res) => { const { title, summary, image_url = '', sort_order = 0 } = req.body; const result = await q('INSERT INTO programs (title,summary,image_url,sort_order) VALUES ($1,$2,$3,$4) RETURNING *', [title, summary, image_url, sort_order]); res.status(201).json(result.rows[0]); });
app.post('/api/admin/events', auth, staff, async (req, res) => { const { title, summary, event_date = null, location = '', image_url = '' } = req.body; const result = await q('INSERT INTO events (title,summary,event_date,location,image_url) VALUES ($1,$2,$3,$4,$5) RETURNING *', [title, summary, event_date || null, location, image_url]); res.status(201).json(result.rows[0]); });
app.post('/api/admin/stories', auth, staff, async (req, res) => { const { title, body, image_url = '' } = req.body; const result = await q('INSERT INTO stories (title,body,image_url) VALUES ($1,$2,$3) RETURNING *', [title, body, image_url]); res.status(201).json(result.rows[0]); });
app.post('/api/admin/impact', auth, staff, async (req, res) => { const { label, value, detail = '' } = req.body; const result = await q('INSERT INTO impact_metrics (label,value,detail) VALUES ($1,$2,$3) RETURNING *', [label, value, detail]); res.status(201).json(result.rows[0]); });
app.patch('/api/admin/submissions/:id', auth, staff, async (req, res) => { const result = await q('UPDATE submissions SET status=$1 WHERE id=$2 RETURNING *', [req.body.status || 'reviewed', req.params.id]); res.json(result.rows[0]); });

initDb().then(() => app.listen(port, '0.0.0.0', () => console.log(`YBAT API listening on ${port}`))).catch(error => { console.error('Database initialization failed', error); process.exit(1); });
