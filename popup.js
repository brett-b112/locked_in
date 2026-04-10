document.addEventListener("DOMContentLoaded", async () => {
  initPomodoro();

  const sites = await getBlockedSites();
  renderList(sites);

  document.getElementById("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("site-input");
    const errorEl = document.getElementById("input-error");
    const raw = input.value.trim();

    const hostname = normalizeHostname(raw);

    if (!isValidHostname(hostname)) {
      errorEl.textContent = "Enter a valid domain like reddit.com";
      return;
    }

    errorEl.textContent = "";
    const current = await getBlockedSites();

    if (current.includes(hostname)) {
      errorEl.textContent = `${hostname} is already blocked.`;
      return;
    }

    try {
      await saveBlockedSites([...current, hostname]);
      input.value = "";
      renderList(await getBlockedSites());
    } catch {
      errorEl.textContent = "Failed to save. Storage quota may be exceeded.";
    }
  });

  // Clear error on input change
  document.getElementById("site-input").addEventListener("input", () => {
    document.getElementById("input-error").textContent = "";
  });
});

// --- Pomodoro Timer ---

let _pomodoroInterval = null;

async function initPomodoro() {
  const { timerState = { status: "idle" } } = await chrome.storage.local.get("timerState");
  renderPomodoroState(timerState);

  document.querySelectorAll(".btn-preset").forEach(btn => {
    btn.addEventListener("click", async () => {
      const durationMs = Number(btn.dataset.minutes) * 60 * 1000;
      const endTime = Date.now() + durationMs;
      chrome.runtime.sendMessage({ type: "POMODORO_START", durationMs });
      renderPomodoroState({ status: "running", endTime, durationMs });
    });
  });

  document.getElementById("btn-stop").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "POMODORO_STOP" });
    renderPomodoroState({ status: "idle" });
  });
}

function renderPomodoroState(timerState) {
  clearInterval(_pomodoroInterval);
  const timeEl = document.getElementById("pomodoro-time");
  const stopBtn = document.getElementById("btn-stop");

  document.querySelectorAll(".btn-preset").forEach(btn => btn.classList.remove("active"));

  if (timerState.status !== "running" || !timerState.endTime) {
    timeEl.textContent = "--:--";
    stopBtn.style.display = "none";
    return;
  }

  // Highlight the active preset button
  if (timerState.durationMs) {
    const activeMinutes = timerState.durationMs / 60000;
    document.querySelectorAll(".btn-preset").forEach(btn => {
      if (Number(btn.dataset.minutes) === activeMinutes) btn.classList.add("active");
    });
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

// --- End Pomodoro Timer ---

function normalizeHostname(value) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

function isValidHostname(value) {
  if (!value || value.includes(" ")) return false;
  try {
    const url = new URL(`https://${value}`);
    return url.hostname === value && value.includes(".");
  } catch {
    return false;
  }
}

async function getBlockedSites() {
  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  return blockedSites;
}

async function saveBlockedSites(sites) {
  await chrome.storage.sync.set({ blockedSites: sites });
}

function renderList(sites) {
  const ul = document.getElementById("site-list");
  const emptyState = document.getElementById("empty-state");

  ul.innerHTML = "";

  if (sites.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  for (const site of sites) {
    const li = document.createElement("li");
    li.className = "site-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "site-name";
    nameSpan.textContent = site; // textContent only — no innerHTML

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "✕";
    removeBtn.title = `Unblock ${site}`;
    removeBtn.addEventListener("click", async () => {
      try {
        const updated = (await getBlockedSites()).filter(s => s !== site);
        await saveBlockedSites(updated);
        renderList(await getBlockedSites());
      } catch {
        // Storage write failed; list unchanged
      }
    });

    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    ul.appendChild(li);
  }
}
