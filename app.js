const authView = document.getElementById('authView');
const homeView = document.getElementById('homeView');
const appView = document.getElementById('appView');
const homeLoginButton = document.getElementById('homeLogin');
const homeSignupButton = document.getElementById('homeSignup');
const homeGetStartedButton = document.getElementById('homeGetStarted');
const homeExploreLoginButton = document.getElementById('homeExploreLogin');
const backHomeButton = document.getElementById('backHome');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const confirmPasswordWrap = document.getElementById('confirmPasswordWrap');
const confirmPassword = document.getElementById('confirmPassword');
const authStatus = document.getElementById('authStatus');
const authSubmit = document.getElementById('authSubmit');
const showLoginButton = document.getElementById('showLogin');
const showRegisterButton = document.getElementById('showRegister');
const noteForm = document.getElementById('noteForm');
const noteTitle = document.getElementById('noteTitle');
const noteBody = document.getElementById('noteBody');
const sourceUrl = document.getElementById('sourceUrl');
const statusMessage = document.getElementById('statusMessage');
const notesList = document.getElementById('notesList');
const resetNotesButton = document.getElementById('resetNotes');
const logoutButton = document.getElementById('logoutButton');
const welcomeName = document.getElementById('welcomeName');
const sidebarEmail = document.getElementById('sidebarEmail');
const sidebarNoteCount = document.getElementById('sidebarNoteCount');
const noteCount = document.getElementById('noteCount');
const noteSearch = document.getElementById('noteSearch');
const cancelEditButton = document.getElementById('cancelEdit');
const composeHeading = document.getElementById('composeHeading');
const submitNoteButton = noteForm.querySelector('[type="submit"]');
const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const fontButtons = [...document.querySelectorAll('[data-font-choice]')];

const AVAILABLE_THEMES = ['forest', 'ocean', 'clay', 'berry'];
const AVAILABLE_FONTS = ['sans', 'serif', 'mono'];
let authMode = 'login';
let activeView = 'home';
let currentUser = null;
let allNotes = [];
let editingNoteId = null;
let searchTerm = '';

function setStatus(message) {
  statusMessage.textContent = message;
}

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? '#b74a4a' : '#66756d';
}

function applyTheme(themeName, persist = false) {
  const theme = AVAILABLE_THEMES.includes(themeName) ? themeName : 'forest';
  document.documentElement.dataset.theme = theme;

  themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });

  if (persist && currentUser) {
    try {
      localStorage.setItem(`youtube-notes-theme-${currentUser.id}`, theme);
    } catch (error) {
      setStatus('Theme changed, but this browser could not save the preference.');
    }
  }
}

function loadUserTheme() {
  let theme = 'forest';
  try {
    theme = localStorage.getItem(`youtube-notes-theme-${currentUser.id}`) || theme;
  } catch (error) {
    theme = 'forest';
  }
  applyTheme(theme);
}

function applyFont(fontName, persist = false) {
  const font = AVAILABLE_FONTS.includes(fontName) ? fontName : 'sans';
  document.documentElement.dataset.font = font;

  fontButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.fontChoice === font));
  });

  if (persist && currentUser) {
    try {
      localStorage.setItem(`youtube-notes-font-${currentUser.id}`, font);
    } catch (error) {
      setStatus('Font changed, but this browser could not save the preference.');
    }
  }
}

function loadUserFont() {
  let font = 'sans';
  try {
    font = localStorage.getItem(`youtube-notes-font-${currentUser.id}`) || font;
  } catch (error) {
    font = 'sans';
  }
  applyFont(font);
}

function renderAuthTabs() {
  const loginActive = authMode === 'login';
  showLoginButton.classList.toggle('active', loginActive);
  showRegisterButton.classList.toggle('active', !loginActive);
  confirmPasswordWrap.classList.toggle('hidden', loginActive);
  authSubmit.textContent = loginActive ? 'Log in' : 'Create account';
  confirmPassword.required = !loginActive;
}

function showAuth(mode) {
  authMode = mode;
  activeView = 'auth';
  renderAuthTabs();
  renderAppState();
  setAuthStatus('');
  authEmail.focus();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (error) {
    return '';
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload;
}

async function loadSession() {
  try {
    const result = await fetchJson('/api/session');
    currentUser = result.user;
    renderAppState();
    return currentUser;
  } catch (error) {
    currentUser = null;
    renderAppState();
    return null;
  }
}

function renderAppState() {
  const isLoggedIn = !!currentUser;
  homeView.classList.toggle('hidden', isLoggedIn || activeView !== 'home');
  authView.classList.toggle('hidden', isLoggedIn || activeView !== 'auth');
  appView.classList.toggle('hidden', !isLoggedIn);

  if (isLoggedIn) {
    loadUserTheme();
    loadUserFont();
    welcomeName.textContent = 'Your notes';
    sidebarEmail.textContent = currentUser.email;
    loadNotes();
  } else {
    applyTheme('forest');
    applyFont('sans');
    allNotes = [];
    renderNotes();
  }
}

async function loadNotes() {
  notesList.innerHTML = '<p class="empty">Loading your notes…</p>';
  try {
    const result = await fetchJson('/api/notes');
    allNotes = Array.isArray(result.notes) ? result.notes : [];
    renderNotes();
  } catch (error) {
    setStatus(error.message || 'Unable to load notes.');
    notesList.innerHTML = '<p class="empty">Unable to load notes right now.</p>';
  }
}

function getVisibleNotes() {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return [...allNotes];
  }

  return allNotes.filter((note) => {
    const haystack = `${note.title || ''} ${note.body || ''} ${note.sourceUrl || ''}`.toLowerCase();
    return haystack.includes(term);
  });
}

