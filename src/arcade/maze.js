/* "Chomper": an original neon maze-chase. The player eats dots, glitch-bugs hunt it.
   Works in demo mode (AI plays on the TV) and in play mode (full screen modal). */
const MAP = [
  '###################',
  '#o.......#.......o#',
  '#.##.###.#.###.##.#',
  '#.#.............#.#',
  '#.#.##.#####.##.#.#',
  '#......#...#......#',
  '###.##.#.#.#.##.###',
  '###.#.........#.###',
  '###.#.###-###.#.###',
  '......#GGGGG#......',
  '###.#.#######.#.###',
  '###.#....P....#.###',
  '###.#.#######.#.###',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#...........#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
]
export const MW = 19, MH = 21
const D4 = [[0, -1], [-1, 0], [0, 1], [1, 0]]
const ACT = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const GH = [
  { c: '#ff3cac', corner: [17, -2], rel: 0 },
  { c: '#3cf2ff', corner: [1, -2], rel: 2.5 },
  { c: '#b8ff3c', corner: [18, 22], rel: 5 },
  { c: '#ff9b3c', corner: [0, 22], rel: 7.5 },
]

export function createMaze({ demo = false, sfx = () => {}, readyText = 'READY!' } = {}) {
  const s = { score: 0, lives: 3, level: 1, over: false, fright: 0, mode: 0, modeT: 0, time: 0, ready: demo ? 0.4 : 2.2, dying: 0, win: 0, combo: 0, left: 0, freeze: 0, best: 0 }
  let grid, p, ghosts
  const say = (n) => { if (!demo) sfx(n) }

  function newGrid() { grid = MAP.map((r) => [...r]); s.left = grid.flat().filter((c) => c === '.' || c === 'o').length }
  function place() {
    p = { x: 9, y: 11, dir: [0, 0], want: [-1, 0], mouth: 0 }
    ghosts = GH.map((g, i) => ({ ...g, k: i, ghost: true, x: i ? 7 + i : 9, y: i ? 9 : 7, dir: [0, 0], state: i ? 'house' : 'run', fr: false, bob: i }))
    s.time = 0; s.fright = 0; s.mode = 0; s.modeT = 0
  }
  newGrid(); place()
  const base = () => Math.min(9, 6 + s.level * 0.35)

  const tile = (x, y) => (y < 0 || y >= MH ? '#' : grid[y][(x + MW) % MW])
  const pass = (e, x, y) => {
    const c = tile(x, y)
    if (c === '#') return false
    if (c === '-') return e.ghost && (e.state === 'leave' || e.state === 'eaten')
    if (c === 'G') return e.ghost && e.state !== 'run'
    return true
  }

  function move(e, dist, onCenter) {
    for (let guard = 0; guard < 6 && dist > 1e-6; guard++) {
      const atC = Math.abs(e.x - Math.round(e.x)) < 1e-3 && Math.abs(e.y - Math.round(e.y)) < 1e-3
      if (atC) {
        e.x = Math.round(e.x); e.y = Math.round(e.y)
        onCenter(e)
        if (!e.dir[0] && !e.dir[1]) return
        if (!pass(e, e.x + e.dir[0], e.y + e.dir[1])) { e.dir = [0, 0]; return }
      } else if (!e.ghost && e.want && e.want[0] === -e.dir[0] && e.want[1] === -e.dir[1]) e.dir = e.want
      if (!e.dir[0] && !e.dir[1]) return
      const nx = e.dir[0] ? (e.dir[0] > 0 ? Math.floor(e.x + 1e-3) + 1 : Math.ceil(e.x - 1e-3) - 1) : e.x
      const ny = e.dir[1] ? (e.dir[1] > 0 ? Math.floor(e.y + 1e-3) + 1 : Math.ceil(e.y - 1e-3) - 1) : e.y
      const rem = Math.abs(nx - e.x) + Math.abs(ny - e.y)
      const mv = Math.min(dist, rem)
      e.x += e.dir[0] * mv; e.y += e.dir[1] * mv; dist -= mv
      if (mv >= rem - 1e-6) { e.x = nx; e.y = ny }
      if (e.x < 0) e.x += MW; else if (e.x > MW - 1) e.x -= MW
    }
  }

  /* demo AI: BFS to the nearest dot, staying away from hunting glitches */
  function ai() {
    const danger = new Set()
    ghosts.forEach((g) => {
      if (g.state !== 'run' || g.fr) return
      const gx = Math.round(g.x), gy = Math.round(g.y)
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) danger.add(((gx + dx + MW) % MW) + ',' + (gy + dy))
    })
    const bfs = (avoid) => {
      const seen = new Set([p.x + ',' + p.y]), q = []
      D4.forEach((d) => { const x = (p.x + d[0] + MW) % MW, y = p.y + d[1]; if (pass(p, x, y) && !(avoid && danger.has(x + ',' + y))) { q.push([x, y, d]); seen.add(x + ',' + y) } })
      while (q.length) {
        const [x, y, first] = q.shift()
        const c = grid[y][x]
        if (c === '.' || c === 'o') return first
        for (const d of D4) {
          const nx = (x + d[0] + MW) % MW, ny = y + d[1], key = nx + ',' + ny
          if (seen.has(key) || !pass(p, nx, ny) || (avoid && danger.has(key))) continue
          seen.add(key); q.push([nx, ny, first])
        }
      }
      return null
    }
    return bfs(true) || bfs(false) || p.dir
  }

  function playerCenter(e) {
    if (demo) e.want = ai()
    if (e.want && pass(e, e.x + e.want[0], e.y + e.want[1])) e.dir = e.want
    const c = grid[e.y][e.x]
    if (c === '.' || c === 'o') {
      grid[e.y][e.x] = ' '; s.left--
      if (c === '.') { s.score += 10; say('wa') }
      else {
        s.score += 50; say('power'); s.combo = 0
        s.fright = Math.max(3, 7 - s.level * 0.5)
        ghosts.forEach((g) => { if (g.state === 'run') { g.fr = true; g.dir = [-g.dir[0], -g.dir[1]] } })
      }
    }
  }

  function target(g) {
    if (g.state === 'leave') return [9, 7]
    if (g.state === 'eaten') return [9, 9]
    if (s.mode === 0) return g.corner
    const px = Math.round(p.x), py = Math.round(p.y)
    if (g.k === 0) return [px, py]
    if (g.k === 1) return [px + p.dir[0] * 4, py + p.dir[1] * 4]
    if (g.k === 2) { const a = ghosts[0]; return [2 * (px + p.dir[0] * 2) - a.x, 2 * (py + p.dir[1] * 2) - a.y] }
    return Math.hypot(g.x - px, g.y - py) > 7 ? [px, py] : g.corner
  }

  function ghostCenter(g) {
    if (g.state === 'leave' && g.x === 9 && g.y === 7) g.state = 'run'
    if (g.state === 'eaten' && g.x === 9 && g.y === 9) { g.state = 'leave'; g.fr = false; g.dir = [0, 0] }
    const opts = []
    for (const d of D4) {
      if ((g.dir[0] || g.dir[1]) && d[0] === -g.dir[0] && d[1] === -g.dir[1]) continue
      if (pass(g, g.x + d[0], g.y + d[1])) opts.push(d)
    }
    if (!opts.length) { const r = [-g.dir[0], -g.dir[1]]; if (pass(g, g.x + r[0], g.y + r[1])) opts.push(r) }
    if (!opts.length) { g.dir = [0, 0]; return }
    if (g.fr && g.state === 'run') { g.dir = opts[(Math.random() * opts.length) | 0]; return }
    const [tx, ty] = target(g)
    let best = opts[0], bd = Infinity
    for (const d of opts) { const dd = (g.x + d[0] - tx) ** 2 + (g.y + d[1] - ty) ** 2; if (dd < bd) { bd = dd; best = d } }
    g.dir = best
  }

  return {
    s,
    get w() { return MW }, get h() { return MH },
    input(a, down) { if (down && ACT[a]) p.want = ACT[a] },
    step(dt) {
      if (s.over) return
      if (s.ready > 0) { s.ready -= dt; return }
      if (s.freeze > 0) { s.freeze -= dt; return }
      if (s.win > 0) {
        s.win -= dt
        if (s.win <= 0) { s.level++; newGrid(); place(); s.ready = demo ? 0.4 : 1.6 }
        return
      }
      if (s.dying > 0) {
        s.dying -= dt
        if (s.dying <= 0) {
          if (!demo) s.lives--
          if (s.lives <= 0) { s.over = true; say('over'); return }
          if (demo && s.left < 40) newGrid()
          place(); s.ready = demo ? 0.4 : 1.6
        }
        return
      }
      s.time += dt
      p.mouth += dt * 14
      // scatter / chase cycle
      s.modeT += dt
      const len = s.mode === 0 ? 6 : 18
      if (s.modeT > len && !s.fright) { s.modeT = 0; s.mode ^= 1; ghosts.forEach((g) => { if (g.state === 'run') g.dir = [-g.dir[0], -g.dir[1]] }) }
      if (s.fright > 0) { s.fright -= dt; if (s.fright <= 0) ghosts.forEach((g) => (g.fr = false)) }
      const b = base()
      move(p, dt * b * (s.fright > 0 ? 1.08 : 1), playerCenter)
      ghosts.forEach((g) => {
        if (g.state === 'house') { g.bob += dt * 4; if (s.time > g.rel) g.state = 'leave'; return }
        const tunnel = g.y === 9 && (g.x < 6 || g.x > 12)
        const sp = g.state === 'eaten' ? b * 2.2 : g.state === 'leave' ? b * 0.6 : g.fr ? b * 0.55 : tunnel ? b * 0.5 : b * (0.86 + s.level * 0.015)
        move(g, dt * sp, ghostCenter)
      })
      for (const g of ghosts) {
        if (g.state !== 'run') continue
        const dx = Math.min(Math.abs(g.x - p.x), MW - Math.abs(g.x - p.x))
        if (dx + Math.abs(g.y - p.y) < 0.7) {
          if (g.fr) { g.state = 'eaten'; g.fr = false; s.score += 200 * 2 ** s.combo; s.combo++; s.freeze = 0.35; say('ghost') }
          else { s.dying = 1.5; say('die'); break }
        }
      }
      if (s.left <= 0) { s.win = 1.8; say('level') }
    },
    draw(g, t) {
      const T = g.canvas.width / MW
      g.fillStyle = '#05010f'; g.fillRect(0, 0, g.canvas.width, g.canvas.height)
      const flash = s.win > 0 && Math.floor(s.win * 6) % 2
      g.drawImage(walls(T, flash ? '#ffffff' : '#6f5bff'), 0, 0)
      g.fillStyle = '#ff9bd8'; g.fillRect(9 * T + T * 0.1, 8 * T + T * 0.42, T * 0.8, T * 0.16)
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const c = grid[y][x]
        if (c === '.') { g.fillStyle = '#ffd6f5'; const r = Math.max(1, T * 0.16); g.fillRect(x * T + T / 2 - r / 2, y * T + T / 2 - r / 2, r, r) }
        else if (c === 'o' && Math.sin(t * 8) > -0.3) { g.fillStyle = '#ffe23c'; g.shadowColor = '#ffe23c'; g.shadowBlur = T * 0.8; g.beginPath(); g.arc(x * T + T / 2, y * T + T / 2, T * 0.34, 0, 7); g.fill(); g.shadowBlur = 0 }
      }
      ghosts.forEach((gh) => drawGhost(g, gh, T, t, s.fright))
      drawChomper(g, p, T, s.dying)
      if (s.ready > 0 && !demo) text(g, T, readyText, '#ffe23c', 13)
    },
  }
}

