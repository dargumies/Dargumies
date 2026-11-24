/* "Neon Road": a pseudo-3D synthwave racer (classic segment projection technique).
   Demo mode drives itself on the TV, play mode is controlled by the player. */
const SEG = 200, RW = 2000, DRAW = 110, CAMH = 1000, FOV = 100
const DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180)
const PZ = CAMH * DEPTH
const MAX = SEG * 60, ACC = MAX / 5, BRAKE = -MAX, DECEL = -MAX / 5, OFF_DECEL = -MAX / 2, OFF_LIMIT = MAX / 4
const CP_EVERY = 420 // segments between checkpoints

const easeIn = (a, b, p) => a + (b - a) * p * p
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5)
const CAR_COLS = ['#ff3cac', '#3cf2ff', '#b8ff3c', '#ff9b3c', '#a78bff']

function buildTrack() {
  const segs = []
  const lastY = () => (segs.length ? segs[segs.length - 1].y2 : 0)
  const add = (curve, y) => { const n = segs.length; segs.push({ i: n, z1: n * SEG, z2: (n + 1) * SEG, y1: lastY(), y2: y, curve, cars: [], alt: Math.floor(n / 3) % 2 }) }
  const road = (enter, hold, leave, curve, hill) => {
    const sy = lastY(), ey = sy + hill * SEG, tot = enter + hold + leave
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(sy, ey, n / tot))
    for (let n = 0; n < hold; n++) add(curve, easeInOut(sy, ey, (enter + n) / tot))
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(sy, ey, (enter + hold + n) / tot))
  }
  road(30, 30, 30, 0, 0)
  road(40, 40, 40, 4, 20)
  road(25, 50, 25, 0, -20)
  road(40, 40, 40, -5, 0)
  road(30, 30, 30, 0, 35)
  road(30, 40, 30, 3, -35)
  road(20, 20, 20, -3, 0); road(20, 20, 20, 3, 0); road(20, 20, 20, -3, 10)
  road(50, 50, 50, 0, 25)
  road(40, 60, 40, 6, -30)
  road(30, 30, 30, -2, 15)
  road(40, 40, 40, 0, 0)
  road(30, 30, 30, -4, -10)
  road(30, 30, 30, 0, -lastY() / SEG)
  return segs
}

