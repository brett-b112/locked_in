# feat: Build "Locked In" Chrome Extension (Manifest V3)

## Overview

Build a production-ready Chrome extension called **Locked In** that blocks distracting websites (Reddit, X/Twitter, etc.) and redirects users to a motivating "locked in" page. Users can configure which sites are blocked via a clean popup UI.

## Problem Statement

Knowledge workers lose significant focus time to habitual distracting sites. Browser-level blocking is more reliable than willpower alone — but existing blockers are often heavy, ugly, or require subscriptions. Locked In is a minimal, focused, beautifully designed Chrome extension that gets out of the way and just works.

## Proposed Solution

A Manifest V3 Chrome extension with three components:

1. **Service worker** — syncs `declarativeNetRequest` blocking rules with the user's stored block list
2. **Popup UI** — lets users add/remove blocked sites
3. **Blocked page** — a clean, motivating page shown instead of blocked sites

## Technical Approach

### Architecture

```
User navigates to reddit.com
        │
        ▼
Chrome evaluates declarativeNetRequest dynamic rules (browser-native, no SW needed)
        │
        │  Rule matches: urlFilter = "||reddit.com"
        ▼
Redirect → chrome-extension://<id>/blocked.html?site=reddit.com
        │
        ▼
blocked.html shown — reads ?site param, displays motivating message

Meanwhile, in popup:
User adds/removes hostname → popup.js → chrome.storage.sync.set()
        │
        ▼
chrome.storage.onChanged fires in service-worker.js
        │
        ▼
rebuildAllRules() → chrome.declarativeNetRequest.updateDynamicRules()
        │
        ▼
New rules active immediately (no extension restart needed)
```

### Key API Choices

| Decision | Choice | Reason |
|---|---|---|
| Blocking mechanism | `declarativeNetRequest` dynamic rules | MV3-native, browser-level enforcement, no SW alive needed |
| Storage | `chrome.storage.sync` | Syncs block list across user's devices |
| Redirect target | `extensionPath: "/blocked.html"` | No hard-coded extension ID, works in dev and prod |
| URL filter pattern | `||domain.com` | Matches domain + all subdomains/paths |
| Resource types | `["main_frame", "sub_frame"]` | Blocks top-level and iframe navigations only |

### File Structure

```
locked_in/
├── manifest.json           # MV3 manifest
├── background.js           # Service worker: syncs DNR rules with storage
├── popup.html              # Toolbar popup UI
├── popup.js                # Popup logic: add/remove sites, render list
├── popup.css               # Popup styles
├── blocked.html            # Page shown when a site is blocked
├── blocked.js              # Reads ?site param, renders message, go-back button
├── blocked.css             # Blocked page styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── plans/
    └── feat-locked-in-chrome-extension.md
```

### manifest.json (key fields)

```json
{
  "manifest_version": 3,
  "name": "Locked In",
  "version": "1.0.0",
  "description": "Block distracting websites and stay focused.",
  "permissions": [
    "declarativeNetRequest",
    "storage"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "web_accessible_resources": [
    {
      "resources": ["blocked.html", "blocked.js", "blocked.css"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

Notes:
- No `tabs` or `webNavigation` permissions needed — `declarativeNetRequest` handles blocking at the network layer without them
- `<all_urls>` host permission is required for dynamic DNR rules to apply to arbitrary domains
- No inline scripts anywhere — MV3 CSP blocks them; all JS in external `.js` files

### background.js (service worker)

```js
// Register all listeners synchronously at top level (MV3 requirement)
chrome.runtime.onInstalled.addListener(rebuildRulesFromStorage);
chrome.runtime.onStartup.addListener(rebuildRulesFromStorage);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blockedSites) {
    rebuildAllRules(changes.blockedSites.newValue ?? []);
  }
});

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
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
}
```

### popup.html / popup.js (key patterns)

- Fixed `width: 340px` on body (Chrome sizes popup to content)
- No inline `onclick` attributes — MV3 CSP blocks them
- Re-read storage on every popup open (popups are ephemeral)
- Input normalization: strip `https://`, lowercase, strip trailing `/`
- Hostname validation via `new URL(`https://${value}`)` — throws on invalid input

### blocked.html / blocked.js

- Reads `?site` query param via `URLSearchParams`
- Displays site name using `.textContent` (never `.innerHTML` — XSS risk)
- "Go Back" button: `history.back()` if history exists, else `chrome.tabs.update` to new tab page
- Motivating copy and clean design matching the "Locked In" brand

### Default Blocked Sites

On first install, seed the block list with common distractors:

