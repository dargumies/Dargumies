import { useEffect, useRef, useState } from 'react'
import Console from '../Arcade.jsx'
import GameModal, { GAMES } from './GameModal.jsx'
import { createMaze, MW, MH } from './maze.js'
import { createRacer } from './racer.js'
import { createPong } from './pong.js'
import { createShooter } from './shooter.js'
import { drawStatic } from './demos.js'
import { sfx } from '../audio.js'
import { world } from '../world.js'

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const DEMOS = {
  maze: () => { const g = createMaze({ demo: true }); g.native = [MW * 8, MH * 8]; return g },
  racer: () => createRacer({ demo: true }),
  pong: () => createPong({ demo: true }),
  shooter: () => { const g = createShooter({ demo: true }); g.native = [240, 320]; return g },
}
const CH_TIME = 8

export default function Room({ t, lang }) {
  const sec = useRef(), tv = useRef(), cv = useRef(), scr = useRef()
  const [modal, setModal] = useState(null)
  const [ch, setCh] = useState(0)

  /* attract mode: the TV flips through demos of every game */
  useEffect(() => {
    let active = false
    const io = new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) sec.current.classList.add('lit') }, { threshold: 0.05 })
    io.observe(sec.current)
    const st = { i: 0, t: 0, stat: 1.1, game: DEMOS[GAMES[0]](), nc: null }
    const mkNative = () => { st.nc = null; if (st.game.native) { st.nc = document.createElement('canvas'); st.nc.width = st.game.native[0]; st.nc.height = st.game.native[1] } }
    mkNative()
    const next = (dir = 1) => { st.i = (st.i + dir + GAMES.length) % GAMES.length; st.game = DEMOS[GAMES[st.i]](); mkNative(); st.t = 0; st.stat = 0.45; setCh(st.i) }
    tv.current.nextCh = (d) => { next(d); sfx('channel') }
    let raf, last = performance.now()
    const g = cv.current.getContext('2d')
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      raf = requestAnimationFrame(loop)
      if (!active || world.modal) return
      if (st.stat > 0) { st.stat -= dt; drawStatic(g); return }
      st.t += dt
      if (st.t > CH_TIME) { next(); return }
      st.game.step(dt)
      const W = cv.current.width, H = cv.current.height
      if (st.nc) {
        st.game.draw(st.nc.getContext('2d'), now / 1000)
        const k = H / st.nc.height, dw = st.nc.width * k
        g.fillStyle = '#050505'; g.fillRect(0, 0, W, H)
        g.imageSmoothingEnabled = false
        g.drawImage(st.nc, (W - dw) / 2, 0, dw, H)
      } else st.game.draw(g, now / 1000)
      // tiny channel banner at the start of each programme
      if (st.t < 1.6) {
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H - 22, W, 22)
        g.fillStyle = '#e8e4dc'; g.font = '600 11px "Pixelify Sans", monospace'; g.textAlign = 'left'; g.textBaseline = 'middle'
        g.fillText('CH 0' + (st.i + 1) + ' · ' + t.games[GAMES[st.i]].toUpperCase(), 10, H - 11)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); io.disconnect() }
  }, [lang])

  const open = () => { sfx('coin'); setModal({ rect: scr.current.getBoundingClientRect() }) }
  const tilt = (e) => {
    if (reduced) return
    const r = tv.current.getBoundingClientRect()
    tv.current.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * 10 + 'deg')
    tv.current.style.setProperty('--rx', -((e.clientY - r.top) / r.height - 0.5) * 7 + 'deg')
  }
  const untilt = () => { tv.current.style.setProperty('--ry', '0deg'); tv.current.style.setProperty('--rx', '0deg') }

  return (
    <section id="arcade" className="arc-sec" data-night data-zone="arcade" ref={sec}>
      <div className="arc-lamp" aria-hidden="true"><i className="wire" /><i className="bulb" /><i className="cone" /></div>
      <div className="arc-scratches" aria-hidden="true"><i /><i /><i /></div>
      <div className="arc-in">
        <header className="arc-head">
          <div className="intertitle">
            <p className="it-kick">{t.arcKick}</p>
            <h2 className="it-title" aria-label={t.arcTitle}>{[...t.arcTitle].map((c, i) => <span key={lang + i} style={{ '--i': i }}>{c}</span>)}</h2>
            <p className="it-sub">{t.arcSub}</p>
          </div>
        </header>
        <div className="arc-stage">
          <div className="tv tv-l" ref={tv} role="button" tabIndex={0} onClick={open} onPointerMove={tilt} onPointerLeave={untilt}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
            data-cursor={t.curPlay} aria-label={t.tvOpen}>
            <div className="tv-ant" aria-hidden="true"><i /><i /></div>
            <div className="tv-body">
              <div className="tv-screen" ref={scr}>
                <canvas ref={cv} width="256" height="192" />
                <div className="tv-fx" aria-hidden="true" />
                <span className="tv-osd" aria-hidden="true">CH {String(ch + 1).padStart(2, '0')}</span>
                <div className="tv-cta"><b>{t.tvOpen}</b><em>{t.insert}</em></div>
              </div>
              <div className="tv-side" aria-hidden="true">
                <button className="knob" tabIndex={-1} onClick={(e) => { e.stopPropagation(); tv.current.nextCh(1) }} title={t.tvCh} />
                <button className="knob sm" tabIndex={-1} onClick={(e) => { e.stopPropagation(); tv.current.nextCh(-1) }} title={t.tvCh} />
                <div className="grill" />
              </div>
            </div>
            <p className="tv-brand" aria-hidden="true">RUBIN · 1987</p>
          </div>
          <div className="arc-console">
            <Console t={t} />
            <p className="arc-note">{t.consoleSub}</p>
          </div>
        </div>
        <p className="arc-keys">{t.arcKeys}</p>
      </div>
      {modal && <GameModal from={modal.rect} t={t} onClose={() => setModal(null)} />}
    </section>
  )
}
