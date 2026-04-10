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

// --- Pomodoro Timer ---
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "pomodoro") return;
  chrome.storage.local.set({ timerState: { status: "idle", endTime: null, durationMs: null } });
  chrome.action.setBadgeText({ text: "" });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "POMODORO_START") startPomodoro(message.durationMs);
  if (message.type === "POMODORO_STOP") stopPomodoro();
  return false;
});

async function startPomodoro(durationMs) {
  const endTime = Date.now() + durationMs;
  await chrome.alarms.clear("pomodoro");
  await chrome.alarms.create("pomodoro", { when: endTime });
  await chrome.storage.local.set({ timerState: { status: "running", endTime, durationMs } });
  updateBadge(endTime);
}

async function stopPomodoro() {
  await chrome.alarms.clear("pomodoro");
  await chrome.storage.local.set({ timerState: { status: "idle", endTime: null, durationMs: null } });
  chrome.action.setBadgeText({ text: "" });
}

function updateBadge(endTime) {
  const remainingMs = endTime - Date.now();
  if (remainingMs <= 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  chrome.action.setBadgeText({ text: String(mins) });
  chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
}
// --- End Pomodoro Timer ---

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

// Call this from the service worker DevTools console to inspect active rules:
// chrome.declarativeNetRequest.getDynamicRules(r => console.log(JSON.stringify(r, null, 2)))
async function rebuildAllRules(sites) {
  // Re-validate all entries from storage before building rules (#7: no blind trust of stored values)
  const validSites = sites.filter(isValidHostname);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  // urlFilter "||domain.com" anchors to the domain boundary — it will match
  // domain.com and subdomains like www.domain.com but NOT noreddit.com.
  // requestDomains cannot be used alone with redirect actions (Chrome requires
  // a urlFilter or regexFilter when action type is redirect).
  const addRules = validSites.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    condition: {
      urlFilter: `||${domain}/`,
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

  console.log(`[locked-in] rules rebuilt: ${addRules.length} active, ${removeIds.length} removed`, addRules.map(r => r.condition.urlFilter));
}
