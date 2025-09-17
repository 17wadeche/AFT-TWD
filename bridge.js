(() => {
  window.__aftCollectPdfLinks = function () {
    return new Promise((resolve) => {
      function onMsg(ev) {
        if (ev.data && ev.data.type === 'AFT_COLLECT_PDF_LINKS_RESULT') {
          window.removeEventListener('message', onMsg);
          resolve(ev.data.items || []);
        }
      }
      window.addEventListener('message', onMsg);
      window.dispatchEvent(new CustomEvent('AFT_COLLECT_PDF_LINKS'));
    });
  };
  window.__aftNormalizeToPdf = function (u) {
    return new Promise((resolve) => {
      function onMsg(ev) {
        if (ev.data && ev.data.type === 'AFT_NORMALIZE_TO_PDF_RESULT') {
          window.removeEventListener('message', onMsg);
          resolve(ev.data.out || '');
        }
      }
      window.addEventListener('message', onMsg);
      window.dispatchEvent(new CustomEvent('AFT_NORMALIZE_TO_PDF', { detail: u }));
    });
  };
})();
