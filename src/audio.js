/* Procedural sound: three music themes that crossfade per section + UI / game sfx.
   Everything is synthesized with WebAudio, no audio files. */
const KEY = 'dg-sound'
const readOn = () => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } }
const mtof = (m) => 440 * 2 ** ((m - 69) / 12)

let ctx = null, master, music, sfxBus, noise
let on = readOn()
let want = { name: 'frost', dark: false }, cur = { name: '', dark: false }
const themes = {}
const subs = new Set()
let timer = null, duck = 1

/* ---------- instruments ---------- */
function tone(out, t, f, dur, o = {}) {
  const { type = 'sine', vol = 0.1, a = 0.005, r = dur, f2 = null, det = 0, lp = null, q = 0.7 } = o
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f, t)
  if (det) osc.detune.value = det
  if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + a + r)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + r)
  let node = osc
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; osc.connect(fl); node = fl }
  node.connect(g); g.connect(out)
  osc.start(t); osc.stop(t + a + r + 0.05)
}
function hiss(out, t, dur, o = {}) {
  const { vol = 0.1, type = 'highpass', f = 6000, f2 = null, q = 0.8, a = 0.002 } = o
  const src = ctx.createBufferSource(); src.buffer = noise
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(fl); fl.connect(g); g.connect(out)
  src.start(t, Math.random() * 1.5, dur + 0.05)
}
const kick = (out, t, vol = 0.45, f = 140) => tone(out, t, f, 0.22, { vol, f2: 40, a: 0.002 })

/* ---------- themes ---------- */
const CH = { m: [0, 3, 7], M: [0, 4, 7] }

