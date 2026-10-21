const DEFAULT_SETTINGS = {
  apiKey: '',
  autoSummarize: false
};

const NOTE_KEY = 'youtube-notes';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function getNotes() {
  return new Promise((resolve) => {
    chrome.storage.local.get([NOTE_KEY], (result) => {
      const notes = result[NOTE_KEY] || [];
      resolve(Array.isArray(notes) ? notes : []);
    });
  });
}

function saveNotes(notes) {
  chrome.storage.local.set({ [NOTE_KEY]: notes });
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['youtubeNotesSettings'], (result) => {
      const settings = result.youtubeNotesSettings || DEFAULT_SETTINGS;
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });
}

function buildLocalSummary(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return 'No note content yet.';
  }

  const words = trimmed.split(/\s+/);
  const summary = words.slice(0, 40).join(' ');
  return words.length > 40 ? `${summary}…` : summary;
}

async function summarizeWithAnthropic({ apiKey, title, body }) {
  const prompt = [
    'Summarize the following note into a concise, useful summary.',
    'Keep it highly readable and focused on the main ideas.',
    '',
    `Title: ${title || 'Untitled note'}`,
    '',
    'Content:',
    body
  ].join('\n');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      temperature: 0.2,
      system: 'You are a helpful assistant that turns notes into short, clear summaries.',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic summary request failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text || '';

  if (!text) {
    throw new Error('Anthropic returned an empty summary.');
  }

  return text.trim();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'video-data') {
    chrome.storage.local.set({ currentVideo: message.payload || {} });
    return false;
  }

  if (message.type === 'save-note') {
    getNotes().then((notes) => {
      const entry = {
        id: message.payload.id || `note-${Date.now()}`,
        title: message.payload.title || 'Untitled note',
        body: message.payload.body || '',
        videoId: message.payload.videoId || '',
        videoTitle: message.payload.videoTitle || 'YouTube video',
        createdAt: message.payload.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      const next = [entry, ...notes];
      saveNotes(next);
      sendResponse({ ok: true, notes: next });
    });
    return true;
  }

  if (message.type === 'list-notes') {
    getNotes().then((notes) => {
      const videoId = message.payload && message.payload.videoId;
      const filtered = videoId ? notes.filter((note) => note.videoId === videoId) : notes;
      sendResponse({ notes: filtered });
    });
    return true;
  }

  if (message.type === 'delete-note') {
    getNotes().then((notes) => {
      const filtered = notes.filter((note) => note.id !== message.payload.id);
      saveNotes(filtered);
      sendResponse({ ok: true, notes: filtered });
    });
    return true;
  }

  if (message.type === 'get-settings') {
    getSettings().then((settings) => {
      sendResponse({ settings });
    });
    return true;
  }

  if (message.type === 'save-settings') {
    const next = {
      ...DEFAULT_SETTINGS,
      ...(message.payload || {})
    };
    chrome.storage.local.set({ youtubeNotesSettings: next });
    sendResponse({ ok: true, settings: next });
    return true;
  }

  if (message.type === 'summarize-note') {
    const { apiKey, body, title } = message.payload || {};
    const rawText = body || '';

    if (!rawText) {
      sendResponse({ ok: true, summary: 'No note content yet.', fallback: true });
      return true;
    }

    if (!apiKey) {
      const localSummary = buildLocalSummary(rawText);
      sendResponse({ ok: true, summary: localSummary, fallback: true });
      return true;
    }

    summarizeWithAnthropic({ apiKey, title, body: rawText })
      .then((summary) => {
        sendResponse({ ok: true, summary, fallback: false });
      })
      .catch(() => {
        sendResponse({ ok: true, summary: buildLocalSummary(rawText), fallback: true });
      });

    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    chrome.tabs.sendMessage(tabId, { type: 'refresh-video' }, () => {});
  }
});
