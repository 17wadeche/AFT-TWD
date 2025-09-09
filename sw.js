// background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'aftFetch') return;
  (async () => {
    try {
      const resp = await fetch(msg.url, {
        credentials: 'include',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Accept': 'application/pdf,*/*;q=0.8' }
      });
      const ab = await resp.arrayBuffer();
      const u8 = new Uint8Array(ab);
      sendResponse({
        ok: resp.ok,
        status: resp.status,
        ct: resp.headers.get('content-type') || '',
        url: resp.url,
        buf: Array.from(u8) // keep your existing shape
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // keep the message channel open for async
});
async function fetchSalesforcePdf(url, orgHost) {
  let res = await fetch(url, {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'Accept': 'application/pdf' }
  });
  if (isPdf(res)) return await res.arrayBuffer();
  const sid = await getSidForHost(orgHost);
  if (!sid) throw new Error(`No Salesforce SID cookie for ${orgHost}`);
  const frontdoor = `https://${orgHost}/secur/frontdoor.jsp` +
    `?sid=${encodeURIComponent(sid)}` +
    `&retURL=${encodeURIComponent(url)}`;
  await fetch(frontdoor, {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store'
  });
  res = await fetch(url, {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'Accept': 'application/pdf' }
  });
  if (isPdf(res)) return await res.arrayBuffer();
  res = await fetch(url, {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      'Accept': 'application/pdf',
      'Authorization': `Bearer ${sid}`
    }
  });
  if (isPdf(res)) return await res.arrayBuffer();
  const snippet = await safeText(res);
  throw new Error(`Expected PDF, got ${res.status} ${res.headers.get('content-type') || ''}: ${snippet}`);
}
function isPdf(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return res.ok && ct.startsWith('application/pdf');
}
async function safeText(res) {
  try { return (await res.text()).slice(0, 300); } catch { return ''; }
}
async function getSidForHost(host) {
  const cookies = await chrome.cookies.getAll({ domain: host });
  const c = cookies.find(x => x.name === 'sid' || x.name.startsWith('sid_'));
  return c?.value || null;
}