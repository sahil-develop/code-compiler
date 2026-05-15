require('dotenv').config();

const express        = require('express');
const session        = require('express-session');
const { MongoStore } = require('connect-mongo');
const bcrypt         = require('bcryptjs');
const { exec }       = require('child_process');
const fs             = require('fs');
const path           = require('path');
const os             = require('os');
const mongoose       = require('mongoose');

const MONGO_URI      = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coderunner';
const SESSION_SECRET = process.env.SESSION_SECRET || 'cr_local_secret_change_me';
const IS_PROD        = process.env.NODE_ENV === 'production';
const PUBLIC_URL     = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
// Serve index.html with PUBLIC_URL injected for SEO meta tags
let _indexHtml;
function getIndexHtml() {
  if (!_indexHtml) {
    const raw = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    _indexHtml = raw.replace(/\{\{PUBLIC_URL\}\}/g, PUBLIC_URL);
  }
  return _indexHtml;
}

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getIndexHtml());
});

app.get('/sitemap.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${PUBLIC_URL}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${PUBLIC_URL}/sitemap.xml`);
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Sessions ──────────────────────────────────────────────────────────────────
app.use(session({
  secret:           SESSION_SECRET,
  resave:           false,
  saveUninitialized: false,
  store:            MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: {
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000,
    secure:   IS_PROD,
    sameSite: 'lax',
  },
}));

// ── MongoDB (lazy connect — serverless-safe) ──────────────────────────────────
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(MONGO_URI, {
    bufferCommands:           false,
    serverSelectionTimeoutMS: 5000,
  });
}

app.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ── Models ────────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 32 },
  passwordHash: { type: String, required: true },
  createdAt:    { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);

const SnippetSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:     { type: String, default: 'Untitled' },
  language:  { type: String, enum: ['python', 'javascript', 'typescript'], default: 'javascript' },
  code:      String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Snippet = mongoose.model('Snippet', SnippetSchema);

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 4)    return res.status(400).json({ error: 'Password must be at least 4 characters' });

    const exists = await User.findOne({ username: username.trim().toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Username already taken' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: username.trim().toLowerCase(), passwordHash });

    req.session.userId   = user._id;
    req.session.username = user.username;
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)  return res.status(401).json({ error: 'Invalid username or password' });

    req.session.userId   = user._id;
    req.session.username = user.username;
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: { username: req.session.username } });
});

// ── Code execution ────────────────────────────────────────────────────────────

// Piston public API — used in production (Vercel has no python/ts-node)
const PISTON_RUNTIMES = {
  python:     { language: 'python',     version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
};

async function runViaPiston(language, code) {
  const runtime = PISTON_RUNTIMES[language];
  const start   = Date.now();

  const res = await fetch('https://emkc.org/api/v2/piston/execute', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      language: runtime.language,
      version:  runtime.version,
      files:    [{ content: code }],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Piston API error: ${res.status}`);

  const data    = await res.json();
  const run     = data.run || {};
  const elapsed = Date.now() - start;

  return {
    output:  run.stdout || '',
    error:   run.stderr || (run.code !== 0 ? `Process exited with code ${run.code}` : ''),
    elapsed,
  };
}

// Local exec — used in development only
function runLocally(language, code) {
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir();
    let filePath, command;

    if (language === 'python') {
      filePath = path.join(tmpDir, `cr_${Date.now()}.py`);
      fs.writeFileSync(filePath, code);
      command = `python3 "${filePath}"`;
    } else if (language === 'javascript') {
      filePath = path.join(tmpDir, `cr_${Date.now()}.js`);
      fs.writeFileSync(filePath, code);
      command = `node "${filePath}"`;
    } else if (language === 'typescript') {
      filePath = path.join(tmpDir, `cr_${Date.now()}.ts`);
      fs.writeFileSync(filePath, code);
      command = `npx --yes ts-node --skip-project "${filePath}"`;
    } else {
      return resolve({ output: '', error: 'Unsupported language', elapsed: 0 });
    }

    const start = Date.now();
    exec(command, { timeout: 10000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(filePath); } catch (_) {}
      resolve({
        output:  stdout,
        error:   stderr || (err && !stderr ? err.message : ''),
        elapsed: Date.now() - start,
      });
    });
  });
}

app.post('/api/run', requireAuth, async (req, res) => {
  const { language, code } = req.body;
  if (!code)                     return res.json({ output: '', error: 'No code provided' });
  if (!PISTON_RUNTIMES[language]) return res.json({ output: '', error: 'Unsupported language' });

  try {
    const result = IS_PROD
      ? await runViaPiston(language, code)
      : await runLocally(language, code);
    res.json(result);
  } catch (err) {
    res.json({ output: '', error: err.message });
  }
});

// ── Snippets (auth required, scoped to user) ──────────────────────────────────
app.get('/api/snippets', requireAuth, async (req, res) => {
  try {
    const snippets = await Snippet.find({ userId: req.session.userId })
      .sort({ updatedAt: -1 })
      .select('title language updatedAt');
    res.json(snippets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch snippets' });
  }
});

app.post('/api/snippets', requireAuth, async (req, res) => {
  try {
    const { title, language, code } = req.body;
    const s = await Snippet.create({ userId: req.session.userId, title, language, code });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create snippet' });
  }
});

app.get('/api/snippets/:id', requireAuth, async (req, res) => {
  try {
    const s = await Snippet.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch snippet' });
  }
});

app.put('/api/snippets/:id', requireAuth, async (req, res) => {
  try {
    const { title, language, code } = req.body;
    const s = await Snippet.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { title, language, code, updatedAt: new Date() },
      { new: true }
    );
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update snippet' });
  }
});

app.delete('/api/snippets/:id', requireAuth, async (req, res) => {
  try {
    await Snippet.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete snippet' });
  }
});

// ── Start / export ────────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3737;
  app.listen(PORT, () => console.log(`CodeRunner → http://localhost:${PORT}`));
}

module.exports = app;
