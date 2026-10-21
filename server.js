const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]', 'utf8');
  }

  if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, '[]', 'utf8');
  }
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function createUserRecord(email, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    email: email.toLowerCase().trim(),
    salt,
    passwordHash: hashPassword(password, salt)
  };
}

function verifyPassword(password, salt, passwordHash) {
  return hashPassword(password, salt) === passwordHash;
}

function sanitizeUser(user) {
  return user ? { id: user.id, email: user.email } : null;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

ensureDataFiles();

app.use(express.json());
app.use(express.static(__dirname));
app.use(session({
  secret: process.env.SESSION_SECRET || 'youtube-notes-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.get('/api/session', (req, res) => {
  const user = req.session && req.session.user ? sanitizeUser(req.session.user) : null;
  res.json({ user });
});

app.post('/api/register', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Email and password are required. Password must be at least 6 characters.' });
  }

  const users = readJson(USERS_FILE, []);
  const userExists = users.some((user) => user.email === email);

  if (userExists) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const user = createUserRecord(email, password);
  users.push(user);
  writeJson(USERS_FILE, users);

  req.session.user = sanitizeUser(user);
  res.status(201).json({ user: req.session.user });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const users = readJson(USERS_FILE, []);
  const user = users.find((entry) => entry.email === email);

  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.user = sanitizeUser(user);
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
    return;
  }

  res.json({ ok: true });
});

app.get('/api/notes', requireAuth, (req, res) => {
  const notes = readJson(NOTES_FILE, []);
  const userNotes = notes.filter((note) => note.userId === req.session.user.id);
  res.json({ notes: userNotes });
});

app.post('/api/notes', requireAuth, (req, res) => {
  const notes = readJson(NOTES_FILE, []);
  const note = {
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    userId: req.session.user.id,
    title: String(req.body?.title || 'Untitled note').trim() || 'Untitled note',
    body: String(req.body?.body || '').trim(),
    sourceUrl: String(req.body?.sourceUrl || '').trim(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (!note.body) {
    return res.status(400).json({ error: 'Note body is required.' });
  }

  notes.unshift(note);
  writeJson(NOTES_FILE, notes);
  res.status(201).json({ note });
});

app.put('/api/notes/:id', requireAuth, (req, res) => {
  const notes = readJson(NOTES_FILE, []);
  const note = notes.find((entry) => entry.id === req.params.id && entry.userId === req.session.user.id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found.' });
  }

  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  const sourceUrl = String(req.body?.sourceUrl || '').trim();

  if (!body) {
    return res.status(400).json({ error: 'Note body is required.' });
  }

  note.title = title || 'Untitled note';
  note.body = body;
  note.sourceUrl = sourceUrl;
  note.updatedAt = Date.now();

  writeJson(NOTES_FILE, notes);
  res.json({ note });
});

app.delete('/api/notes/:id', requireAuth, (req, res) => {
  const notes = readJson(NOTES_FILE, []);
  const remaining = notes.filter((note) => note.id !== req.params.id || note.userId !== req.session.user.id);

  writeJson(NOTES_FILE, remaining);
  res.json({ ok: true });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`YouTube Notes app running at http://localhost:${PORT}`);
});