/* ---------- drawing ---------- */
const wallCache = new Map()
function walls(T, col) {
  const key = T + col
  if (wallCache.has(key)) return wallCache.get(key)
  const c = document.createElement('canvas'); c.width = MW * T; c.height = MH * T
  const g = c.getContext('2d')
  const W = (x, y) => y >= 0 && y < MH && x >= 0 && x < MW && MAP[y][x] === '#'
  const i = T * 0.32
  g.strokeStyle = col; g.lineWidth = Math.max(1, T / 7); g.lineCap = 'round'; g.shadowColor = col; g.shadowBlur = T * 0.7
  g.beginPath()
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!W(x, y)) continue
    const x0 = x * T, y0 = y * T, x1 = x0 + T, y1 = y0 + T
    const up = !W(x, y - 1) && y > 0, dn = !W(x, y + 1) && y < MH - 1, lf = !W(x - 1, y) && x > 0, rt = !W(x + 1, y) && x < MW - 1
    if (up) { g.moveTo(lf ? x0 + i : x0, y0 + i); g.lineTo(rt ? x1 - i : x1, y0 + i) }
    if (dn) { g.moveTo(lf ? x0 + i : x0, y1 - i); g.lineTo(rt ? x1 - i : x1, y1 - i) }
    if (lf) { g.moveTo(x0 + i, up ? y0 + i : y0); g.lineTo(x0 + i, dn ? y1 - i : y1) }
    if (rt) { g.moveTo(x1 - i, up ? y0 + i : y0); g.lineTo(x1 - i, dn ? y1 - i : y1) }
    // concave corners
    if (!up && !lf && y > 0 && x > 0 && !W(x - 1, y - 1)) { g.moveTo(x0 + i, y0); g.lineTo(x0 + i, y0 + i); g.lineTo(x0, y0 + i) }
    if (!up && !rt && y > 0 && x < MW - 1 && !W(x + 1, y - 1)) { g.moveTo(x1 - i, y0); g.lineTo(x1 - i, y0 + i); g.lineTo(x1, y0 + i) }
    if (!dn && !lf && y < MH - 1 && x > 0 && !W(x - 1, y + 1)) { g.moveTo(x0 + i, y1); g.lineTo(x0 + i, y1 - i); g.lineTo(x0, y1 - i) }
    if (!dn && !rt && y < MH - 1 && x < MW - 1 && !W(x + 1, y + 1)) { g.moveTo(x1 - i, y1); g.lineTo(x1 - i, y1 - i); g.lineTo(x1, y1 - i) }
  }
  g.stroke(); g.stroke()
  wallCache.set(key, c)
  return c
}

