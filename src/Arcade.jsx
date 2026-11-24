import { useEffect, useRef, useState } from 'react'
import { sfx } from './audio.js'
import { world } from './world.js'

const COLS = 10, ROWS = 20, CELL = 20
const COLORS = ['#78d7ff', '#D9E7E8', '#528A9A', '#7dffc8', '#b49bff', '#f4fafb', '#ffb3a0']
const SHAPES = [
  [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]],
]
const rot = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse())
const best = (k) => { try { return +localStorage.getItem('dg-best-' + k) || 0 } catch { return 0 } }
const saveBest = (k, v) => { try { localStorage.setItem('dg-best-' + k, v) } catch {} }

function newPiece() { const i = (Math.random() * 7) | 0; return { m: SHAPES[i], c: i + 1, x: 3, y: 0 } }

function makeTetris() {
  const s = { board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)), cur: newPiece(), next: newPiece(), score: 0, lines: 0, acc: 0, over: false }
  const hit = (m, x, y) => m.some((r, j) => r.some((v, i) => v && (x + i < 0 || x + i >= COLS || y + j >= ROWS || (y + j >= 0 && s.board[y + j][x + i]))))
  const lock = () => {
    s.cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && s.cur.y + j >= 0) s.board[s.cur.y + j][s.cur.x + i] = s.cur.c }))
    let n = 0
    s.board = s.board.filter((r) => { const full = r.every(Boolean); if (full) n++; return !full })
    while (s.board.length < ROWS) s.board.unshift(Array(COLS).fill(0))
    s.lines += n; s.score += [0, 100, 300, 500, 800][n]
    s.cur = s.next; s.next = newPiece()
    if (hit(s.cur.m, s.cur.x, s.cur.y)) s.over = true
  }
  return {
    s,
    act(a) {
      const c = s.cur
      if (a === 'left' && !hit(c.m, c.x - 1, c.y)) c.x--
      if (a === 'right' && !hit(c.m, c.x + 1, c.y)) c.x++
      if (a === 'down') { if (!hit(c.m, c.x, c.y + 1)) { c.y++; s.score += 1 } else lock() }
      if (a === 'up' || a === 'a') { const r = rot(c.m); for (const k of [0, -1, 1, -2, 2]) if (!hit(r, c.x + k, c.y)) { c.m = r; c.x += k; break } }
      if (a === 'b') { while (!hit(c.m, c.x, c.y + 1)) { c.y++; s.score += 2 } lock() }
    },
    step(dt) {
      s.acc += dt
      const speed = Math.max(0.12, 0.7 - Math.floor(s.lines / 8) * 0.07)
      if (s.acc > speed) { s.acc = 0; this.act('down') }
    },
    draw(g) {
      s.board.forEach((r, y) => r.forEach((v, x) => v && cell(g, x, y, COLORS[v - 1])))
      const c = s.cur
      let gy = c.y; while (!hit(c.m, c.x, gy + 1)) gy++
      c.m.forEach((r, j) => r.forEach((v, i) => v && ghost(g, c.x + i, gy + j)))
      c.m.forEach((r, j) => r.forEach((v, i) => v && cell(g, c.x + i, c.y + j, COLORS[c.c - 1])))
    },
  }
}

function makeSnake() {
  const s = { body: [[4, 10], [4, 11], [4, 12]], dir: [0, -1], nextDir: [0, -1], food: [6, 5], score: 0, acc: 0, over: false }
  const place = () => { do { s.food = [(Math.random() * COLS) | 0, (Math.random() * ROWS) | 0] } while (s.body.some(([x, y]) => x === s.food[0] && y === s.food[1])) }
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
  return {
    s,
    act(a) { const d = D[a]; if (d && (d[0] !== -s.dir[0] || d[1] !== -s.dir[1])) s.nextDir = d },
    step(dt) {
      s.acc += dt
      if (s.acc < Math.max(0.07, 0.16 - s.score / 4000)) return
      s.acc = 0; s.dir = s.nextDir
      const [hx, hy] = s.body[0], nx = hx + s.dir[0], ny = hy + s.dir[1]
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || s.body.some(([x, y]) => x === nx && y === ny)) { s.over = true; return }
      s.body.unshift([nx, ny])
      if (nx === s.food[0] && ny === s.food[1]) { s.score += 50; place() } else s.body.pop()
    },
    draw(g, t) {
      const [fx, fy] = s.food
      g.fillStyle = '#f4fafb'
      const p = Math.sin(t * 8) > 0 ? 0 : 2
      g.fillRect(fx * CELL + 8, fy * CELL + 2 + p, 4, 16 - p * 2); g.fillRect(fx * CELL + 2 + p, fy * CELL + 8, 16 - p * 2, 4)
      s.body.forEach(([x, y], i) => cell(g, x, y, i === 0 ? '#7dffc8' : i % 2 ? '#78d7ff' : '#528A9A'))
    },
  }
}

function cell(g, x, y, c) {
  if (y < 0) return
  g.fillStyle = c; g.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 3)
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x * CELL + 1, y * CELL + CELL - 4, CELL - 2, 3)
}
function ghost(g, x, y) { if (y < 0) return; g.strokeStyle = 'rgba(220,239,246,.25)'; g.strokeRect(x * CELL + 2.5, y * CELL + 2.5, CELL - 5, CELL - 5) }

