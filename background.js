const DEFAULT_BLOCKED_SITES = [
  "reddit.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "twitch.tv",
  "news.ycombinator.com",
  "linkedin.com"
];

// All listeners must be registered synchronously at the top level (MV3 requirement)
chrome.runtime.onInstalled.addListener(handleInstall);
chrome.runtime.onStartup.addListener(rebuildRulesFromStorage);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blockedSites) {
    rebuildAllRules(changes.blockedSites.newValue ?? []);
  }
});

async function handleInstall() {
  const { blockedSites } = await chrome.storage.sync.get("blockedSites");
  if (!blockedSites) {
    await chrome.storage.sync.set({ blockedSites: DEFAULT_BLOCKED_SITES });
  }
  await rebuildRulesFromStorage();
}

async function rebuildRulesFromStorage() {
  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  await rebuildAllRules(blockedSites);
}

async function rebuildAllRules(sites) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  const addRules = sites.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ["main_frame", "sub_frame"]
    },
    action: {
      type: "redirect",
      redirect: {
        extensionPath: `/blocked.html?site=${encodeURIComponent(domain)}`
      }
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules
  });
}