function drawChomper(g, p, T, dying) {
  const cx = p.x * T + T / 2, cy = p.y * T + T / 2, R = T * 0.62
  const ang = Math.atan2(p.dir[1] || 0, p.dir[0] || (p.dir[1] ? 0 : -1))
  let m = 0.05 + Math.abs(Math.sin(p.mouth)) * 0.32
  let r = R
  if (dying > 0) { const k = 1 - dying / 1.5; m = Math.min(Math.PI * 0.98, 0.2 + k * Math.PI); r = R * (1 - Math.max(0, k - 0.7) * 3) }
  if (r <= 0) return
  g.save(); g.translate(cx, cy); g.rotate(ang)
  g.shadowColor = '#ffe23c'; g.shadowBlur = T * 0.9
  g.fillStyle = '#ffe23c'
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, m * Math.PI, (2 - m) * Math.PI); g.closePath(); g.fill()
  g.shadowBlur = 0
  // frosty tuft and an eye make it our own character
  if (dying <= 0) {
    g.fillStyle = '#3cf2ff'; g.fillRect(-r * 0.5, -r * 1.05, r * 0.35, r * 0.3); g.fillRect(-r * 0.1, -r * 1.2, r * 0.3, r * 0.4)
    g.fillStyle = '#1a0630'; g.beginPath(); g.arc(r * 0.12, -r * 0.48, Math.max(1, r * 0.16), 0, 7); g.fill()
  }
  g.restore()
}

