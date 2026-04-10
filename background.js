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
chrome.runtime.onInstalled.addListener((...args) =>
  handleInstall(...args).catch(err => console.error("[locked-in] install failed:", err))
);
chrome.runtime.onStartup.addListener(() =>
  rebuildRulesFromStorage().catch(err => console.error("[locked-in] startup rebuild failed:", err))
);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blockedSites) {
    rebuildAllRules(changes.blockedSites.newValue ?? [])
      .catch(err => console.error("[locked-in] rule rebuild failed:", err));
  }
});

async function handleInstall() {
  const { blockedSites } = await chrome.storage.sync.get("blockedSites");
  if (!blockedSites) {
    // storage.onChanged will fire from this write and trigger rebuildAllRules automatically
    await chrome.storage.sync.set({ blockedSites: DEFAULT_BLOCKED_SITES });
  } else {
    // Extension update: sites already set, rebuild explicitly (no storage.onChanged fires)
    await rebuildRulesFromStorage();
  }
}

async function rebuildRulesFromStorage() {
  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  await rebuildAllRules(blockedSites);
}

function isValidHostname(value) {
  if (!value || typeof value !== "string" || value.includes(" ")) return false;
  try {
    const url = new URL(`https://${value}`);
    return url.hostname === value && value.includes(".");
  } catch {
    return false;
  }
}

async function rebuildAllRules(sites) {
  // Re-validate all entries from storage before building rules (#7: no blind trust of stored values)
  const validSites = sites.filter(isValidHostname);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  // Use requestDomains instead of urlFilter to match exact domain + subdomains only,
  // without false-positive suffix matches (e.g. ||reddit.com would also match noreddit.com)
  const addRules = validSites.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    condition: {
      requestDomains: [domain],
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
