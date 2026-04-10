// Fallback for PWA/service-worker cached navigations that bypass declarativeNetRequest.
// Reads the block list from storage and redirects if the current hostname is blocked.
(async () => {
  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  const hostname = location.hostname.replace(/^www\./, "");

  const isBlocked = blockedSites.some(site => hostname === site || hostname.endsWith(`.${site}`));

  if (isBlocked) {
    window.location.replace(
      chrome.runtime.getURL(`/blocked.html?site=${encodeURIComponent(hostname)}`)
    );
  }
})();