function drawGhost(g, gh, T, t, fright) {
  const x = gh.x * T + T / 2, y = gh.y * T + T / 2 + (gh.state === 'house' ? Math.sin(gh.bob) * T * 0.2 : 0)
  const w = T * 1.2, h = T * 1.15
  const scared = gh.fr && gh.state === 'run'
  if (gh.state !== 'eaten') {
    const col = scared ? (fright < 2 && Math.floor(t * 8) % 2 ? '#ffffff' : '#2d2dff') : gh.c
    g.shadowColor = col; g.shadowBlur = T * 0.7; g.fillStyle = col
    // blocky glitch body with jagged feet
    const l = x - w / 2, top = y - h / 2
    g.beginPath()
    g.moveTo(l, top + h * 0.35)
    g.lineTo(l + w * 0.2, top); g.lineTo(l + w * 0.8, top); g.lineTo(l + w, top + h * 0.35)
    g.lineTo(l + w, top + h)
    const ph = Math.floor(t * 8) % 2
    for (let k = 0; k < 4; k++) { const xx = l + w - (k + 0.5) * (w / 4); g.lineTo(xx, top + h - (k % 2 === ph ? h * 0.22 : 0)); g.lineTo(l + w - (k + 1) * (w / 4), top + h) }
    g.closePath(); g.fill()
    // antennae
    g.fillRect(l + w * 0.18, top - h * 0.25, Math.max(1, T * 0.12), h * 0.25); g.fillRect(l + w * 0.7, top - h * 0.25, Math.max(1, T * 0.12), h * 0.25)
    g.shadowBlur = 0
    if (scared) { g.fillStyle = '#ffd6f5'; g.fillRect(x - w * 0.25, y - h * 0.08, w * 0.12, w * 0.12); g.fillRect(x + w * 0.13, y - h * 0.08, w * 0.12, w * 0.12); return }
  }
  // eyes look where it walks
  const ex = (gh.dir[0] || 0) * T * 0.12, ey = (gh.dir[1] || 0) * T * 0.12
  g.fillStyle = '#ffffff'
  g.fillRect(x - w * 0.34, y - h * 0.2, w * 0.26, h * 0.3); g.fillRect(x + w * 0.08, y - h * 0.2, w * 0.26, h * 0.3)
  g.fillStyle = '#10002a'
  g.fillRect(x - w * 0.28 + ex, y - h * 0.12 + ey, w * 0.13, h * 0.15); g.fillRect(x + w * 0.14 + ex, y - h * 0.12 + ey, w * 0.13, h * 0.15)
}

function text(g, T, str, col, row) {
  g.font = `700 ${Math.round(T * 0.9)}px "Pixelify Sans", monospace`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = col; g.shadowColor = col; g.shadowBlur = T * 0.6
  g.fillText(str, (MW * T) / 2, row * T + T / 2)
  g.shadowBlur = 0
}
