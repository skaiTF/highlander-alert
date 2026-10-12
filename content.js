const sound = new Audio(chrome.runtime.getURL("alert.mp3"));
sound.volume = 0.6;

const ALERT_TYPES = ["highlander"];

const seen = new Set();
let primed = false; // don't ding for lobbies that are already listed on load

function scan(container) {
  const panels = container.querySelectorAll('.lobbyOverviewPanel[id^="lobbyOverview-"]');
  for (const panel of panels) {
    const type = panel.querySelector(".gameType")?.textContent.trim();
    if (!type || type === "GAMETYPE") continue; // template not filled in yet
    if (seen.has(panel.id)) continue;
    seen.add(panel.id);
    if (primed && ALERT_TYPES.includes(type.toLowerCase())) {
      sound.play().catch(console.warn);
    }
  }
}

function start(container) {
  scan(container);
  setTimeout(() => (primed = true), 3000); // grace period for the initial AJAX fill

  let pending = null;
  new MutationObserver(() => {
    if (pending) return; // throttle, but never starve
    pending = setTimeout(() => {
      pending = null;
      scan(container);
    }, 100);
  }).observe(container, { childList: true, subtree: true, characterData: true });
}

const container = document.getElementById("lobbyContainer");
if (container) {
  start(container);
} else {
  const waiter = new MutationObserver(() => {
    const c = document.getElementById("lobbyContainer");
    if (c) { waiter.disconnect(); start(c); }
  });
  waiter.observe(document.body, { childList: true, subtree: true });
}