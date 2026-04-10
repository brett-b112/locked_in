# feat: Pomodoro Timer

## Overview

Add a Pomodoro timer to the extension popup with three preset durations (25m, 5m, 30m). The user can click any preset at any time to start that timer — no mandatory sequence. A running timer persists across popup closes via `chrome.alarms` + `chrome.storage.local`, and the extension badge shows the remaining minutes while the popup is closed.

## Acceptance Criteria

- [x] Popup shows a timer section above "Blocked Sites" with three preset buttons: 25m, 5m, 30m
- [x] Clicking any preset immediately starts that timer (cancels any in-progress timer without confirmation)
- [x] A Stop button appears while a timer is running; clicking it resets to idle
- [x] The countdown (`MM:SS`) is visible in the popup and updates every second while open
- [x] Timer continues counting down when popup is closed (survives popup lifecycle)
- [x] Extension badge shows remaining minutes (`1`, `24`, etc.) while a timer is running; clears on idle
- [x] Timer auto-stops and clears the badge when it reaches 00:00

## Architecture

### Why `chrome.alarms` + `chrome.storage.local`

The popup is destroyed when closed — any `setInterval` in `popup.js` dies with it. MV3 service workers also go idle and lose global state. The correct pattern:

- **`background.js`** — owns timer logic. Registers alarm at absolute end-time (`when: endTime`). Handles `onAlarm` to mark timer done.
- **`chrome.storage.local`** — persists timer state (`status`, `endTime`). Survives SW restarts.
- **`popup.js`** — reads storage on open, runs a local `setInterval` purely for display (computes `endTime - Date.now()`), sends commands to background via `chrome.runtime.sendMessage`.

### Timer State Shape (`chrome.storage.local`)

```js
// key: "timerState"
{
  status: 'idle' | 'running',
  endTime: 1712601500000,   // epoch ms — null when idle
  durationMs: 1500000,      // preset duration — null when idle
}
```

No pause/resume — user just clicks a new preset or Stop to cancel. Keeps it simple.

## Files to Change

### `manifest.json`

Add `"alarms"` to the `permissions` array (line 9 area):

```json
"permissions": [
  "declarativeNetRequest",
  "declarativeNetRequestFeedback",
  "storage",
  "alarms"
]
```

### `background.js`

Add at the top level (alongside existing listeners):

```js
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
```

### `popup.html`

Add a pomodoro section between the input error paragraph and the "Blocked Sites" list-header:

```html
<div class="pomodoro-section">
  <div class="pomodoro-display" id="pomodoro-display">
    <span class="pomodoro-time" id="pomodoro-time">--:--</span>
  </div>
  <div class="pomodoro-presets">
    <button class="btn-preset" data-minutes="25">25m</button>
    <button class="btn-preset" data-minutes="5">5m</button>
    <button class="btn-preset" data-minutes="30">30m</button>
    <button class="btn-stop" id="btn-stop">Stop</button>
  </div>
</div>
```

### `popup.js`

Add a `initPomodoro()` function called from `DOMContentLoaded`. It:

1. Reads `timerState` from `chrome.storage.local`
2. Renders the current countdown (or `--:--` if idle)
3. Hides/shows Stop button based on status
4. Starts a local `setInterval(renderTimer, 1000)` if running
5. Wires preset buttons to send `POMODORO_START` message
6. Wires Stop button to send `POMODORO_STOP` message
7. Clicking a preset while running cancels the old interval and starts a new one

```js
// popup.js additions

async function initPomodoro() {
  const { timerState = { status: "idle" } } = await chrome.storage.local.get("timerState");
  renderPomodoroState(timerState);

  document.querySelectorAll(".btn-preset").forEach(btn => {
    btn.addEventListener("click", async () => {
      const durationMs = Number(btn.dataset.minutes) * 60 * 1000;
      await chrome.runtime.sendMessage({ type: "POMODORO_START", durationMs });
      const { timerState: ts } = await chrome.storage.local.get("timerState");
      renderPomodoroState(ts);
    });
  });

  document.getElementById("btn-stop").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "POMODORO_STOP" });
    renderPomodoroState({ status: "idle" });
  });
}

let _pomodoroInterval = null;

function renderPomodoroState(timerState) {
  clearInterval(_pomodoroInterval);
  const timeEl = document.getElementById("pomodoro-time");
  const stopBtn = document.getElementById("btn-stop");

  if (timerState.status !== "running" || !timerState.endTime) {
    timeEl.textContent = "--:--";
    stopBtn.style.display = "none";
    return;
  }

  stopBtn.style.display = "inline-block";

  function tick() {
    const remaining = Math.max(0, timerState.endTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timeEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    if (remaining === 0) {
      clearInterval(_pomodoroInterval);
      stopBtn.style.display = "none";
    }
  }

  tick();
  _pomodoroInterval = setInterval(tick, 1000);
}
```

### `popup.css`

Add styles for the new section, matching existing design system:

- Container: `padding: 12px 16px`, `border-bottom: 1px solid #222222`
- Time display: monospace font, `28px`, `#ffffff`, centered
- Preset buttons: pill-shaped, `#1e1e1e` background, `1px solid #2e2e2e` border, white text — active/running preset gets `border-color: #ffffff`
- Stop button: matches `.btn-remove` ghost style with red hover

## Implementation Notes

- The `chrome.alarms.onAlarm` listener **must** be registered at the top level of `background.js` (not inside an async function) — MV3 requirement. Matches existing pattern at line 14.
- `chrome.storage.local` (not `.sync`) for timer state — timer is device-local, not worth syncing across devices.
- Badge text is cleared both in `onAlarm` and `stopPomodoro` — two paths to idle.
- No "notifications" permission needed for MVP; can be added later for an end-of-session alert.
- The local popup `setInterval` is purely cosmetic — if it drifts, the alarm in background.js is ground truth.
- Clicking a preset while a timer is running: `startPomodoro` calls `chrome.alarms.clear("pomodoro")` first, so the old alarm is always cancelled before creating a new one.

## References

- `background.js:14` — existing pattern for top-level MV3 listener registration
- `manifest.json:6-10` — permissions array to add `"alarms"` to
- `popup.css:133` — `.site-name` monospace font family to reuse for timer digits
- `popup.css:63` — `.btn-add` style to reference for preset button sizing
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [MV3 service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
