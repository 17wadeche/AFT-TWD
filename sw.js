// sw.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'aftOpenViewer' && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'aftOpenViewer' && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return;
  }
  if (msg.type !== 'aftFetch') return;
  (async () => {
    try {
      const needsSf = /(?:^|\.)force\.com$/i.test(new URL(msg.url).hostname) ||
                      /\/sfc\/servlet\.shepherd\//.test(msg.url);
      let u8;
      let respMeta = { ok: true, status: 200, url: msg.url, ct: 'application/pdf' };
      if (needsSf) {
        const rawHost = new URL(msg.url).hostname;
        const candidates = [
          msg.orgHost,
          rawHost,
          rawHost.replace('.file.force.com', '.lightning.force.com'),
          rawHost.replace('.content.force.com', '.lightning.force.com')
        ].filter(Boolean);
        let lastErr;
        for (const host of candidates) {
          try {
            const ab = await fetchSalesforcePdf(msg.url, host);
            u8 = new Uint8Array(ab);
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!u8) throw lastErr || new Error('Failed to fetch Salesforce PDF');
      } else {
        const resp = await fetch(msg.url, {
          credentials: 'include',
          redirect: 'follow',
          cache: 'no-store',
          headers: { 'Accept': 'application/pdf,*/*;q=0.8' }
        });
        const ab = await resp.arrayBuffer();
        u8 = new Uint8Array(ab);
        respMeta = {
          ok: resp.ok,
          status: resp.status,
          url: resp.url,
          ct: resp.headers.get('content-type') || ''
        };
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
      }
      sendResponse({
        ok: true,
        status: respMeta.status,
        ct: respMeta.ct,
        url: respMeta.url,
        buf: Array.from(u8)
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; 
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