function frost(step, t, th, s) {
  const out = th.bus, bar = Math.floor(step / 16) % 4, k = step % 16
  const [root, q] = [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']][bar], ch = CH[q]
  if (k === 0) {
    ch.forEach((iv) => tone(out, t, mtof(root + iv - 12), s * 15, { vol: 0.03, a: 0.9, r: s * 15 }))
    tone(out, t, mtof(root - 24), s * 7, { type: 'triangle', vol: 0.09, r: s * 7 })
  }
  if (k === 8) tone(out, t, mtof(root - 24), s * 7, { type: 'triangle', vol: 0.06, r: s * 6 })
  if (k % 2 === 0) {
    const arp = [0, 1, 2, 3, 2, 1, 3, 2][(k / 2) % 8]
    const n = root + 12 + (arp === 3 ? 12 : ch[arp])
    tone(th.send, t, mtof(n), 0.7, { vol: 0.045, a: 0.004, r: 0.7 })
    tone(out, t, mtof(n + 12), 0.35, { vol: 0.01, a: 0.004, r: 0.35 })
  }
  if (k % 4 === 2) hiss(out, t, 0.04, { vol: 0.012, f: 8000 })
  if (k === 13 && bar % 2) tone(th.send, t, mtof(root + 31), 1.2, { vol: 0.018, r: 1.2 })
}

const LEAD = [69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0, 65, 0, 0, 69, 0, 0, 72, 0, 71, 0, 0, 67, 0, 0, 0, 0]
function neon(step, t, th, s) {
  const out = th.bus, bar = Math.floor(step / 16) % 4, k = step % 16
  const [root, q] = [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M']][bar], ch = CH[q]
  if (k % 4 === 0) kick(out, t, 0.42)
  if (k === 4 || k === 12) { hiss(out, t, 0.2, { vol: 0.11, type: 'bandpass', f: 1800, q: 0.6 }); tone(out, t, 200, 0.08, { type: 'triangle', vol: 0.05, f2: 120 }) }
  if (k % 2 === 1) hiss(out, t, 0.03, { vol: k % 4 === 3 ? 0.03 : 0.016, f: 9000 })
  if (k % 2 === 0) tone(out, t, mtof(root - 12 + (k % 4 === 2 ? 12 : 0)), s * 1.5, { type: 'sawtooth', vol: 0.06, r: s * 1.5, lp: 650, q: 5 })
  const arp = [0, 1, 2, 1, 0, 2, 1, 2][k % 8]
  tone(th.send, t, mtof(root + 24 + ch[arp] + (k >= 8 ? 12 : 0)), s, { type: 'square', vol: 0.018, r: s * 0.9, lp: 2600 })
  if (Math.floor(step / 64) % 2 === 1) {
    const n = LEAD[step % 32]
    if (n) { tone(th.send, t, mtof(n), s * 3, { type: 'sawtooth', vol: 0.022, a: 0.01, r: s * 3, lp: 2200 }); tone(th.send, t, mtof(n), s * 3, { type: 'sawtooth', vol: 0.016, det: 9, a: 0.01, r: s * 3, lp: 2200 }) }
  }
}

/* noir: a warped music box over a low drone, a slow heartbeat and creaks */
const BOX = [81, 0, 76, 0, 72, 0, 76, 0, 81, 0, 84, 0, 83, 0, 0, 0, 80, 0, 76, 0, 71, 0, 76, 0, 80, 0, 83, 0, 81, 0, 0, 0,
  81, 0, 76, 0, 72, 0, 77, 0, 76, 0, 72, 0, 69, 0, 0, 0, 68, 0, 71, 0, 74, 0, 77, 0, 76, 0, 0, 0, 0, 0, 0, 0]
function noir(step, t, th, s) {
  const out = th.bus, k = step % 16
  if (step % 64 === 0) {
    tone(out, t, mtof(33), s * 64, { vol: 0.07, a: 2, r: s * 62 })
    tone(out, t, mtof(45), s * 64, { type: 'triangle', vol: 0.025, a: 3, r: s * 60, det: -12 })
    tone(out, t, mtof(46), s * 64, { vol: 0.012, a: 4, r: s * 58 }) // the wrong note keeps it uneasy
  }
  const n = BOX[step % 64]
  if (n) {
    const warp = (Math.random() - 0.5) * 30
    tone(th.send, t, mtof(n), 1.4, { vol: 0.04, a: 0.002, r: 1.4, det: warp })
    tone(out, t, mtof(n) * 3, 0.3, { vol: 0.008, a: 0.002, r: 0.3, det: warp })
  }
  if (k === 0) kick(out, t, 0.16, 70)
  if (k === 3) kick(out, t, 0.1, 64)
  if (step % 64 === 40) hiss(out, t, 1.6, { vol: 0.03, type: 'bandpass', f: 280, f2: 900, q: 8, a: 0.4 })
  if (step % 128 === 100) tone(out, t, mtof(93), 2.5, { vol: 0.006, a: 1, r: 1.5, det: 40 })
  if (Math.random() < 0.3) hiss(out, t + Math.random() * s, 0.006, { vol: 0.035, f: 2500 })
}

function paper(step, t, th, s) {
  const out = th.bus, bar = Math.floor(step / 16) % 4, k = step % 16
  const [root, ch] = [[50, [0, 3, 7, 10, 14]], [43, [0, 4, 10, 14, 17]], [48, [0, 4, 7, 11, 14]], [45, [0, 3, 7, 10, 15]]][bar]
  const keys = (vol, r) => ch.forEach((iv, i) => {
    tone(th.send, t + i * 0.012, mtof(root + 12 + iv), r, { vol, a: 0.01, r })
    tone(out, t + i * 0.012, mtof(root + 12 + iv), r * 0.6, { type: 'triangle', vol: vol * 0.35, det: 7, a: 0.01, r: r * 0.6 })
  })
  if (k === 0) keys(0.028, 1.8)
  if (k === 7) keys(0.018, 0.9)
  if (k === 0) tone(out, t, mtof(root - 12), s * 6, { type: 'triangle', vol: 0.12, r: s * 6 })
  if (k === 10) tone(out, t, mtof(root - 5), s * 4, { type: 'triangle', vol: 0.08, r: s * 4 })
  if (k === 0 || k === 10) kick(out, t, 0.3, 110)
  if (k === 4 || k === 12) { hiss(out, t, 0.08, { vol: 0.05, type: 'bandpass', f: 2600, q: 1 }); tone(out, t, 330, 0.03, { type: 'triangle', vol: 0.02 }) }
  if (k % 2 === 0) hiss(out, t, 0.025, { vol: 0.014, f: 7000 })
  if (Math.random() < 0.35) hiss(out, t + Math.random() * s, 0.006, { vol: 0.03, f: 3000 })
}

function makeTheme(name, bpm, play, max, o = {}) {
  const bus = ctx.createGain(); bus.gain.value = 0
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.6
  bus.connect(lp); lp.connect(music)
  // send: dry + echo
  const send = ctx.createGain(); send.connect(bus)
  const dl = ctx.createDelay(1); dl.delayTime.value = (60 / bpm) * (o.echo || 0.75)
  const fb = ctx.createGain(); fb.gain.value = o.fb ?? 0.32
  const wet = ctx.createGain(); wet.gain.value = o.wet ?? 0.32
  send.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(bus)
  if (o.crackle) { // vinyl hiss bed
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 0.7
    const g = ctx.createGain(); g.gain.value = 0.012
    src.connect(f); f.connect(g); g.connect(bus); src.start()
  }
  themes[name] = { name, bpm, play, bus, lp, send, max, step: 0, next: 0, live: false, swing: o.swing || 0 }
}

function schedule() {
  const now = ctx.currentTime
  for (const th of Object.values(themes)) {
    if (!th.live && th.bus.gain.value < 0.002) continue
    const s16 = 60 / th.bpm / 4
    if (th.next < now - 0.25) th.next = now + 0.05
    while (th.next < now + 0.16) {
      th.play(th.step, th.next + (th.step % 2 ? th.swing * s16 : 0), th, s16)
      th.next += s16; th.step++
    }
  }
}

function applyTheme() {
  if (!ctx) return
  const { name, dark } = want
  if (cur.name === name && cur.dark === dark) return
  const now = ctx.currentTime
  for (const th of Object.values(themes)) {
    const g = th.bus.gain, f = th.lp.frequency
    g.cancelScheduledValues(now); f.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now); f.setValueAtTime(f.value, now)
    if (th.name === name) {
      if (!th.live && g.value < 0.02) { th.step = 0; th.next = now + 0.1; f.setValueAtTime(450, now) }
      th.live = true
      g.setTargetAtTime(1, now + 0.12, 0.45)
      f.setTargetAtTime(name === 'frost' && dark ? 2400 : th.max, now + 0.12, 0.7)
    } else if (th.live) {
      th.live = false
      g.setTargetAtTime(0, now, 0.6); f.setTargetAtTime(280, now, 0.35)
    }
  }
  cur = { name, dark }
}

/* ---------- sfx ---------- */
const zone = () => document.documentElement.dataset.zone || 'snow'
const SFX = {
  hover() {
    const z = zone(), t = ctx.currentTime
    if (z === 'arcade') { tone(sfxBus, t, 320, 0.04, { type: 'triangle', vol: 0.05 }); hiss(sfxBus, t, 0.02, { vol: 0.05, f: 3000 }) }
    else if (z === 'paper') hiss(sfxBus, t, 0.03, { vol: 0.06, type: 'bandpass', f: 3200, q: 2 })
    else tone(sfxBus, t, 2093, 0.08, { vol: 0.03 })
  },
  click() {
    const z = zone(), t = ctx.currentTime
    if (z === 'arcade') { hiss(sfxBus, t, 0.08, { vol: 0.18, type: 'lowpass', f: 900 }); tone(sfxBus, t, 110, 0.12, { vol: 0.12, f2: 60 }) }
    else if (z === 'paper') { hiss(sfxBus, t, 0.05, { vol: 0.12, type: 'bandpass', f: 1800, q: 1.5 }); tone(sfxBus, t, 220, 0.05, { type: 'triangle', vol: 0.06 }) }
    else { tone(sfxBus, t, 1568, 0.12, { vol: 0.05 }); tone(sfxBus, t + 0.04, 2349, 0.18, { vol: 0.035 }) }
  },
  mine() { const t = ctx.currentTime; hiss(sfxBus, t, 0.14, { vol: 0.22, type: 'lowpass', f: 1400 }); tone(sfxBus, t, 190, 0.1, { type: 'square', vol: 0.05, f2: 70 }) },
  restore() { const t = ctx.currentTime;[60, 64, 67, 72, 76].forEach((n, i) => tone(sfxBus, t + i * 0.07, mtof(n + 12), 0.4, { vol: 0.04 })) },
  toggle() { const t = ctx.currentTime; tone(sfxBus, t, 880, 0.05, { type: 'triangle', vol: 0.06 }); tone(sfxBus, t + 0.06, 1320, 0.08, { type: 'triangle', vol: 0.05 }) },
  coin() { const t = ctx.currentTime; tone(sfxBus, t, mtof(83), 0.08, { type: 'square', vol: 0.05 }); tone(sfxBus, t + 0.08, mtof(88), 0.3, { type: 'square', vol: 0.05 }) },
  wa: (() => { let k = 0; return () => { const t = ctx.currentTime; k ^= 1; tone(sfxBus, t, k ? 520 : 300, 0.07, { type: 'triangle', vol: 0.07, f2: k ? 300 : 520 }) } })(),
  power() { const t = ctx.currentTime; for (let i = 0; i < 4; i++) tone(sfxBus, t + i * 0.07, 300, 0.07, { type: 'square', vol: 0.03, f2: 900 }) },
  ghost() { const t = ctx.currentTime; tone(sfxBus, t, 200, 0.3, { type: 'square', vol: 0.05, f2: 1800 }) },
  die() { const t = ctx.currentTime; for (let i = 0; i < 6; i++) tone(sfxBus, t + i * 0.13, 700 - i * 90, 0.13, { type: 'square', vol: 0.045, f2: 500 - i * 80 }) },
  level() { const t = ctx.currentTime;[72, 76, 79, 84, 79, 84, 88].forEach((n, i) => tone(sfxBus, t + i * 0.08, mtof(n), 0.12, { type: 'square', vol: 0.04 })) },
  ready() { const t = ctx.currentTime;[64, 0, 64, 0, 72].forEach((n, i) => n && tone(sfxBus, t + i * 0.12, mtof(n), 0.14, { type: 'square', vol: 0.04 })) },
  beep() { tone(sfxBus, ctx.currentTime, 880, 0.12, { type: 'square', vol: 0.04 }) },
  go() { tone(sfxBus, ctx.currentTime, 1760, 0.35, { type: 'square', vol: 0.045 }) },
  crash() { const t = ctx.currentTime; hiss(sfxBus, t, 0.45, { vol: 0.3, type: 'lowpass', f: 2200, f2: 200 }); tone(sfxBus, t, 120, 0.3, { type: 'sawtooth', vol: 0.06, f2: 40 }) },
  checkpoint() { const t = ctx.currentTime;[76, 79, 84, 88].forEach((n, i) => tone(sfxBus, t + i * 0.07, mtof(n), 0.18, { type: 'square', vol: 0.04 })) },
  move() { tone(sfxBus, ctx.currentTime, 440, 0.025, { type: 'square', vol: 0.02 }) },
  rotate() { tone(sfxBus, ctx.currentTime, 660, 0.04, { type: 'square', vol: 0.025, f2: 880 }) },
  drop() { const t = ctx.currentTime; tone(sfxBus, t, 160, 0.1, { type: 'square', vol: 0.05, f2: 60 }) },
  line() { const t = ctx.currentTime;[67, 71, 74, 79].forEach((n, i) => tone(sfxBus, t + i * 0.05, mtof(n + 12), 0.12, { type: 'square', vol: 0.04 })) },
  eat() { const t = ctx.currentTime; tone(sfxBus, t, 600, 0.06, { type: 'square', vol: 0.04, f2: 1200 }) },
  over() { const t = ctx.currentTime;[67, 63, 60, 55].forEach((n, i) => tone(sfxBus, t + i * 0.16, mtof(n), 0.2, { type: 'square', vol: 0.045 })) },
  channel() { const t = ctx.currentTime; hiss(sfxBus, t, 0.35, { vol: 0.12, type: 'bandpass', f: 4000, f2: 1500, q: 0.5 }); tone(sfxBus, t, 1800, 0.03, { type: 'square', vol: 0.02 }) },
  pick() { const t = ctx.currentTime; hiss(sfxBus, t, 0.05, { vol: 0.12, type: 'bandpass', f: 2400, q: 1.4 }); tone(sfxBus, t, 520, 0.06, { type: 'triangle', vol: 0.05, f2: 760 }) },
  place() { const t = ctx.currentTime; hiss(sfxBus, t, 0.09, { vol: 0.16, type: 'lowpass', f: 900 }); tone(sfxBus, t, 140, 0.09, { vol: 0.08, f2: 80 }) },
  bump() { tone(sfxBus, ctx.currentTime, 180, 0.06, { type: 'triangle', vol: 0.05, f2: 90 }) },
  tick() { tone(sfxBus, ctx.currentTime, 1200 + Math.random() * 300, 0.015, { type: 'square', vol: 0.015 }) },
  open() { const t = ctx.currentTime; hiss(sfxBus, t, 0.5, { vol: 0.1, type: 'bandpass', f: 500, f2: 5000, q: 0.6 }); tone(sfxBus, t + 0.25, 55, 0.4, { vol: 0.25, f2: 35 }) },
  close() { const t = ctx.currentTime; tone(sfxBus, t, 900, 0.25, { vol: 0.07, f2: 60 }); hiss(sfxBus, t, 0.12, { vol: 0.07, type: 'bandpass', f: 3000 }) },
  // section transition stingers
  static() {
    const t = ctx.currentTime
    hiss(sfxBus, t, 0.8, { vol: 0.16, type: 'bandpass', f: 5200, f2: 600, q: 0.4 })
    tone(sfxBus, t, 1300, 0.25, { type: 'square', vol: 0.02, f2: 150 })
    tone(sfxBus, t + 0.35, 55, 0.45, { vol: 0.28, f2: 34 })
  },
  projector() {
    const t = ctx.currentTime
    for (let i = 0; i < 22; i++) hiss(sfxBus, t + i * (0.05 - i * 0.0008), 0.012, { vol: 0.12, f: 1800, type: 'bandpass', q: 2 })
    tone(sfxBus, t, 50, 1.2, { vol: 0.3, f2: 30 })
    hiss(sfxBus, t + 0.1, 1.4, { vol: 0.05, type: 'bandpass', f: 600, f2: 2400, q: 0.8 })
  },
  runout() {
    const t = ctx.currentTime
    for (let i = 0; i < 14; i++) hiss(sfxBus, t + i * 0.04 + i * i * 0.004, 0.015, { vol: 0.12 - i * 0.006, f: 1500, type: 'bandpass', q: 2 })
    tone(sfxBus, t, 180, 0.9, { type: 'triangle', vol: 0.06, f2: 40 })
  },
  tvoff() { const t = ctx.currentTime; tone(sfxBus, t, 1200, 0.3, { vol: 0.06, f2: 50 }); hiss(sfxBus, t, 0.18, { vol: 0.07, type: 'bandpass', f: 2800 }) },
  tape() {
    const t = ctx.currentTime
    ;[0, 4, 7].forEach((iv) => tone(sfxBus, t, mtof(57 + iv), 0.7, { type: 'sawtooth', vol: 0.02, f2: mtof(57 + iv) / 5, lp: 1600 }))
    for (let i = 0; i < 9; i++) hiss(sfxBus, t + 0.3 + i * 0.05 + Math.random() * 0.03, 0.07, { vol: 0.03 + Math.random() * 0.05, type: 'bandpass', f: 2200 + Math.random() * 2500, q: 1.3 })
  },
  chime() { const t = ctx.currentTime;[72, 76, 79, 84, 88].forEach((n, i) => tone(sfxBus, t + i * 0.06, mtof(n), 0.9, { vol: 0.035 })) },
  night() { const t = ctx.currentTime;[64, 67, 71].forEach((n, i) => tone(sfxBus, t + i * 0.09, mtof(n), 1.2, { vol: 0.025 })) },
  enter() {
    const t = ctx.currentTime
    ;[60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(sfxBus, t + i * 0.05, mtof(n), 0.45, { type: 'square', vol: 0.025, lp: 3200 }))
    hiss(sfxBus, t, 0.9, { vol: 0.06, type: 'bandpass', f: 400, f2: 6000, q: 0.6 })
  },
}

/* ---------- engine hum for the racer ---------- */
let eng = null
export const engine = {
  start() {
    if (!ctx || eng) return
    const a = ctx.createOscillator(), b = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain()
    a.type = 'sawtooth'; b.type = 'square'; b.detune.value = -1200
    f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0
    a.connect(f); b.connect(f); f.connect(g); g.connect(sfxBus); a.start(); b.start()
    g.gain.setTargetAtTime(0.035, ctx.currentTime, 0.2)
    eng = { a, b, f, g }
  },
  set(p) { if (!eng) return; const t = ctx.currentTime, fr = 45 + p * 150; eng.a.frequency.setTargetAtTime(fr, t, 0.08); eng.b.frequency.setTargetAtTime(fr, t, 0.08); eng.f.frequency.setTargetAtTime(380 + p * 1600, t, 0.1) },
  stop() { if (!eng) return; const e = eng; eng = null; e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => { e.a.stop(); e.b.stop() }, 600) },
}

