# Locked In

A minimal Chrome extension that blocks distracting websites so you can focus on what matters.

Blocks Reddit, X/Twitter, YouTube, TikTok, and more by default. Fully configurable.

## Install

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select this folder (`locked_in/`)

The extension is now active. Navigate to any blocked site to see it in action.

## Usage

Click the 🔒 icon in your Chrome toolbar to open the popup.

- **Add a site**: Type a domain (e.g. `reddit.com`) and click **Block**
- **Remove a site**: Click ✕ next to any site in the list

Changes take effect immediately — no reload needed.

## Default Block List

On first install, these sites are blocked:

- reddit.com
- x.com / twitter.com
- facebook.com
- instagram.com
- tiktok.com
- youtube.com
- twitch.tv
- news.ycombinator.com
- linkedin.com

## Files

```
manifest.json     MV3 manifest
background.js     Service worker — manages blocking rules
popup.html/js/css Toolbar popup UI
blocked.html/js/css Page shown when a site is blocked
icons/            Extension icons (16, 48, 128px)
```

## Technical Notes

- Built with **Manifest V3** and the `declarativeNetRequest` API
- Blocking happens at the browser network layer — no page flash
- Block list syncs across your Chrome devices via `chrome.storage.sync`
- No build step required — plain HTML, CSS, and JavaScript