function renderNotes() {
  const notes = getVisibleNotes();
  noteCount.textContent = String(allNotes.length);
  sidebarNoteCount.textContent = String(allNotes.length);

  if (!notes.length) {
    const emptyText = allNotes.length ? 'No notes match your search.' : 'No notes saved yet. Add one above.';
    notesList.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }

  notesList.innerHTML = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((note) => {
      const timeLabel = new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString();
      const safeUrl = getSafeHttpUrl(note.sourceUrl);
      const urlMarkup = safeUrl
        ? `<a class="note-url" href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(safeUrl)}</a>`
        : '';

      return `
        <article class="note-card">
          <div class="note-header">
            <div class="note-title">${escapeHtml(note.title || 'Untitled note')}</div>
            <div class="note-actions">
              <button type="button" class="note-action edit-note" data-id="${escapeHtml(note.id)}">Edit</button>
              <button type="button" class="delete-note" data-id="${escapeHtml(note.id)}">Delete</button>
            </div>
          </div>
          <div class="note-meta">${escapeHtml(timeLabel)}</div>
          <p class="note-body">${escapeHtml(note.body || 'No content')}</p>
          ${urlMarkup}
        </article>
      `;
    }).join('');

  notesList.querySelectorAll('.delete-note').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-id');
      try {
        await fetchJson(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
        setStatus('Note deleted.');
        loadNotes();
      } catch (error) {
        setStatus(error.message || 'Unable to delete note.');
      }
    });
  });

  notesList.querySelectorAll('.edit-note').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      const note = allNotes.find((item) => item.id === id);
      if (!note) return;

      editingNoteId = id;
      noteTitle.value = note.title || '';
      noteBody.value = note.body || '';
      sourceUrl.value = note.sourceUrl || '';
      composeHeading.textContent = 'Edit note';
      submitNoteButton.textContent = 'Update note';
      cancelEditButton.classList.remove('hidden');
      setStatus('Editing note. Save to update it.');
      noteTitle.focus();
    });
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  const confirmValue = confirmPassword.value;

  if (!email || !password) {
    setAuthStatus('Please enter both email and password.', true);
    return;
  }

  if (authMode === 'register' && password !== confirmValue) {
    setAuthStatus('Passwords do not match.', true);
    return;
  }

  try {
    const result = await fetchJson(`/api/${authMode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    currentUser = result.user;
    authForm.reset();
    renderAppState();
    setAuthStatus(authMode === 'register' ? 'Account created successfully.' : 'Logged in successfully.');
  } catch (error) {
    setAuthStatus(error.message || 'Authentication failed.', true);
  }
}

noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setStatus('Please log in before saving notes.');
    return;
  }

  const title = noteTitle.value.trim();
  const body = noteBody.value.trim();

  if (!body) {
    setStatus('Please add some note content before saving.');
    return;
  }

  try {
    if (editingNoteId) {
      await fetchJson(`/api/notes/${encodeURIComponent(editingNoteId)}`, {
        method: 'PUT',
        body: JSON.stringify({ title, body, sourceUrl: sourceUrl.value.trim() })
      });
      setStatus('Note updated.');
    } else {
      await fetchJson('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title, body, sourceUrl: sourceUrl.value.trim() })
      });
      setStatus('Note saved.');
    }

    noteForm.reset();
    editingNoteId = null;
    composeHeading.textContent = 'New note';
    submitNoteButton.textContent = 'Save note';
    cancelEditButton.classList.add('hidden');
    loadNotes();
  } catch (error) {
    setStatus(error.message || 'Unable to save note.');
  }
});

cancelEditButton.addEventListener('click', () => {
  editingNoteId = null;
  noteForm.reset();
  composeHeading.textContent = 'New note';
  submitNoteButton.textContent = 'Save note';
  cancelEditButton.classList.add('hidden');
  setStatus('Edit cancelled.');
});

document.getElementById('captureCurrent').addEventListener('click', () => {
  sourceUrl.value = window.location.href;
  setStatus('Current page URL captured.');
});

resetNotesButton.addEventListener('click', async () => {
  if (!currentUser || !allNotes.length) return;
  if (!window.confirm('Delete all your notes? This cannot be undone.')) return;

  try {
    for (const note of allNotes) {
      await fetchJson(`/api/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' });
    }
    setStatus('All notes cleared.');
    loadNotes();
  } catch (error) {
    setStatus(error.message || 'Unable to clear notes.');
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await fetchJson('/api/logout', { method: 'POST' });
  } catch (error) {
    // Clear the local view even if the session has already expired.
  } finally {
    currentUser = null;
    activeView = 'home';
    renderAppState();
  }
});

showLoginButton.addEventListener('click', () => {
  showAuth('login');
});

showRegisterButton.addEventListener('click', () => {
  showAuth('register');
});

homeLoginButton.addEventListener('click', () => showAuth('login'));
homeExploreLoginButton.addEventListener('click', () => showAuth('login'));
homeSignupButton.addEventListener('click', () => showAuth('register'));
homeGetStartedButton.addEventListener('click', () => showAuth('register'));
backHomeButton.addEventListener('click', () => {
  activeView = 'home';
  renderAppState();
});

noteSearch.addEventListener('input', (event) => {
  searchTerm = event.target.value;
  renderNotes();
});

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyTheme(button.dataset.themeChoice, true);
  });
});

fontButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyFont(button.dataset.fontChoice, true);
  });
});

authForm.addEventListener('submit', handleAuthSubmit);

renderAuthTabs();
loadSession();
