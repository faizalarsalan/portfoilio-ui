const STORAGE_KEY = "faiz.sound";

let ctx = null;
let master = null;
let noiseBuffer = null;
let unlocked = false;
let muted = false;
let lastKeyAt = 0;
let lastTickAt = 0;

try {
  muted = localStorage.getItem(STORAGE_KEY) === "off";
} catch {}

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 6;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.18;
  master.connect(comp);
  comp.connect(ctx.destination);

  const length = Math.floor(ctx.sampleRate * 0.08);
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function ready() {
  if (muted || document.hidden || !unlocked) return null;
  const ac = ensureContext();
  if (!ac || ac.state !== "running") return null;
  return ac;
}

function paintButtons() {
  for (const btn of document.querySelectorAll("[data-sound-toggle]")) {
    btn.textContent = muted ? "sfx: off" : "sfx: on";
    btn.setAttribute("aria-pressed", String(!muted));
    btn.classList.toggle("is-muted", muted);
  }
}

function unlock() {
  if (unlocked && ctx?.state === "running") return;
  const ac = ensureContext();
  if (!ac) return;
  unlocked = true;
  if (ac.state === "suspended") ac.resume().catch(() => {});
}

function playNoise(ac, t, freq, q, dur, vol) {
  if (!noiseBuffer) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, t);
  filter.Q.setValueAtTime(q, t);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
  src.stop(t + dur + 0.01);
}

function playTone(ac, t, type, f0, f1, dur, vol) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

export const sfx = {
  init() {
    paintButtons();
    const wake = () => unlock();
    window.addEventListener("pointerdown", wake, { capture: true, passive: true });
    window.addEventListener("keydown", wake, { capture: true, passive: true });
    for (const btn of document.querySelectorAll("[data-sound-toggle]")) {
      if (btn.dataset.sfxBound) continue;
      btn.dataset.sfxBound = "1";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        this.toggle();
      });
    }
  },

  isMuted() {
    return muted;
  },

  toggle() {
    muted = !muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
    } catch {}
    unlock();
    if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.18, ctx.currentTime);
    paintButtons();
    if (!muted) {
      const ac = ensureContext();
      if (ac) {
        if (ac.state === "suspended") ac.resume().then(() => this.open()).catch(() => {});
        else this.open();
      }
    }
  },

  key(code = "", shift = false) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    if (t - lastKeyAt < 0.022) return;
    lastKeyAt = t;

    if (code === "Enter") {
      playNoise(ac, t, 2200, 2.0, 0.016, 0.24);
      playTone(ac, t, "triangle", 280, 110, 0.032, 0.22);
      playTone(ac, t + 0.014, "sine", 540, 420, 0.035, 0.1);
      return;
    }
    if (code === "Space") {
      playNoise(ac, t, 1200, 1.5, 0.018, 0.22);
      playTone(ac, t, "triangle", 130, 58, 0.032, 0.26);
      return;
    }
    if (code === "Backspace" || code === "Escape") {
      playNoise(ac, t, 1500, 2.0, 0.014, 0.18);
      playTone(ac, t, "triangle", 155, 68, 0.024, 0.18);
      return;
    }
    const jitter = 0.94 + Math.random() * 0.14 + (shift ? 0.06 : 0);
    playNoise(ac, t, 1850 * jitter, 2.3, 0.012, 0.16);
    playTone(ac, t, "triangle", 185 * jitter, 78, 0.018, 0.15);
  },

  tick() {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    if (t - lastTickAt < 0.03) return;
    lastTickAt = t;
    playTone(ac, t, "triangle", 740, 480, 0.016, 0.1);
  },

  open() {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(ac, t, "sine", 340, 510, 0.045, 0.12);
    playTone(ac, t + 0.028, "sine", 520, 640, 0.045, 0.09);
  },

  theme() {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(ac, t, "sine", 440, 440, 0.08, 0.09);
    playTone(ac, t + 0.03, "sine", 659.25, 659.25, 0.09, 0.08);
  },

  scan() {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(ac, t, "sine", 920, 1240, 0.042, 0.07);
  },
};