export function createRacer({ demo = false, sfx = () => {}, autoGas = false } = {}) {
  const segs = buildTrack(), N = segs.length, LEN = N * SEG
  const cars = []
  for (let n = 0; n < 46; n++) {
    const z = Math.floor(200 + Math.random() * (N - 220)) * SEG
    const car = { z, off: [-0.66, 0, 0.66][(Math.random() * 3) | 0] + (Math.random() - 0.5) * 0.1, speed: MAX * (0.25 + Math.random() * 0.25), c: CAR_COLS[n % 5] }
    segs[Math.floor(z / SEG) % N].cars.push(car); cars.push(car)
  }
  const s = { pos: 0, speed: 0, x: 0, time: 45, score: 0, over: false, ready: demo ? 0 : 3, cp: 0, shake: 0, sky: 0, keys: {}, msg: 0, best: 0, lastBeep: 4 }
  const seg = (z) => segs[Math.floor(z / SEG) % N]
  const say = (n) => { if (!demo) sfx(n) }

  function aiSteer(ps) {
    // pick the lane with no car close ahead
    let target = s.aiLane ?? 0
    const lanes = [-0.66, 0, 0.66]
    const blocked = (lx) => { for (let n = 1; n < 30; n++) { const sg = segs[(ps.i + n) % N]; if (sg.cars.some((c) => Math.abs(c.off - lx) < 0.4 && c.speed < s.speed)) return n } return 99 }
    if (blocked(target) < 25) { let best = target, bd = -1; lanes.forEach((l) => { const b = blocked(l); if (b > bd) { bd = b; best = l } }); target = best }
    s.aiLane = target
    return target
  }

  return {
    s,
    input(a, down) { s.keys[a] = down },
    step(dt) {
      if (s.over) return
      if (s.ready > 0) {
        s.ready -= dt
        const c = Math.ceil(s.ready)
        if (c !== s.lastBeep) { s.lastBeep = c; if (c > 0) say('beep'); else say('go') }
        return
      }
      const ps = seg(s.pos + PZ), pct = s.speed / MAX
      const dx = dt * 2.2 * pct
      let left = s.keys.left, right = s.keys.right, gas = s.keys.up || autoGas, brake = s.keys.down
      if (demo) {
        gas = true; brake = false
        const tx = aiSteer(ps) - ps.curve * 0.08
        left = s.x > tx + 0.05; right = s.x < tx - 0.05
      }
      if (left) s.x -= dx; else if (right) s.x += dx
      s.x -= dx * pct * ps.curve * 0.32
      s.speed += (brake ? BRAKE : gas ? ACC : DECEL) * dt
      if (Math.abs(s.x) > 1 && s.speed > OFF_LIMIT) s.speed += OFF_DECEL * dt
      // traffic
      for (const c of ps.cars) {
        if (s.speed > c.speed && Math.abs(s.x - c.off) < 0.42) {
          s.speed = c.speed * (c.speed / s.speed); s.pos = Math.max(0, c.z - PZ - 1); s.shake = 0.35; say('crash')
          if (demo) s.x += s.x > c.off ? 0.3 : -0.3
          break
        }
      }
      for (const c of cars) {
        const old = seg(c.z)
        c.z = (c.z + dt * c.speed) % LEN
        const nw = seg(c.z)
        if (old !== nw) { old.cars.splice(old.cars.indexOf(c), 1); nw.cars.push(c) }
      }
      s.x = Math.max(-2.4, Math.min(2.4, s.x))
      s.speed = Math.max(0, Math.min(MAX, s.speed))
      const before = Math.floor(s.pos / SEG)
      s.pos = (s.pos + dt * s.speed) % LEN
      const after = Math.floor(s.pos / SEG)
      s.sky += ps.curve * pct * dt * 0.02
      s.score += Math.round(dt * s.speed / 40)
      if (s.shake > 0) s.shake -= dt
      if (s.msg > 0) s.msg -= dt
      if (!demo) {
        s.time -= dt
        const crossed = (after < before ? after + N : after)
        if (Math.floor(crossed / CP_EVERY) > Math.floor(before / CP_EVERY)) { s.time += 15; s.cp++; s.msg = 1.6; say('checkpoint') }
        if (s.time <= 0) { s.time = 0; s.over = true; say('over') }
      }
    },
    draw(g, t, labels = {}) {
      const w = g.canvas.width, h = g.canvas.height
      const ps = seg(s.pos + PZ), pp = ((s.pos + PZ) % SEG) / SEG
      const py = ps.y1 + (ps.y2 - ps.y1) * pp
      // sky
      const sky = g.createLinearGradient(0, 0, 0, h * 0.62)
      sky.addColorStop(0, '#07001a'); sky.addColorStop(0.55, '#2a0650'); sky.addColorStop(1, '#ff3cac')
      g.fillStyle = sky; g.fillRect(0, 0, w, h)
      for (let i = 0; i < 40; i++) { const sx = ((i * 97 + s.sky * 50) % w + w) % w, sy = (i * 53) % (h * 0.4); g.fillStyle = i % 3 ? '#ffffff55' : '#3cf2ff88'; g.fillRect(sx, sy, 1, 1) }
      // striped sun
      const sunX = w / 2 - ((s.sky * 600) % (w * 2)) * 0, sunY = h * 0.5, R = h * 0.28
      g.save(); g.beginPath(); g.arc(sunX, sunY, R, Math.PI, 0); g.closePath(); g.clip()
      const sg = g.createLinearGradient(0, sunY - R, 0, sunY); sg.addColorStop(0, '#ffe23c'); sg.addColorStop(1, '#ff3cac')
      g.fillStyle = sg; g.fillRect(sunX - R, sunY - R, R * 2, R)
      g.fillStyle = '#2a0650'; for (let k = 0; k < 5; k++) { const yy = sunY - R * 0.45 + k * R * 0.11; g.fillRect(sunX - R, yy, R * 2, Math.max(1, R * 0.03 + k * R * 0.012)) }
      g.restore()
      // wire mountains with parallax
      g.strokeStyle = '#a78bff'; g.lineWidth = 1; g.fillStyle = '#12002e'
      g.beginPath(); g.moveTo(0, h * 0.5)
      for (let x = 0; x <= w; x += 4) { const u = x / w * 6 + s.sky * 3; const yy = h * 0.5 - (Math.abs(Math.sin(u)) * 0.6 + Math.abs(Math.sin(u * 2.3)) * 0.4) * h * 0.12; g.lineTo(x, yy) }
      g.lineTo(w, h * 0.5); g.closePath(); g.fill(); g.stroke()
      g.fillStyle = '#0a0020'; g.fillRect(0, h * 0.5, w, h)

      // road
      const base = seg(s.pos), bp = (s.pos % SEG) / SEG
      let maxy = h, x = 0, dx = -(base.curve * bp)
      const proj = (wy, wz, camX, camZ) => { const sc = DEPTH / (wz - camZ); return { x: w / 2 + sc * -camX * w / 2, y: h / 2 - sc * (wy - (py + CAMH)) * h / 2, w: sc * RW * w / 2, sc, cz: wz - camZ } }
      const vis = []
      for (let n = 0; n < DRAW; n++) {
        const sgm = segs[(base.i + n) % N]
        const looped = sgm.i < base.i
        const camZ = s.pos - (looped ? LEN : 0)
        const camX = s.x * RW
        const p1 = proj(sgm.y1, sgm.z1, camX - x, camZ)
        const p2 = proj(sgm.y2, sgm.z2, camX - x - dx, camZ)
        x += dx; dx += sgm.curve
        sgm.clip = maxy; sgm.p1 = p1
        if (p1.cz <= DEPTH || p2.y >= p1.y || p2.y >= maxy) continue
        vis.push(sgm)
        const alt = sgm.alt
        // ground with neon grid
        g.fillStyle = alt ? '#0d0026' : '#120033'; g.fillRect(0, p2.y, w, p1.y - p2.y + 1)
        if (sgm.i % 6 === 0) { g.fillStyle = '#ff3cac66'; g.fillRect(0, p2.y, w, Math.max(1, (p1.y - p2.y) * 0.25)) }
        const r1 = p1.w / 6, r2 = p2.w / 6
        quad(g, p1.x, p1.y, p1.w + r1, p2.x, p2.y, p2.w + r2, alt ? '#ff3cac' : '#3cf2ff')
        quad(g, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, alt ? '#1c0f3d' : '#22124a')
        if (alt) { const l1 = p1.w / 32, l2 = p2.w / 32; quad(g, p1.x - p1.w / 3, p1.y, l1, p2.x - p2.w / 3, p2.y, l2, '#3cf2ff'); quad(g, p1.x + p1.w / 3, p1.y, l1, p2.x + p2.w / 3, p2.y, l2, '#3cf2ff') }
        if (sgm.i % CP_EVERY < 4 && !demo) quad(g, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, Math.floor(t * 10) % 2 ? '#ffe23c' : '#ffffff')
        maxy = p2.y
      }
      // cars back to front
      for (let k = vis.length - 1; k >= 0; k--) {
        const sgm = vis[k]
        for (const c of sgm.cars) {
          const p = sgm.p1, cw = p.sc * 520 * w / 2
          const cx = p.x + p.sc * c.off * RW * w / 2
          if (p.y - cw * 0.5 > sgm.clip) continue
          car(g, cx, p.y, cw, c.c)
        }
      }
      // player
      const bob = s.speed > 0 ? Math.sin(t * 30) * (s.speed / MAX) : 0
      const shake = s.shake > 0 ? (Math.random() - 0.5) * 6 : 0
      const steer = s.keys.left ? -1 : s.keys.right ? 1 : 0
      car(g, w / 2 + shake, h - h * 0.06 + bob, w * 0.2, '#ffe23c', true, steer)
      // speed lines
      if (s.speed > MAX * 0.8) { g.strokeStyle = '#ffffff33'; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 3; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * w * 0.3, h * 0.55 + Math.sin(a) * h * 0.2); g.lineTo(w / 2 + Math.cos(a) * w * 0.6, h * 0.55 + Math.sin(a) * h * 0.45); g.stroke() } }
      if (!demo) {
        const font = (px) => `700 ${Math.round(px)}px "Pixelify Sans", monospace`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        if (s.ready > 0) { g.font = font(h * 0.22); g.fillStyle = '#ffe23c'; g.shadowColor = '#ff3cac'; g.shadowBlur = 12; g.fillText(Math.ceil(s.ready) || 'GO', w / 2, h * 0.35); g.shadowBlur = 0 }
        if (s.msg > 0) { g.font = font(h * 0.09); g.fillStyle = Math.floor(t * 8) % 2 ? '#ffe23c' : '#3cf2ff'; g.fillText(labels.cp || 'CHECKPOINT +15', w / 2, h * 0.25) }
      }
    },
  }
}

