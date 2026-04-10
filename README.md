# Locked In

A minimal Chrome extension that blocks distracting websites and tracks focus sessions with a Pomodoro timer.

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
- **Start a timer**: Click **25m**, **5m**, or **30m** to start a Pomodoro session
- **Stop a timer**: Click **Stop** to cancel the current session

Changes take effect immediately — no reload needed.

## Pomodoro Timer

The 🍅 Pomodoro timer lives in the popup and persists across popup closes. Click any preset to start a countdown — no mandatory sequence.

- **25m** — focused work session
- **5m** — short break
- **30m** — long break or deep work block

The remaining minutes appear as a badge on the extension icon so you can track time without opening the popup. Clicking a new preset while a timer is running cancels the old one and starts fresh.

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
manifest.json      MV3 manifest
background.js      Service worker — manages blocking rules + Pomodoro timer
popup.html/js/css  Toolbar popup UI
blocked.html/js/css Page shown when a site is blocked
icons/             Extension icons (16, 48, 128px)
```

## Technical Notes

- Built with **Manifest V3** and the `declarativeNetRequest` API
- Blocking happens at the browser network layer — no page flash
- Block list syncs across your Chrome devices via `chrome.storage.sync`
- Pomodoro timer uses `chrome.alarms` — survives popup closes and service worker restarts
- No build step required — plain HTML, CSS, and JavaScript
