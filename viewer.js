const params = new URLSearchParams(location.search);
window.__AFT_FROM_VIEWER = true;                    // flag checked in content.js
window.__AFT_FETCH_URL   = params.get('src') || ''; // override fetch URL
(async () => {
  try {
    await import(chrome.runtime.getURL('content.js'));
  } catch (err) {
    console.error('[AFT viewer] Failed to import content.js:', err);
    document.body.textContent = 'Error loading viewer.';
  }
})();
