// sw.js (MV3 service worker)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'aftOpenViewer' && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return; // no async work
  }
  if (msg.type !== 'aftFetch') return;
  (async () => {
    try {
      const targetUrl = new URL(msg.url);
      const isSf = /(?:^|\.)force\.com$/i.test(targetUrl.hostname) ||
                   /\/sfc\/servlet\.shepherd\//.test(targetUrl.pathname);
      let bufU8, meta = { ok: true, status: 200, url: msg.url, ct: 'application/pdf' };
      if (isSf) {
        const rawHost = targetUrl.hostname;
        const cands = dedupe([
          msg.orgHost,
          rawHost,
          rawHost.replace('.file.force.com', '.lightning.force.com'),
          rawHost.replace('.content.force.com', '.lightning.force.com'),
          rawHost.replace('.documentforce.com', '.lightning.force.com'),
        ]).filter(Boolean);
        let lastErr;
        for (const orgHost of cands) {
          try {
            const ab = await fetchSalesforcePdf(msg.url, orgHost);
            bufU8 = new Uint8Array(ab);
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!bufU8) throw lastErr || new Error('Failed to fetch Salesforce PDF');
      } else {
        const resp = await fetch(msg.url, {
          credentials: 'include',
          redirect: 'follow',
          cache: 'no-store',
          headers: { 'Accept': 'application/pdf,*/*;q=0.8' }
        });
        const ab = await resp.arrayBuffer();
        bufU8 = new Uint8Array(ab);
        meta = {
          ok: resp.ok,
          status: resp.status,
          url: resp.url,
          ct: resp.headers.get('content-type') || ''
        };
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
      }
      sendResponse({
        ok: true,
        status: meta.status,
        ct: meta.ct,
        url: meta.url,
        buf: Array.from(bufU8) // keep shape expected by content.js
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // keep channel open for async
});
function dedupe(arr) {
  const s = new Set();
  const out = [];
  for (const v of arr) if (!s.has(v)) { s.add(v); out.push(v); }
  return out;
}
async function fetchSalesforcePdf(url, orgHost) {
  let res = await fetch(url, {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'Accept': 'application/pdf' }
  });
  if (isPdf(res)) return await res.arrayBuffer();
  const sid = await getSidForOrg(orgHost);
  if (!sid) throw new Error(`No Salesforce SID cookie found for ${orgHost}`);
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
async function getSidForOrg(orgHost) {
  const tries = dedupe([
    orgHost,
    baseDomain(orgHost, 3),            // e.g., sandbox.lightning.force.com
    baseDomain(orgHost, 2),            // e.g., lightning.force.com
    'my.salesforce.com',
    'salesforce.com',
    'force.com',
    'lightning.force.com',
  ]).filter(Boolean);
  for (const d of tries) {
    const sid = await findSidCookie({ domain: d });
    if (sid) return sid;
  }
  return await findSidCookie({});
}
function baseDomain(host, parts) {
  if (!host) return null;
  const bits = host.split('.');
  if (bits.length < parts) return host;
  return bits.slice(-parts).join('.');
}
async function findSidCookie(filter) {
  const cookies = await chrome.cookies.getAll(filter);
  const candidates = cookies
    .filter(c => c && (c.name === 'sid' || c.name.startsWith('sid_')))
    .filter(c => /(?:salesforce|force)\.com$/i.test(c.domain) || /lightning\.force\.com$/i.test(c.domain));
  candidates.sort((a, b) => {
    const ad = a.domain.length - b.domain.length;
    if (ad) return ad; // longer domain first
    return (b.path || '').length - (a.path || '').length; // longer path first
  }).reverse();
  return candidates[0]?.value || null;
}