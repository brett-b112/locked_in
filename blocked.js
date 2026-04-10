const params = new URLSearchParams(window.location.search);
const site = params.get("site") ?? "this site";

// Always use textContent, never innerHTML — prevents XSS
document.getElementById("site-name").textContent = site;

document.getElementById("btn-back").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    // chrome://newtab is not navigable from extension pages; close the tab instead
    window.close();
  }
});
