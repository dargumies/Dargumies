/* Ping-pong against the machine. First to 7. Keyboard ↑/↓ or drag on the screen. */
const W = 400, H = 300, PH = 46, PW = 7, WIN = 7

export function createPong({ demo = false, sfx = () => {}, labels = {} } = {}) {
  const s = { score: 0, me: 0, cpu: 0, over: false, win: false, ready: demo ? 0 : 1.6, keys: {}, target: null, rally: 0, flash: 0 }
  const L = { y: H / 2 }, R = { y: H / 2 }
  let ball
  const say = (n) => { if (!demo) sfx(n) }
  const serve = (dir) => {
    const a = (Math.random() - 0.5) * 0.9
    ball = { x: W / 2, y: H / 2, vx: Math.cos(a) * 210 * dir, vy: Math.sin(a) * 210, trail: [] }
    s.rally = 0
  }
  serve(Math.random() < 0.5 ? 1 : -1)

  const ai = (p, lag, err) => {
    const ty = ball.vx * (p === R ? 1 : -1) > 0 ? ball.y + Math.sin(performance.now() / 300) * err : H / 2
    return Math.max(-1, Math.min(1, (ty - p.y) / lag))
  }

  return {
    s,
    input(a, down) { s.keys[a] = down; if (down) s.target = null },
    pointer(y01) { s.target = y01 * H },
    step(dt) {
      if (s.over) return
      if (s.ready > 0) { s.ready -= dt; return }
      if (s.flash > 0) s.flash -= dt
      // left paddle: player (or AI in demo)
      const sp = 330
      if (demo) L.y += ai(L, 40, 18) * sp * 0.8 * dt
      else if (s.target != null) L.y += Math.max(-sp * dt, Math.min(sp * dt, s.target - L.y))
      else L.y += ((s.keys.down ? 1 : 0) - (s.keys.up ? 1 : 0)) * sp * dt
      // right paddle: the machine gets a bit sharper every point you take
      R.y += ai(R, 34 - Math.min(14, s.me * 2), 26 - s.me * 2) * (230 + s.me * 18) * dt
      L.y = Math.max(PH / 2, Math.min(H - PH / 2, L.y)); R.y = Math.max(PH / 2, Math.min(H - PH / 2, R.y))

      ball.trail.unshift([ball.x, ball.y]); ball.trail.length = Math.min(ball.trail.length, 8)
      ball.x += ball.vx * dt; ball.y += ball.vy * dt
      if (ball.y < 5 || ball.y > H - 5) { ball.vy *= -1; ball.y = Math.max(5, Math.min(H - 5, ball.y)); say('move') }
      const hit = (p, x, dir) => {
        if ((dir < 0 && ball.vx < 0 && ball.x < x + PW && ball.x > x - 6) || (dir > 0 && ball.vx > 0 && ball.x > x - PW && ball.x < x + 6)) {
          if (Math.abs(ball.y - p.y) < PH / 2 + 5) {
            const off = (ball.y - p.y) / (PH / 2)
            const speed = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.06)
            const a = off * 1.0
            ball.vx = Math.cos(a) * speed * -dir; ball.vy = Math.sin(a) * speed
            ball.x = x - dir * (PW + 1)
            s.rally++
            if (p === L) { s.score += 10; say('rotate') } else say('move')
          }
        }
      }
      hit(L, 18, -1); hit(R, W - 18, 1)
      if (ball.x < -10 || ball.x > W + 10) {
        const mine = ball.x > W
        if (mine) { s.me++; s.score += 100; say('eat') } else { s.cpu++; say('crash') }
        s.flash = 0.4
        if (s.me >= WIN || s.cpu >= WIN) {
          if (demo) { s.me = s.cpu = 0 } else { s.over = true; s.win = s.me >= WIN; say(s.win ? 'level' : 'over'); return }
        }
        serve(mine ? -1 : 1); s.ready = demo ? 0.3 : 0.8
      }
    },
    draw(g) {
      const k = g.canvas.width / W
      g.setTransform(k, 0, 0, k, 0, 0)
      g.fillStyle = '#060606'; g.fillRect(0, 0, W, H)
      g.fillStyle = s.flash > 0 ? '#ffffff22' : 'transparent'; g.fillRect(0, 0, W, H)
      g.fillStyle = '#ffffff55'; for (let y = 6; y < H; y += 16) g.fillRect(W / 2 - 1.5, y, 3, 8)
      // big blocky score
      g.fillStyle = '#e8e4dc'; g.font = '700 46px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.textBaseline = 'top'
      g.fillText(s.me, W / 2 - 48, 12); g.fillText(s.cpu, W / 2 + 48, 12)
      g.fillStyle = '#e8e4dc'
      g.fillRect(18 - PW, L.y - PH / 2, PW, PH); g.fillRect(W - 18, R.y - PH / 2, PW, PH)
      ball.trail.forEach(([x, y], i) => { g.fillStyle = `rgba(232,228,220,${0.35 - i * 0.04})`; g.fillRect(x - 4, y - 4, 8, 8) })
      g.fillStyle = '#fff'; g.fillRect(ball.x - 5, ball.y - 5, 10, 10)
      if (!demo && s.ready > 0 && !s.over) { g.font = '700 22px "Pixelify Sans", monospace'; g.textBaseline = 'middle'; g.fillText(labels.ready || 'READY', W / 2, H * 0.62) }
      if (demo) { g.font = '600 11px "Pixelify Sans", monospace'; g.fillStyle = '#ffffff99'; g.fillText('1P', 30, 8); g.fillText('CPU', W - 30, 8) }
      g.setTransform(1, 0, 0, 1, 0, 0)
    },
  }
}
