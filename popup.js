const DEFAULT_SETTINGS = { enabled: true, volume: 0.6, types: ["highlander"] };

const LOBBY_TYPES = [
  { key: "highlander", label: "Highlander (9v9)" },
  { key: "6v6", label: "6v6" },
  { key: "4v4", label: "4v4" },
  { key: "ultiduo", label: "Ultiduo" },
  { key: "bball", label: "BBall" },
  { key: "prolander", label: "Prolander (7v7)" },
];

const DEFAULT_SOUND = "alert.mp3";
const MAX_SOUND_BYTES = 5 * 1024 * 1024; // keep the data URL comfortably under the storage quota

let settings = { ...DEFAULT_SETTINGS };
let customSound = null;
let previewAudio = null;
let statusTimer = null;

const el = {
  enabled: document.getElementById("enabled"),
  disabledNote: document.getElementById("disabledNote"),
  types: document.getElementById("types"),
  volume: document.getElementById("volume"),
  volumeValue: document.getElementById("volumeValue"),
  soundName: document.getElementById("soundName"),
  soundFile: document.getElementById("soundFile"),
  chooseSound: document.getElementById("chooseSound"),
  resetSound: document.getElementById("resetSound"),
  preview: document.getElementById("preview"),
  status: document.getElementById("status"),
};

function soundRadios() {
  return Array.from(document.querySelectorAll('input[name="soundSource"]'));
}

function flashStatus(message) {
  el.status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.status.textContent = "";
  }, 1500);
}

function buildTypeCheckboxes() {
  el.types.textContent = "";
  for (const { key, label } of LOBBY_TYPES) {
    const wrap = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key;
    input.addEventListener("change", saveTypes);
    wrap.append(input, document.createTextNode(label));
    el.types.append(wrap);
  }
}

function typeCheckboxes() {
  return Array.from(el.types.querySelectorAll('input[type="checkbox"]'));
}

function saveTypes() {
  const types = typeCheckboxes().filter((c) => c.checked).map((c) => c.value);
  saveSync({ types });
}

function saveSync(partial) {
  settings = { ...settings, ...partial };
  chrome.storage.sync.set(partial, () => {
    if (chrome.runtime.lastError) {
      flashStatus("Could not save");
    } else {
      flashStatus("Saved");
    }
    renderEnabledNote();
  });
}

function renderEnabledNote() {
  el.disabledNote.hidden = settings.enabled;
}

function render() {
  el.enabled.checked = settings.enabled;
  renderEnabledNote();

  const percent = Math.round(settings.volume * 100);
  el.volume.value = String(percent);
  el.volumeValue.textContent = `${percent}%`;

  const selected = new Set(settings.types);
  for (const box of typeCheckboxes()) {
    box.checked = selected.has(box.value);
  }

  const hasCustom = Boolean(customSound);
  for (const radio of soundRadios()) {
    radio.checked = radio.value === (hasCustom ? "custom" : "default");
  }
  el.soundName.textContent = hasCustom ? describeCustom() : "No custom sound";
  el.soundName.title = el.soundName.textContent;
  el.resetSound.hidden = !hasCustom;
}

function describeCustom() {
  const name = settings.customSoundName;
  return name ? `${name} (custom)` : "Custom sound";
}

el.enabled.addEventListener("change", () => {
  saveSync({ enabled: el.enabled.checked });
});

el.volume.addEventListener("input", () => {
  const percent = Number(el.volume.value);
  el.volumeValue.textContent = `${percent}%`;
  settings.volume = percent / 100;
  if (previewAudio) previewAudio.volume = settings.volume;
});

el.volume.addEventListener("change", () => {
  saveSync({ volume: Number(el.volume.value) / 100 });
});

for (const radio of soundRadios()) {
  radio.addEventListener("change", () => {
    if (radio.value === "default") {
      clearCustomSound();
    } else if (!customSound) {
      // No custom file yet: revert the visual choice and open the picker.
      for (const r of soundRadios()) r.checked = r.value === "default";
      el.soundFile.click();
    }
  });
}

el.chooseSound.addEventListener("click", () => el.soundFile.click());

el.soundFile.addEventListener("change", () => {
  const file = el.soundFile.files[0];
  el.soundFile.value = "";
  if (!file) return;
  if (file.size > MAX_SOUND_BYTES) {
    flashStatus("File too large (max 5 MB)");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    customSound = reader.result;
    const name = file.name;
    chrome.storage.local.set({ customSound, customSoundName: name }, () => {
      if (chrome.runtime.lastError) {
        customSound = null;
        flashStatus("Could not save sound");
        render();
        return;
      }
      settings.customSoundName = name;
      render();
      flashStatus("Saved");
    });
  };
  reader.onerror = () => flashStatus("Could not read file");
  reader.readAsDataURL(file);
});

el.resetSound.addEventListener("click", clearCustomSound);

el.preview.addEventListener("click", () => {
  const src = customSound || DEFAULT_SOUND;
  if (previewAudio) {
    previewAudio.pause();
  }
  previewAudio = new Audio(src);
  previewAudio.volume = settings.volume;
  previewAudio.play().catch(() => flashStatus("Could not play sound"));
});

function clearCustomSound() {
  customSound = null;
  delete settings.customSoundName;
  chrome.storage.local.remove(["customSound", "customSoundName"], () => {
    render();
    flashStatus("Reset to default");
  });
}

function init() {
  buildTypeCheckboxes();
  chrome.storage.sync.get(DEFAULT_SETTINGS, (sync) => {
    chrome.storage.local.get({ customSound: null, customSoundName: "" }, (local) => {
      settings = { ...DEFAULT_SETTINGS, ...sync };
      if (!Array.isArray(settings.types)) settings.types = [...DEFAULT_SETTINGS.types];
      customSound = local.customSound || null;
      settings.customSoundName = local.customSoundName || "";
      render();
    });
  });
}

init();
