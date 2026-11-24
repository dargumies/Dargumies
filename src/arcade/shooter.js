/* "Night Watch": a vertical shooter. Creatures crawl down in waves, you hold the line.
   ← → move, space / ↑ fire (auto-fire on touch). */
const W = 240, H = 320
const SPR = {
  eye: ['..####..', '.#....#.', '#..##..#', '#.####.#', '#..##..#', '.#....#.', '#.#..#.#', '#......#'],
  moth: ['#......#', '##.##.##', '.######.', '..#..#..', '.######.', '##....##', '#......#'],
  skull: ['.######.', '########', '##.##.##', '########', '.######.', '.#.##.#.', '.######.'],
}
const KINDS = ['skull', 'eye', 'moth']

export function createShooter({ demo = false, sfx = () => {}, autoFire = false } = {}) {
  const s = { score: 0, lives: 3, wave: 1, over: false, ready: demo ? 0 : 1.6, keys: {}, hurt: 0 }
  const stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 8 + Math.random() * 40 }))
  let foes = [], shots = [], bombs = [], booms = [], dir = 1, cd = 0, ship = { x: W / 2 }
  const say = (n) => { if (!demo) sfx(n) }
  const wave = () => {
    foes = []
    const rows = Math.min(5, 3 + Math.floor((s.wave - 1) / 2))
    for (let r = 0; r < rows; r++) for (let c = 0; c < 7; c++) foes.push({ x: 18 + c * 30, y: 30 + r * 22, a: true, k: KINDS[r % 3], ph: Math.random() * 6 })
    dir = 1
  }
  wave()
  const fire = () => { if (cd > 0) return; cd = demo ? 0.32 : 0.26; shots.push({ x: ship.x, y: H - 26 }); say('move') }

  return {
    s,
    input(a, down) { s.keys[a] = down },
    pointer(_y, x01) { if (x01 != null) s.tx = x01 * W },
    step(dt) {
      if (s.over) return
      stars.forEach((st) => { st.y += st.v * dt; if (st.y > H) { st.y = 0; st.x = Math.random() * W } })
      if (s.ready > 0) { s.ready -= dt; return }
      cd -= dt; if (s.hurt > 0) s.hurt -= dt
      const alive = foes.filter((f) => f.a)
      // ship
      if (demo) {
        const tgt = alive[Math.floor(performance.now() / 1400) % Math.max(1, alive.length)]
        if (tgt) ship.x += (tgt.x + 4 - ship.x) * Math.min(1, dt * 3)
        fire()
      } else {
        if (s.tx != null) ship.x += Math.max(-170 * dt, Math.min(170 * dt, s.tx - ship.x))
        ship.x += ((s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0)) * 170 * dt
        if (s.keys.fire || s.keys.up || autoFire) fire()
      }
      ship.x = Math.max(10, Math.min(W - 10, ship.x))
      // formation
      const speed = 16 + s.wave * 5 + (35 - alive.length) * 0.6
      const minX = Math.min(...alive.map((f) => f.x)), maxX = Math.max(...alive.map((f) => f.x))
      if ((dir > 0 && maxX > W - 14) || (dir < 0 && minX < 6)) { dir *= -1; foes.forEach((f) => (f.y += 8)) }
      foes.forEach((f) => { f.x += dir * speed * dt; f.ph += dt * 6 })
      // creatures drop things
      if (alive.length && Math.random() < dt * (0.7 + s.wave * 0.25)) { const f = alive[(Math.random() * alive.length) | 0]; bombs.push({ x: f.x + 4, y: f.y + 8 }) }
      shots.forEach((b) => (b.y -= 260 * dt)); shots = shots.filter((b) => b.y > -6)
      bombs.forEach((b) => (b.y += (90 + s.wave * 10) * dt)); bombs = bombs.filter((b) => b.y < H + 6)
      for (const b of shots) for (const f of foes) {
        if (f.a && b.x > f.x - 1 && b.x < f.x + 9 && b.y > f.y && b.y < f.y + 8) { f.a = false; b.y = -20; s.score += f.k === 'skull' ? 30 : f.k === 'eye' ? 20 : 10; booms.push({ x: f.x + 4, y: f.y + 4, t: 0 }); say('eat') }
      }
      if (s.hurt <= 0 && !demo) for (const b of bombs) if (Math.abs(b.x - ship.x) < 8 && b.y > H - 24 && b.y < H - 8) { b.y = H + 20; hurt() }
      booms.forEach((b) => (b.t += dt)); booms = booms.filter((b) => b.t < 0.5)
      if (!foes.some((f) => f.a)) { s.wave++; s.score += 100; wave(); say('level') }
      if (alive.some((f) => f.y > H - 40)) { if (demo) wave(); else { s.lives = 0; s.over = true; say('over') } }
      function hurt() { s.lives--; s.hurt = 1.5; booms.push({ x: ship.x, y: H - 16, t: 0 }); say('crash'); if (s.lives <= 0) { s.over = true; say('over') } }
    },
    draw(g, t) {
      const k = g.canvas.width / W
      g.setTransform(k, 0, 0, k, 0, 0)
      g.fillStyle = '#050505'; g.fillRect(0, 0, W, H)
      stars.forEach((st) => { g.fillStyle = st.v > 35 ? '#ffffffcc' : '#ffffff44'; g.fillRect(st.x, st.y, 1, 1) })
      foes.forEach((f) => {
        if (!f.a) return
        g.fillStyle = f.k === 'eye' ? '#ffffff' : f.k === 'skull' ? '#d8d2c4' : '#9a948a'
        const wob = Math.sin(f.ph) > 0 ? 0 : 1
        SPR[f.k].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && g.fillRect(f.x + i, f.y + j + (j > 4 ? wob : 0), 1, 1)))
      })
      g.fillStyle = '#ffffff'; shots.forEach((b) => g.fillRect(b.x - 0.5, b.y, 1.5, 5))
      g.fillStyle = '#bdb6a8'; bombs.forEach((b) => { g.fillRect(b.x - 1, b.y, 2, 4); g.fillRect(b.x - 2, b.y + (Math.floor(t * 10) % 2), 4, 1) })
      booms.forEach((b) => { g.fillStyle = `rgba(255,255,255,${1 - b.t * 2})`; for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; g.fillRect(b.x + Math.cos(a) * b.t * 40, b.y + Math.sin(a) * b.t * 40, 2, 2) } })
      if (!(s.hurt > 0 && Math.floor(t * 12) % 2)) {
        g.fillStyle = '#ffffff'
        g.fillRect(ship.x - 7, H - 14, 14, 4); g.fillRect(ship.x - 3, H - 18, 6, 4); g.fillRect(ship.x - 1, H - 22, 2, 4); g.fillRect(ship.x - 7, H - 18, 2, 4); g.fillRect(ship.x + 5, H - 18, 2, 4)
      }
      g.fillStyle = '#e8e4dc'; g.font = '700 10px "Pixelify Sans", monospace'; g.textAlign = 'left'; g.textBaseline = 'top'
      g.fillText(String(s.score).padStart(5, '0'), 6, 5)
      g.textAlign = 'right'; g.fillText('♥'.repeat(Math.max(0, s.lives)), W - 6, 5)
      if (!demo && s.ready > 0) { g.textAlign = 'center'; g.font = '700 18px "Pixelify Sans", monospace'; g.fillText('WAVE ' + s.wave, W / 2, H * 0.55) }
      g.setTransform(1, 0, 0, 1, 0, 0)
    },
  }
}
