document.addEventListener("DOMContentLoaded", async () => {
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

    await saveBlockedSites([...current, hostname]);
    input.value = "";
    renderList(await getBlockedSites());
  });

  // Clear error on input change
  document.getElementById("site-input").addEventListener("input", () => {
    document.getElementById("input-error").textContent = "";
  });
});

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
      const updated = (await getBlockedSites()).filter(s => s !== site);
      await saveBlockedSites(updated);
      renderList(updated);
    });

    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    ul.appendChild(li);
  }
}
