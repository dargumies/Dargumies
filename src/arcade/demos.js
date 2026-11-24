/* Small self-playing "channels" for the background TVs. Each draws at the canvas size it gets. */
const BR = ['#ff3cac', '#ff9b3c', '#ffe23c', '#b8ff3c', '#3cf2ff']

export function createBreakout() {
  const W = 160, H = 120
  let bricks, ball, pad, score = 0
  const build = () => { bricks = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) bricks.push({ x: 4 + c * 15.2, y: 14 + r * 7, a: true, c: BR[r] }) }
  const serve = () => { ball = { x: 80, y: 70, vx: (Math.random() < 0.5 ? -1 : 1) * 70, vy: -80 } }
  build(); serve(); pad = 80
  return {
    step(dt) {
      pad += (ball.x + Math.sin(performance.now() / 600) * 6 - pad) * Math.min(1, dt * 7)
      ball.x += ball.vx * dt; ball.y += ball.vy * dt
      if (ball.x < 2 || ball.x > W - 2) { ball.vx *= -1; ball.x = Math.max(2, Math.min(W - 2, ball.x)) }
      if (ball.y < 2) { ball.vy = Math.abs(ball.vy) }
      if (ball.y > H - 10 && ball.y < H - 6 && Math.abs(ball.x - pad) < 14 && ball.vy > 0) { ball.vy = -Math.abs(ball.vy); ball.vx = (ball.x - pad) * 7 }
      if (ball.y > H + 4) serve()
      for (const b of bricks) if (b.a && ball.x > b.x && ball.x < b.x + 14 && ball.y > b.y && ball.y < b.y + 6) { b.a = false; ball.vy *= -1; score += 10; break }
      if (bricks.every((b) => !b.a)) build()
    },
    draw(g, t) {
      const k = g.canvas.width / W
      g.setTransform(k, 0, 0, k, 0, 0)
      g.fillStyle = '#05010f'; g.fillRect(0, 0, W, H)
      bricks.forEach((b) => { if (!b.a) return; g.fillStyle = b.c; g.fillRect(b.x, b.y, 14, 6); g.fillStyle = '#ffffff44'; g.fillRect(b.x, b.y, 14, 1) })
      g.fillStyle = '#3cf2ff'; g.fillRect(pad - 12, H - 8, 24, 3)
      g.fillStyle = '#fff'; g.fillRect(ball.x - 1.5, ball.y - 1.5, 3, 3)
      g.fillStyle = '#ffe23c'; g.font = '700 8px "Pixelify Sans", monospace'; g.textAlign = 'left'; g.fillText(String(score).padStart(5, '0'), 4, 9)
      g.setTransform(1, 0, 0, 1, 0, 0)
    },
  }
}

const INV = ['..#..#..', '.######.', '##.##.##', '########', '#.#..#.#', '..#..#..']
export function createShooter() {
  const W = 160, H = 120
  const stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 10 + Math.random() * 40 }))
  let foes, dir = 1, shots = [], booms = [], ship = { x: 80 }, cd = 0, score = 0
  const wave = () => { foes = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) foes.push({ x: 20 + c * 20, y: 12 + r * 13, a: true, c: BR[(r + 1) % 5] }) }
  wave()
  return {
    step(dt) {
      stars.forEach((s) => { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W } })
      const alive = foes.filter((f) => f.a)
      const minX = Math.min(...alive.map((f) => f.x)), maxX = Math.max(...alive.map((f) => f.x))
      if ((dir > 0 && maxX > W - 14) || (dir < 0 && minX < 6)) { dir *= -1; foes.forEach((f) => (f.y += 3)) }
      foes.forEach((f) => (f.x += dir * 18 * dt))
      const tgt = alive[Math.floor(performance.now() / 1500) % Math.max(1, alive.length)]
      if (tgt) ship.x += (tgt.x + 4 - ship.x) * Math.min(1, dt * 3)
      cd -= dt; if (cd <= 0) { cd = 0.35; shots.push({ x: ship.x, y: H - 16 }) }
      shots.forEach((s) => (s.y -= 120 * dt)); shots = shots.filter((s) => s.y > -4)
      for (const s of shots) for (const f of foes) if (f.a && s.x > f.x - 1 && s.x < f.x + 9 && s.y > f.y && s.y < f.y + 7) { f.a = false; s.y = -10; score += 50; booms.push({ x: f.x + 4, y: f.y + 3, t: 0, c: f.c }) }
      booms.forEach((b) => (b.t += dt)); booms = booms.filter((b) => b.t < 0.4)
      if (!foes.some((f) => f.a) || alive.some((f) => f.y > H - 30)) wave()
    },
    draw(g) {
      const k = g.canvas.width / W
      g.setTransform(k, 0, 0, k, 0, 0)
      g.fillStyle = '#03000c'; g.fillRect(0, 0, W, H)
      stars.forEach((s) => { g.fillStyle = s.v > 35 ? '#fff' : '#6f5bff'; g.fillRect(s.x, s.y, 1, 1) })
      foes.forEach((f) => { if (!f.a) return; g.fillStyle = f.c; INV.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && g.fillRect(f.x + i, f.y + j, 1, 1))) })
      g.fillStyle = '#ffe23c'; shots.forEach((s) => g.fillRect(s.x - 0.5, s.y, 1, 4))
      booms.forEach((b) => { g.fillStyle = b.c; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; g.fillRect(b.x + Math.cos(a) * b.t * 30, b.y + Math.sin(a) * b.t * 30, 1.5, 1.5) } })
      g.fillStyle = '#3cf2ff'; g.fillRect(ship.x - 5, H - 10, 10, 3); g.fillRect(ship.x - 2, H - 13, 4, 3); g.fillRect(ship.x - 0.5, H - 15, 1, 2)
      g.fillStyle = '#ff3cac'; g.font = '700 8px "Pixelify Sans", monospace'; g.textAlign = 'left'; g.fillText('HI ' + String(score).padStart(5, '0'), 4, 9)
      g.setTransform(1, 0, 0, 1, 0, 0)
    },
  }
}

