chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "CLOSE_ME" && sender.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
  }
});
