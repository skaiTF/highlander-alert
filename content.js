const DEFAULT_SETTINGS = { enabled: true, volume: 0.6, types: ["highlander"] };
const SYNC_KEYS = ["enabled", "volume", "types"];

let settings = { ...DEFAULT_SETTINGS };
let customSound = null;

let audio = null;
let audioSrc = null;

const seen = new Set();
let primed = false; // don't ding for lobbies that are already listed on load

function normalizeType(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesSelectedType(type) {
  const norm = normalizeType(type);
  if (!norm) return false;
  return settings.types.some((selected) => {
    const key = normalizeType(selected);
    return key && (norm === key || norm.includes(key));
  });
}

function playAlert() {
  const src = customSound || chrome.runtime.getURL("alert.mp3");
  if (!audio || audioSrc !== src) {
    audio = new Audio(src);
    audioSrc = src;
  }
  audio.volume = Math.min(1, Math.max(0, Number(settings.volume) || 0));
  try {
    audio.currentTime = 0;
  } catch (e) {
    /* ignore */
  }
  audio.play().catch(console.warn);
}

function scan(container) {
  const panels = container.querySelectorAll('.lobbyOverviewPanel[id^="lobbyOverview-"]');
  for (const panel of panels) {
    const type = panel.querySelector(".gameType")?.textContent.trim();
    if (!type || type === "GAMETYPE") continue; // template not filled in yet
    if (seen.has(panel.id)) continue;
    seen.add(panel.id);
    if (primed && settings.enabled && matchesSelectedType(type)) {
      playAlert();
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

function loadSettings(callback) {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (sync) => {
    // Firefox refuses storage.sync for temporary add-ons that lack an add-on ID;
    // fall back to local storage so the extension still works.
    if (chrome.runtime.lastError) {
      chrome.storage.local.get(DEFAULT_SETTINGS, (local) => finish(local));
    } else {
      finish(sync);
    }
  });
  function finish(source) {
    chrome.storage.local.get({ customSound: null }, (local) => {
      settings = { ...DEFAULT_SETTINGS, ...source };
      if (!Array.isArray(settings.types)) settings.types = [...DEFAULT_SETTINGS.types];
      customSound = local.customSound || null;
      if (callback) callback();
    });
  }
}

chrome.storage.onChanged.addListener((changes) => {
  for (const key of SYNC_KEYS) {
    if (changes[key]) settings[key] = changes[key].newValue;
  }
  if (changes.customSound) customSound = changes.customSound.newValue || null;
});

function boot() {
  const container = document.getElementById("lobbyContainer");
  if (container) {
    start(container);
  } else {
    const waiter = new MutationObserver(() => {
      const c = document.getElementById("lobbyContainer");
      if (c) {
        waiter.disconnect();
        start(c);
      }
    });
    waiter.observe(document.body, { childList: true, subtree: true });
  }
}

loadSettings(boot);