export default function Arcade({ t }) {
  const [game, setGame] = useState('tetris')
  const [state, setState] = useState('idle')
  const [score, setScore] = useState(0)
  const [hi, setHi] = useState(() => best('tetris'))
  const cv = useRef(), box = useRef(), eng = useRef(null), visible = useRef(true)

  const live = useRef({ state: 'idle', game: 'tetris', score: 0 })
  live.current.state = state; live.current.game = game

  useEffect(() => { setHi(best(game)); setState('idle'); setScore(0); eng.current = null }, [game])

  const start = () => {
    eng.current = game === 'tetris' ? makeTetris() : makeSnake()
    live.current.score = 0
    setScore(0); setState('play'); sfx('coin'); box.current?.focus({ preventScroll: true })
  }
  const act = (a) => {
    if (state !== 'play') { if (a === 'a' || a === 'start') start(); return }
    const e = eng.current; if (!e) return
    const before = e.s.lines
    e.act(a)
    if (game === 'tetris') sfx(a === 'b' ? 'drop' : a === 'up' || a === 'a' ? 'rotate' : 'move')
    if (e.s.lines > before) sfx('line')
  }

  /* one loop for the lifetime of the console; reads the current state through a ref */
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting }, { threshold: 0.2 })
    io.observe(box.current)
    let raf, last = performance.now()
    const g = cv.current.getContext('2d')
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      raf = requestAnimationFrame(loop)
      if (!visible.current || world.modal) return
      g.fillStyle = '#10232d'; g.fillRect(0, 0, COLS * CELL, ROWS * CELL)
      g.fillStyle = 'rgba(120,215,255,.06)'
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) g.fillRect(x * CELL + 9, y * CELL + 9, 2, 2)
      const e = eng.current, L = live.current
      if (!e) return
      if (L.state === 'play') {
        const lines = e.s.lines, len = e.s.body?.length
        e.step(dt)
        if (e.s.lines > lines) sfx('line')
        if (len && e.s.body.length > len) sfx('eat')
        if (e.s.score !== L.score) { L.score = e.s.score; setScore(e.s.score) }
        if (e.s.over) {
          L.state = 'over'; setState('over'); sfx('over')
          if (e.s.score > best(L.game)) { saveBest(L.game, e.s.score); setHi(e.s.score) }
        }
      }
      e.draw(g, now / 1000)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); io.disconnect() }
  }, [])

  const keyAction = (e) => {
    const byCode = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'up', KeyA: 'left', KeyD: 'right', KeyS: 'down', KeyW: 'up', Space: 'b', Enter: 'start', NumpadEnter: 'start', KeyX: 'a', KeyZ: 'b', KeyE: 'a', KeyQ: 'b' }
    return byCode[e.code]
  }
  const onKey = (e) => {
    if (state === 'play') return // handled by the window listener below
    const a = keyAction(e); if (!a) return
    if (a === 'start' || a === 'b' || a === 'a') { e.preventDefault(); start() }
  }
  const actRef = useRef(act); actRef.current = act
  useEffect(() => {
    if (state !== 'play') return
    const h = (e) => {
      if (!visible.current) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || world.modal) return
      const a = keyAction(e); if (!a) return
      e.preventDefault(); actRef.current(a)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [state])
  const press = (a) => (e) => { e.preventDefault(); act(a) }

  return (
    <div className="console" ref={box} tabIndex={0} onKeyDown={onKey} aria-label={t.consoleLabel}>
      <div className="c-top">
        <div className="tabs" role="tablist">
          {['tetris', 'snake'].map((g) => <button key={g} role="tab" aria-selected={game === g} className={game === g ? 'on' : ''} onClick={() => setGame(g)}>{t.games[g]}</button>)}
        </div>
        <span className="led" data-on={state === 'play'} aria-hidden="true" />
      </div>
      <div className="screen">
        <canvas ref={cv} width={COLS * CELL} height={ROWS * CELL} />
        <div className="hud"><span>{t.score} {score}</span><span>{t.best} {hi}</span></div>
        {state !== 'play' && (
          <div className="overlay">
            <p className="ov-t">{state === 'over' ? t.over : t.games[game]}</p>
            <p className="ov-s">{game === 'tetris' ? t.helpTetris : t.helpSnake}</p>
            <button className="start" onClick={start}>{state === 'over' ? t.again : t.start}</button>
          </div>
        )}
      </div>
      <div className="pads">
        <div className="dpad">
          <button className="u" onPointerDown={press('up')} aria-label="up" />
          <button className="l" onPointerDown={press('left')} aria-label="left" />
          <button className="r" onPointerDown={press('right')} aria-label="right" />
          <button className="d" onPointerDown={press('down')} aria-label="down" />
        </div>
        <div className="ab">
          <button onPointerDown={press('b')} aria-label="B">B</button>
          <button onPointerDown={press('a')} aria-label="A">A</button>
        </div>
      </div>
      <p className="brand">FROST·BOY</p>
    </div>
  )
}