export function createBars(label = 'NO SIGNAL') {
  const C = ['#e8e8e8', '#ffe23c', '#3cf2ff', '#b8ff3c', '#ff3cac', '#ff4040', '#3c3cff']
  return {
    step() {},
    draw(g, t) {
      const w = g.canvas.width, h = g.canvas.height
      C.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / 7, 0, w / 7 + 1, h * 0.68) })
      g.fillStyle = '#111'; g.fillRect(0, h * 0.68, w, h)
      for (let i = 0; i < 6; i++) { g.fillStyle = `hsl(0,0%,${i * 18}%)`; g.fillRect((i * w) / 6, h * 0.78, w / 6 + 1, h * 0.12) }
      g.fillStyle = '#000'; g.fillRect(w * 0.18, h * 0.3, w * 0.64, h * 0.16)
      g.fillStyle = Math.floor(t * 2) % 2 ? '#fff' : '#ffe23c'
      g.font = `700 ${Math.round(h * 0.11)}px "Pixelify Sans", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(label, w / 2, h * 0.385)
    },
  }
}

export function createSnowCh() {
  // a tiny frost landscape: callback to the rest of the site
  const flakes = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), v: 0.05 + Math.random() * 0.1 }))
  return {
    step(dt) { flakes.forEach((f) => { f.y += f.v * dt; f.x += Math.sin(f.y * 20) * 0.0008; if (f.y > 1) f.y = 0 }) },
    draw(g, t) {
      const w = g.canvas.width, h = g.canvas.height
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#10232d'); sky.addColorStop(1, '#528A9A')
      g.fillStyle = sky; g.fillRect(0, 0, w, h)
      g.fillStyle = '#d9e7e8'
      for (let x = 0; x < w; x += 2) { const y = h * 0.72 - Math.abs(Math.sin(x * 0.03)) * h * 0.18; g.fillRect(x, y, 2, h - y) }
      flakes.forEach((f) => { g.fillStyle = '#fff'; g.fillRect(f.x * w, f.y * h, 1.5, 1.5) })
      g.fillStyle = '#25252B'; g.fillRect(w * 0.62, h * 0.5, w * 0.05, h * 0.2)
      g.fillStyle = Math.sin(t * 3) > 0 ? '#ffcf8f' : '#ffb257'; g.fillRect(w * 0.6, h * 0.44, w * 0.09, h * 0.07)
    },
  }
}

/* white noise for channel switches and TV power-on */
let noiseCanvas = null
export function drawStatic(g, alpha = 1) {
  const w = g.canvas.width, h = g.canvas.height
  if (!noiseCanvas) { noiseCanvas = document.createElement('canvas'); noiseCanvas.width = 128; noiseCanvas.height = 96 }
  const n = noiseCanvas.getContext('2d'), img = n.createImageData(128, 96), d = img.data
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255 }
  n.putImageData(img, 0, 0)
  g.globalAlpha = alpha; g.imageSmoothingEnabled = false
  g.drawImage(noiseCanvas, 0, 0, w, h)
  g.globalAlpha = 1
}