/* ---------- public api ---------- */
function init() {
  if (ctx) return
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  ctx = new AC()
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4
  master = ctx.createGain(); master.gain.value = on ? 1 : 0
  music = ctx.createGain(); music.gain.value = 0.34
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6
  music.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  makeTheme('frost', 88, frost, 9000, { echo: 0.75, wet: 0.35 })
  makeTheme('neon', 108, neon, 12000, { echo: 0.75, fb: 0.35, wet: 0.3 })
  makeTheme('noir', 66, noir, 5200, { echo: 1.5, fb: 0.45, wet: 0.4, crackle: true })
  makeTheme('paper', 78, paper, 2600, { echo: 1.5, fb: 0.25, wet: 0.22, swing: 0.32, crackle: true })
  timer = setInterval(schedule, 25)
  applyTheme()
  // ui sounds for everything clickable
  let last = 0, lastEl = null
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return
    const el = e.target.closest?.('a,button,select,input,textarea,[data-sfx]')
    if (!el || el === lastEl) return
    lastEl = el
    const n = performance.now(); if (n - last < 70) return
    last = n; sfx('hover')
  })
  document.addEventListener('pointerout', (e) => { if (lastEl && !lastEl.contains(e.relatedTarget)) lastEl = null })
  document.addEventListener('click', (e) => { if (e.target.closest?.('a,button,[data-sfx-click]')) sfx('click') }, true)
  document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : on && ctx.resume() })
}

export function sfx(name) {
  if (!ctx || !on || ctx.state !== 'running') return
  try { SFX[name]?.() } catch { /* never let audio break the page */ }
}

export const sound = {
  get on() { return on },
  get ready() { return !!ctx },
  enable() { this.set(true) },
  set(v) {
    on = v
    try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch {}
    if (v) { init(); ctx?.resume() }
    if (ctx) master.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.15)
    subs.forEach((f) => f(v))
  },
  toggle() { this.set(!on); if (on) setTimeout(() => sfx('toggle'), 60) },
  theme(name, dark = false) { want = { name, dark }; applyTheme() },
  duck(v) { duck = v ? 0.35 : 1; if (ctx) music.gain.setTargetAtTime(0.34 * duck, ctx.currentTime, 0.3) },
  sub(f) { subs.add(f); return () => subs.delete(f) },
}