function quad(g, x1, y1, w1, x2, y2, w2, col) {
  g.fillStyle = col
  g.beginPath(); g.moveTo(x1 - w1, y1); g.lineTo(x2 - w2, y2); g.lineTo(x2 + w2, y2); g.lineTo(x1 + w1, y1); g.closePath(); g.fill()
}

function car(g, x, y, w, col, player = false, steer = 0) {
  if (w < 2) return
  const h = w * 0.42
  g.save(); g.translate(x, y)
  if (player) g.rotate(steer * 0.04)
  g.shadowColor = col; g.shadowBlur = Math.min(14, w * 0.15)
  g.fillStyle = '#0b0018'; g.fillRect(-w / 2, -h, w, h)
  g.strokeStyle = col; g.lineWidth = Math.max(1, w * 0.035); g.strokeRect(-w / 2, -h, w, h)
  // cabin
  g.fillStyle = col; g.globalAlpha = 0.35; g.fillRect(-w * 0.32, -h * 1.45, w * 0.64, h * 0.5); g.globalAlpha = 1
  g.strokeRect(-w * 0.32, -h * 1.45, w * 0.64, h * 0.5)
  // tail lights
  g.fillStyle = '#ff2050'; g.shadowColor = '#ff2050'
  g.fillRect(-w * 0.45, -h * 0.7, w * 0.22, h * 0.22); g.fillRect(w * 0.23, -h * 0.7, w * 0.22, h * 0.22)
  g.shadowBlur = 0
  g.fillStyle = '#000'; g.fillRect(-w * 0.48, -h * 0.15, w * 0.2, h * 0.25); g.fillRect(w * 0.28, -h * 0.15, w * 0.2, h * 0.25)
  g.restore()
}
