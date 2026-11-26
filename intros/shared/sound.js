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

  const length = Math.floor(ctx.sampleRate * 1.8);
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

function withReady(fn) {
  if (muted || document.hidden) return;
  const ua = navigator.userActivation;
  if (!unlocked && !(ua?.isActive || ua?.hasBeenActive)) return;
  unlocked = true;
  const ac = ensureContext();
  if (!ac) return;
  if (ac.state === "running") {
    fn(ac);
  } else if (ac.state === "suspended") {
    ac.resume().then(() => {
      if (!muted && !document.hidden && ac.state === "running") fn(ac);
    }).catch(() => {});
  }
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
    const ua = navigator.userActivation;
    if (!muted && (ua?.isActive || ua?.hasBeenActive)) unlock();
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
    if (!muted) withReady((ac) => {
      const t = ac.currentTime;
      playTone(ac, t, "sine", 340, 510, 0.045, 0.12);
      playTone(ac, t + 0.028, "sine", 520, 640, 0.045, 0.09);
    });
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
    withReady((ac) => {
      const t = ac.currentTime;
      playTone(ac, t, "sine", 340, 510, 0.045, 0.12);
      playTone(ac, t + 0.028, "sine", 520, 640, 0.045, 0.09);
    });
  },

  theme() {
    withReady((ac) => {
      const t = ac.currentTime;
      playTone(ac, t, "sine", 440, 440, 0.08, 0.09);
      playTone(ac, t + 0.03, "sine", 659.25, 659.25, 0.09, 0.08);
    });
  },

  scan() {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    playTone(ac, t, "sine", 920, 1240, 0.042, 0.07);
  },

  calDay(level = 1) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    const base = 420 + level * 110;
    playTone(ac, t, "sine", base, base * 1.15, 0.024, 0.04 + level * 0.012);
  },

  enter() {
    withReady((ac) => {
      const t = ac.currentTime;
      playNoise(ac, t, 1800, 1.8, 0.022, 0.2);
      playTone(ac, t, "triangle", 220, 330, 0.08, 0.14);
      playTone(ac, t + 0.045, "sine", 440, 660, 0.16, 0.1);
    });
  },

  ripple() {
    withReady((ac) => {
      const t = ac.currentTime;
      const steps = 8;
      for (let k = 0; k < steps; k++) {
        const at = t + k * 0.068;
        const f = 920 - k * 65;
        playNoise(ac, at, 1400 + k * 140, 3.0, 0.03, 0.075 * (1 - k * 0.08));
        playTone(ac, at, "sine", f, f * 0.85, 0.045, 0.045 * (1 - k * 0.07));
      }
    });
  },

  dive(dur = 1.55) {
    withReady((ac) => {
      const t = ac.currentTime;
      if (noiseBuffer) {
        const src = ac.createBufferSource();
        src.buffer = noiseBuffer;
        const filter = ac.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(160, t);
        filter.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.72);
        filter.frequency.exponentialRampToValueAtTime(420, t + dur);
        filter.Q.value = 1.6;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + dur * 0.25);
        gain.gain.linearRampToValueAtTime(0.24, t + dur * 0.75);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(t);
        src.stop(t + dur + 0.02);
      }
      const sub = ac.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(65, t);
      sub.frequency.exponentialRampToValueAtTime(145, t + dur * 0.65);
      sub.frequency.exponentialRampToValueAtTime(48, t + dur);
      const subGain = ac.createGain();
      subGain.gain.setValueAtTime(0.0001, t);
      subGain.gain.linearRampToValueAtTime(0.2, t + dur * 0.2);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sub.connect(subGain);
      subGain.connect(master);
      sub.start(t);
      sub.stop(t + dur + 0.02);

      const shimmer = ac.createOscillator();
      shimmer.type = "triangle";
      shimmer.frequency.setValueAtTime(220, t);
      shimmer.frequency.exponentialRampToValueAtTime(880, t + dur * 0.78);
      const shimGain = ac.createGain();
      shimGain.gain.setValueAtTime(0.0001, t);
      shimGain.gain.linearRampToValueAtTime(0.08, t + dur * 0.45);
      shimGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.96);
      shimmer.connect(shimGain);
      shimGain.connect(master);
      shimmer.start(t);
      shimmer.stop(t + dur + 0.02);
    });
  },
};
