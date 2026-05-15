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

const SUPPORTED_LANGS = new Set(['javascript', 'typescript', 'python']);

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3737}`;
}

// JavaScript — run with the current Node.js binary (works in Vercel Lambda too)
function runJavaScript(code) {
  return new Promise((resolve) => {
    const file = path.join(os.tmpdir(), `cr_${Date.now()}.js`);
    fs.writeFileSync(file, code);
    const start = Date.now();
    exec(`"${process.execPath}" "${file}"`, { timeout: 10000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(file); } catch (_) {}
      resolve({ output: stdout, error: stderr || (err && !stderr ? err.message : ''), elapsed: Date.now() - start });
    });
  });
}

// TypeScript — transpile with the typescript package then run as JS (no external API)
function runTypeScript(code) {
  return new Promise((resolve) => {
    let ts;
    try { ts = require('typescript'); } catch (_) {
      return resolve({ output: '', error: 'TypeScript compiler not installed', elapsed: 0 });
    }
    const { outputText, diagnostics } = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: false },
      reportDiagnostics: true,
    });
    if (diagnostics && diagnostics.length) {
      const msg = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
      return resolve({ output: '', error: msg, elapsed: 0 });
    }
    const file = path.join(os.tmpdir(), `cr_${Date.now()}.js`);
    fs.writeFileSync(file, outputText);
    const start = Date.now();
    exec(`"${process.execPath}" "${file}"`, { timeout: 10000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(file); } catch (_) {}
      resolve({ output: stdout, error: stderr || (err && !stderr ? err.message : ''), elapsed: Date.now() - start });
    });
  });
}

// Python — proxies to /api/run-python
// Production: served by api/run-python.py (Vercel Python runtime, has python3)
// Development: handled by the Express route below (uses local python3)
async function runPython(code) {
  const res = await fetch(`${getBaseUrl()}/api/run-python`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ code }),
    signal:  AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Python execution service unavailable');
  return res.json();
}

// Development fallback — intercepted by Vercel Python function in production
app.post('/api/run-python', (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ output: '', error: 'No code provided', elapsed: 0 });
  const file = path.join(os.tmpdir(), `cr_${Date.now()}.py`);
  fs.writeFileSync(file, code);
  const start = Date.now();
  exec(`python3 "${file}"`, { timeout: 10000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
    try { fs.unlinkSync(file); } catch (_) {}
    res.json({ output: stdout, error: stderr || (err && !stderr ? err.message : ''), elapsed: Date.now() - start });
  });
});

app.post('/api/run', requireAuth, async (req, res) => {
  const { language, code } = req.body;
  if (!code)                        return res.json({ output: '', error: 'No code provided' });
  if (!SUPPORTED_LANGS.has(language)) return res.json({ output: '', error: 'Unsupported language' });

  try {
    let result;
    if (language === 'javascript')       result = await runJavaScript(code);
    else if (language === 'typescript')  result = await runTypeScript(code);
    else                                 result = await runPython(code);
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
