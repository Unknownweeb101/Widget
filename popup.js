const noteForm = document.getElementById('noteForm');
const noteTitle = document.getElementById('noteTitle');
const noteBody = document.getElementById('noteBody');
const videoTitle = document.getElementById('videoTitle');
const videoBadge = document.getElementById('videoBadge');
const notesList = document.getElementById('notesList');
const settingsStatus = document.getElementById('settingsStatus');
const noteStatus = document.getElementById('noteStatus');
const apiKeyInput = document.getElementById('apiKey');
const autoSummarizeInput = document.getElementById('autoSummarize');

let currentVideo = { videoId: '', videoTitle: 'Not available' };
let autoSummarizeTimer = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? '#b84545' : '#66756d';
}

function readSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get-settings' }, (response) => {
      resolve((response && response.settings) || { apiKey: '', autoSummarize: false });
    });
  });
}

function saveSettings() {
  const settings = {
    apiKey: apiKeyInput.value.trim(),
    autoSummarize: autoSummarizeInput.checked
  };

  chrome.runtime.sendMessage({ type: 'save-settings', payload: settings }, (response) => {
    if (response && response.ok) {
      setStatus(settingsStatus, 'Settings saved.', false);
      return;
    }
    setStatus(settingsStatus, 'Could not save settings.', true);
  });
}

function getCurrentTabVideoInfo() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
        resolve({ videoId: '', videoTitle: 'Not on a YouTube video page' });
        return;
      }

      const parsed = new URL(tab.url);
      const videoId = parsed.searchParams.get('v') || '';
      const title = tab.title || 'YouTube video';
      resolve({ videoId, videoTitle: title });
    });
  });
}

function loadSettings() {
  readSettings().then((settings) => {
    apiKeyInput.value = settings.apiKey || '';
    autoSummarizeInput.checked = !!settings.autoSummarize;
  });
}

function listNotes() {
  chrome.runtime.sendMessage({ type: 'list-notes', payload: { videoId: currentVideo.videoId } }, (response) => {
    const notes = (response && response.notes) || [];
    if (!notes.length) {
      notesList.innerHTML = '<p class="empty">No notes for this video yet. Save a note to get started.</p>';
      return;
    }

    const sorted = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    notesList.innerHTML = sorted
      .map((note) => `
        <article class="note">
          <div class="note-top">
            <div class="note-title">${escapeHtml(note.title || 'Untitled note')}</div>
            <button class="danger" type="button" data-note-id="${note.id}">Delete</button>
          </div>
          <div class="note-time">${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString()}</div>
          <p class="note-body">${escapeHtml(note.body || 'No content')}</p>
        </article>
      `)
      .join('');

    notesList.querySelectorAll('[data-note-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-note-id');
        chrome.runtime.sendMessage({ type: 'delete-note', payload: { id } }, () => {
          listNotes();
        });
      });
    });
  });
}

function renderCurrentVideo() {
  getCurrentTabVideoInfo().then((video) => {
    currentVideo = video;
    const displayTitle = video.videoTitle && video.videoTitle !== 'Not on a YouTube video page'
      ? video.videoTitle
      : 'Not on a YouTube video page';

    videoTitle.textContent = displayTitle;
    videoBadge.textContent = video.videoId ? 'Video' : 'No video';

    if (!video.videoId) {
      noteTitle.disabled = true;
      noteBody.disabled = true;
      notesList.innerHTML = '<p class="empty">Open a YouTube video to start taking notes.</p>';
      return;
    }

    noteTitle.disabled = false;
    noteBody.disabled = false;
    listNotes();
  });
}

function scheduleAutoSummary() {
  if (!autoSummarizeInput.checked) {
    return;
  }

  const content = noteBody.value.trim();
  if (!currentVideo.videoId || !content) {
    return;
  }

  clearTimeout(autoSummarizeTimer);
  autoSummarizeTimer = setTimeout(() => {
    summarizeCurrentNote(true);
  }, 30000);
}

async function summarizeCurrentNote(isAuto = false) {
  const body = noteBody.value.trim();
  if (!body) {
    if (!isAuto) {
      setStatus(noteStatus, 'Add some note text before summarizing.', true);
    }
    return;
  }

  const settings = await readSettings();
  const apiKey = settings.apiKey || '';

  chrome.runtime.sendMessage(
    {
      type: 'summarize-note',
      payload: {
        title: noteTitle.value.trim() || 'Summary',
        body,
        videoId: currentVideo.videoId,
        videoTitle: currentVideo.videoTitle,
        apiKey
      }
    },
    (response) => {
      const summaryText = (response && response.summary) || 'Summary is unavailable.';
      noteBody.value = summaryText;
      const message = response && response.fallback
        ? 'Summary created locally because no API key was saved or the request failed.'
        : 'Summary prepared.';
      setStatus(noteStatus, message, false);
      listNotes();
    }
  );
}

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = noteTitle.value.trim();
  const body = noteBody.value.trim();

  if (!currentVideo.videoId) {
    setStatus(noteStatus, 'Open a YouTube video to save a note.', true);
    return;
  }

  if (!body) {
    setStatus(noteStatus, 'Please add some note text before saving.', true);
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: 'save-note',
      payload: {
        title,
        body,
        videoId: currentVideo.videoId,
        videoTitle: currentVideo.videoTitle,
        createdAt: Date.now()
      }
    },
    () => {
      setStatus(noteStatus, 'Note saved.', false);
      noteTitle.value = '';
      noteBody.value = '';
      listNotes();
    }
  );
});

document.getElementById('saveSettings').addEventListener('click', saveSettings);

document.getElementById('captureCurrent').addEventListener('click', () => {
  getCurrentTabVideoInfo().then((video) => {
    currentVideo = video;
    if (video.videoId) {
      noteTitle.value = video.videoTitle || 'Current video';
      noteBody.value = `Captured from: ${video.videoTitle}\nVideo ID: ${video.videoId}`;
      setStatus(noteStatus, 'Current video captured into the note form.', false);
      listNotes();
    }
  });
});

document.getElementById('summarizeCurrent').addEventListener('click', () => summarizeCurrentNote(false));

noteBody.addEventListener('input', () => {
  scheduleAutoSummary();
});

loadSettings();
renderCurrentVideo();
listNotes();