```js
// In onInstalled handler
const defaults = [
  "reddit.com", "x.com", "twitter.com", "facebook.com",
  "instagram.com", "tiktok.com", "youtube.com", "twitch.tv",
  "news.ycombinator.com", "linkedin.com"
];
const { blockedSites } = await chrome.storage.sync.get("blockedSites");
if (!blockedSites) {
  await chrome.storage.sync.set({ blockedSites: defaults });
}
```

## Implementation Phases

### Phase 1: Core Blocking (Foundation)

- `manifest.json` with correct MV3 structure
- `background.js` service worker with `rebuildAllRules()`
- `chrome.storage.sync` for block list persistence
- Default blocked sites on install
- `blocked.html` / `blocked.js` / `blocked.css` — basic version

**Success criteria:** Navigating to reddit.com redirects to `blocked.html`

### Phase 2: Popup UI (Configuration)

- `popup.html` with input field and site list
- `popup.js` with add/remove/render logic
- `popup.css` with clean, minimal styling
- Input validation and normalization
- Empty state (no sites blocked)

**Success criteria:** User can add/remove sites from the popup; changes take effect immediately without reloading

### Phase 3: Polish (Production-Ready)

- Motivating copy and branding on `blocked.html` ("You're Locked In.")
- Extension icons (16px, 48px, 128px) — lock/focus motif
- Graceful "Go Back" behavior on blocked page
- Handle edge cases: `www.` prefix, trailing slash, `http://` vs `https://`
- README with installation instructions (load unpacked)

**Success criteria:** Extension looks and feels production-ready; no UX rough edges

## Acceptance Criteria

### Functional Requirements

- [x] Navigating to a blocked site redirects to `blocked.html` immediately (no page flash)
- [x] Blocked page shows the domain that was blocked
- [x] Blocked page has a working "Go Back" button
- [x] Default block list is seeded on first install
- [x] Popup lists all currently blocked sites
- [x] Popup add form validates hostname input (rejects invalid input gracefully)
- [x] Popup remove button immediately unblocks a site
- [x] Block list persists across browser restarts
- [x] Block list syncs across devices (Chrome sync)
- [x] Adding a site takes effect immediately — no extension reload needed
- [x] Removing a site takes effect immediately

### Non-Functional Requirements

- [x] Zero inline scripts (MV3 CSP compliant)
- [x] Hostname input sanitized before storage (`encodeURIComponent` for query params, `.textContent` for DOM)
- [x] No `tabs`, `webNavigation`, or `webRequest` permissions (minimal footprint)
- [x] Extension installs without Chrome warning about excessive permissions
- [x] Service worker re-initializes correctly after termination (all listeners registered synchronously)

### Quality Gates

- [x] Loads as unpacked extension without errors in `chrome://extensions`
- [x] No errors in service worker DevTools console
- [x] No errors in popup DevTools console
- [x] Blocking works for both `http://` and `https://` variants
- [x] Blocking works for `www.` subdomain variants

## Dependencies & Prerequisites

- Chrome 88+ (declarativeNetRequest GA)
- Chrome 102+ if using `chrome.storage.session`
- No npm or build toolchain required — plain HTML/CSS/JS
- Icons: need 16×16, 48×48, 128×128 PNG files

## Risk Analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| Service worker terminated mid-rebuild | Low | `updateDynamicRules` is atomic; rules are stored at browser level independently |
| Rule ID collision on rebuild | Low | Full rebuild clears all existing IDs before adding new ones |
| User enters URL instead of hostname | Medium | Normalize input: strip protocol and path before storing |
| `www.` prefix matching | Medium | `||domain.com` pattern in DNR matches `www.domain.com` automatically |
| Storage quota exceeded | Very Low | `storage.sync` allows 512 items; 100 blocked sites ≈ ~2KB |

## Future Considerations

- **Focus sessions / schedules**: Block sites only during configured hours (use `chrome.alarms`)
- **Block page with productivity tips or quotes**: Rotating motivational quotes on `blocked.html`
- **Allowlist / temporary override**: "Let me in for 5 minutes" with a timer
- **Statistics**: Track how many times each site was blocked (store counts in `storage.local`)
- **Firefox compatibility**: WebExtensions API is largely compatible; `declarativeNetRequest` supported in Firefox 113+

## References & Research

### Chrome Extension APIs

- [declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Manifest V3 overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Service worker lifecycle in MV3](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [web_accessible_resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)

### Security

- MV3 CSP blocks inline scripts and `eval()` — all JS in external files
- Use `.textContent` not `.innerHTML` when rendering user-controlled data
- Validate hostnames via `new URL()` constructor before storing
- Always `encodeURIComponent` user data appended to query strings
