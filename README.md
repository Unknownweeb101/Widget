# YouTube Notes

A lightweight notes app that works in two modes:

- Browser mode: open the app directly in any modern browser without installing anything
- Extension mode: load it as an unpacked extension in Chrome, Edge, and most Chromium-based browsers

## Features

- Save notes with a title, body, and optional URL
- Work in a normal browser tab without an extension install
- Use the extension version to capture YouTube video context when available
- Store notes locally in the browser
- Save an Anthropic API key for future summarization
- Toggle automatic summarization after 30 seconds

## Easiest way to load it

### Option 1: Any browser

1. Open the project folder in your browser
2. Open `index.html` directly, or run:
   `python3 -m http.server 8000`
3. Visit `http://localhost:8000`

This is the simplest method for Chrome, Firefox, Safari, Edge, and other browsers.

### Option 2: Chrome/Edge extension

1. Open `chrome://extensions` or `edge://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select this project folder

## Files

- `index.html` — browser-friendly app entry point
- `app.js` — local storage note logic for browser mode
- `styles.css` — browser mode styling
- `manifest.json` — extension metadata for Chromium browsers
- `popup.html` — extension popup UI
- `popup.js` — extension popup logic
- `content.js` — reads YouTube video data
- `background.js` — note storage and summary logic

## Notes

This version keeps the app lightweight and portable. Browser mode works everywhere with standard web APIs, while the extension mode remains available for Chromium-based browsers that support unpacked extensions.

