function getVideoMeta() {
  const titleTag = document.querySelector('meta[property="og:title"]');
  const title = titleTag ? titleTag.getAttribute('content') : null;
  const url = new URL(window.location.href);
  const videoId = url.searchParams.get('v');

  return {
    videoId,
    videoTitle: title || document.title || 'YouTube video',
    url: window.location.href
  };
}

function sendVideoMeta() {
  try {
    chrome.runtime.sendMessage({ type: 'video-data', payload: getVideoMeta() });
  } catch (error) {
    console.warn('Unable to send video data from content script:', error);
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  sendVideoMeta();
} else {
  document.addEventListener('DOMContentLoaded', sendVideoMeta);
}

window.addEventListener('yt-navigate-finish', sendVideoMeta);
window.addEventListener('load', sendVideoMeta);
