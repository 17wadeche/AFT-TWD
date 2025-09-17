const params = new URLSearchParams(location.search);
window.__AFT_FROM_VIEWER = true;
window.__AFT_FETCH_URL   = params.get('src') || '';
function getNameFromUrl(u = '') {
  try {
    const url = new URL(u);
    const qpName =
      url.searchParams.get('filename') ||
      url.searchParams.get('fileName') ||
      url.searchParams.get('name') ||
      url.searchParams.get('download');
    let last = (url.pathname.split('/').pop() || '').trim();
    const raw = (qpName || last);
    return decodeURIComponent(raw).replace(/[\/\\?%*:|"<>]/g, '').trim();
  } catch { return ''; }
}
const prelimName = getNameFromUrl(window.__AFT_FETCH_URL);
if (prelimName) document.title = prelimName;
(async () => {
  try {
    await import(chrome.runtime.getURL('content.js'));
  } catch (err) {
    console.error('[AFT viewer] Failed to import content.js:', err);
    document.body.textContent = 'Error loading viewer.';
  }
})();
