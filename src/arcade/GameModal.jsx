import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { createMaze } from './maze.js'
import { createRacer } from './racer.js'
import { createPong } from './pong.js'
import { createShooter } from './shooter.js'
import { sfx, sound, engine } from '../audio.js'
import { world } from '../world.js'

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' }
export const GAMES = ['maze', 'racer', 'pong', 'shooter']
const SIZE = { maze: [304, 336], racer: [480, 300], pong: [400, 300], shooter: [240, 320] }
const best = (k) => { try { return +localStorage.getItem('dg-best-' + k) || 0 } catch { return 0 } }
const saveBest = (k, v) => { try { localStorage.setItem('dg-best-' + k, v) } catch {} }

function make(kind, t) {
  if (kind === 'maze') return createMaze({ sfx, readyText: t.getReady })
  if (kind === 'racer') return createRacer({ sfx, autoGas: coarse })
  if (kind === 'pong') return createPong({ sfx, labels: { ready: t.getReady } })
  return createShooter({ sfx, autoFire: coarse })
}

export default function GameModal({ from, t, onClose }) {
  const [kind, setKind] = useState('menu')
  const [sel, setSel] = useState(0)
  const cv = useRef(), frame = useRef(), back = useRef(), scr = useRef(), root = useRef()
  const eng = useRef(null), closing = useRef(false), pausedRef = useRef(false), overRef = useRef(false), kindRef = useRef('menu'), selRef = useRef(0)
  const [hud, setHud] = useState({ score: 0, a: 0, b: 0 })
  const [over, setOver] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hi, setHi] = useState(0)
  kindRef.current = kind; selRef.current = sel
  const playing = kind !== 'menu'

  const start = (k = kindRef.current) => {
    eng.current = make(k, t)
    overRef.current = false; setOver(false); pausedRef.current = false; setPaused(false)
    setHi(best(k))
    engine.stop(); if (k === 'racer') engine.start()
  }
  const pick = (k) => { sfx('coin'); setKind(k) }
  const toMenu = () => { engine.stop(); eng.current = null; sfx('close'); setKind('menu') }
  useEffect(() => { if (kind !== 'menu') start(kind) }, [kind])

  const close = () => {
    if (closing.current) return
    closing.current = true
    sfx('close'); engine.stop()
    if (reduced) { onClose(); return }
    const tl = gsap.timeline({ onComplete: onClose })
    tl.to(scr.current, { scaleY: 0.012, duration: 0.18, ease: 'power2.in' })
      .to(scr.current, { scaleX: 0, duration: 0.16, ease: 'power2.in' })
      .to(root.current.querySelectorAll('.gm-side,.gm-pad,.gm-x'), { opacity: 0, duration: 0.2 }, 0)
      .to(back.current, { opacity: 0, duration: 0.3 }, '-=0.1')
      .to(frame.current, { scale: 0.92, opacity: 0, duration: 0.25 }, '<')
  }
  const togglePause = () => { if (overRef.current || kindRef.current === 'menu') return; pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); sfx('beep') }

  useEffect(() => {
    world.modal = true; world.lenis?.stop()
    document.documentElement.classList.add('modal-open')
    sound.duck(true)
    return () => { world.modal = false; world.lenis?.start(); document.documentElement.classList.remove('modal-open'); sound.duck(false); engine.stop() }
  }, [])

  useLayoutEffect(() => {
    sfx('open')
    if (reduced) return
    const fr = frame.current.getBoundingClientRect()
    gsap.fromTo(back.current, { opacity: 0 }, { opacity: 1, duration: 0.45 })
    if (from) {
      gsap.fromTo(frame.current,
        { x: from.left - fr.left, y: from.top - fr.top, scaleX: from.width / fr.width, scaleY: from.height / fr.height, transformOrigin: '0 0' },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.75, ease: 'expo.inOut', clearProps: 'transform' })
    }
  }, [])

  // side panel slides in whenever the screen content changes
  useLayoutEffect(() => {
    if (reduced) return
    gsap.fromTo(root.current.querySelectorAll('.gm-side > *'), { opacity: 0, x: 24 }, { opacity: 1, x: 0, stagger: 0.04, delay: kind === 'menu' ? 0.45 : 0.05, duration: 0.35 })
    if (kind !== 'menu') gsap.fromTo(scr.current, { filter: 'brightness(3)' }, { filter: 'brightness(1)', duration: 0.4 })
  }, [kind])

  /* game loop */
  useEffect(() => {
    if (!playing) return
    let raf, last = performance.now(), prev = ''
    const g = cv.current.getContext('2d')
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const e = eng.current
      if (e) {
        if (!pausedRef.current) e.step(dt)
        e.draw(g, now / 1000, { cp: t.checkpoint })
        const s = e.s
        const vals = kind === 'maze' ? { score: s.score, a: s.lives, b: s.level }
          : kind === 'racer' ? { score: s.score, a: Math.ceil(s.time), b: Math.round((s.speed / (200 * 60)) * 290) }
            : kind === 'pong' ? { score: s.score, a: s.me + ' : ' + s.cpu, b: 7 }
              : { score: s.score, a: s.lives, b: s.wave }
        const key = vals.score + '|' + vals.a + '|' + vals.b
        if (key !== prev) { prev = key; setHud(vals) }
        if (kind === 'racer') engine.set(s.speed / (200 * 60))
        if (s.over && !overRef.current) {
          overRef.current = true; setOver(true); engine.stop()
          if (s.score > best(kind)) { saveBest(kind, s.score); setHi(s.score) }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [kind])

  /* keyboard */
  useEffect(() => {
    const down = (ev) => {
      const k = kindRef.current
      if (ev.code === 'Escape') { k === 'menu' ? close() : toMenu(); return }
      if (k === 'menu') {
        if (ev.code === 'ArrowDown' || ev.code === 'KeyS') { ev.preventDefault(); setSel((v) => (v + 1) % GAMES.length); sfx('move') }
        if (ev.code === 'ArrowUp' || ev.code === 'KeyW') { ev.preventDefault(); setSel((v) => (v + GAMES.length - 1) % GAMES.length); sfx('move') }
        if (ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); pick(GAMES[selRef.current]) }
        return
      }
      if (ev.code === 'KeyP') { togglePause(); return }
      if ((ev.code === 'Enter' || ev.code === 'Space') && overRef.current) { ev.preventDefault(); start(); return }
      if (ev.code === 'Space' || ev.code === 'KeyX') { ev.preventDefault(); eng.current?.input('fire', true); return }
      const a = KEYS[ev.code]; if (!a) return
      ev.preventDefault(); eng.current?.input(a, true)
    }
    const up = (ev) => {
      if (ev.code === 'Space' || ev.code === 'KeyX') { eng.current?.input('fire', false); return }
      const a = KEYS[ev.code]; if (a) eng.current?.input(a, false)
    }
    addEventListener('keydown', down); addEventListener('keyup', up)
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up) }
  }, [])

  /* pointer on the screen: swipe for the maze, follow for pong and the shooter */
  const sw = useRef(null)
  const local = (e) => { const r = cv.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] }
  const onDown = (e) => { sw.current = { x: e.clientX, y: e.clientY }; if (playing && kind !== 'maze' && kind !== 'racer') { const [x, y] = local(e); eng.current?.pointer?.(y, x) } }
  const onMove = (e) => {
    if (!playing) return
    if (kind === 'pong' || kind === 'shooter') { if (e.pointerType === 'mouse' || sw.current) { const [x, y] = local(e); eng.current?.pointer?.(y, x) } return }
    if (!sw.current || kind !== 'maze') return
    const dx = e.clientX - sw.current.x, dy = e.clientY - sw.current.y
    if (Math.hypot(dx, dy) < 22) return
    eng.current?.input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), true)
    sw.current = { x: e.clientX, y: e.clientY }
  }
  const pad = (a) => ({
    onPointerDown: (e) => { e.preventDefault(); eng.current?.input(a, true) },
    onPointerUp: () => eng.current?.input(a, false),
    onPointerLeave: () => eng.current?.input(a, false),
    onPointerCancel: () => eng.current?.input(a, false),
  })

  const G = t.gameInfo
  const [w, h] = SIZE[playing ? kind : 'racer']
  const hudRows = kind === 'maze' ? [[t.lives, '♥'.repeat(Math.max(0, hud.a))], [t.level, hud.b]]
    : kind === 'racer' ? [[t.time, hud.a, hud.a <= 10], [t.speed, hud.b + ' km/h']]
      : kind === 'pong' ? [[t.match, hud.a], [t.upTo, hud.b]]
        : [[t.lives, '♥'.repeat(Math.max(0, hud.a))], [t.wave, hud.b]]

  return createPortal(
    <div className={'gm gm-' + kind} ref={root} role="dialog" aria-modal="true" aria-label={t.menuTitle}>
      <div className="gm-back" ref={back} onClick={close} />
      <div className="gm-grain" aria-hidden="true" />
      <button className="gm-x" onClick={close} aria-label={t.close}>✕</button>
      <div className="gm-wrap">
        <div className="gm-frame" ref={frame}>
          <div className="gm-screen" ref={scr} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (sw.current = null)}>
            {playing ? <canvas key={kind} ref={cv} width={w} height={h} /> : (
              <div className="gm-tvmenu" style={{ aspectRatio: '16 / 10' }}>
                <p className="mn-top"><span>{t.menuTitle}</span><span className="rec" /></p>
                <ol>
                  {GAMES.map((g, i) => (
                    <li key={g}>
                      <button className={i === sel ? 'on' : ''} onMouseEnter={() => { if (i !== sel) { setSel(i); sfx('move') } }} onClick={() => pick(g)}>
                        <span className="mn-n">0{i + 1}</span>
                        <span className="mn-t">{t.games[g]}</span>
                        <span className="mn-d">{G[g]}</span>
                        <span className="mn-b">{t.best} {String(best(g)).padStart(5, '0')}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="mn-hint">{t.menuHint}</p>
              </div>
            )}
            <div className="gm-fx" aria-hidden="true" />
            {paused && <div className="gm-over"><p className="gm-big">{t.paused}</p><button className="gm-btn" onClick={togglePause}>▶ {t.start}</button></div>}
            {over && (
              <div className="gm-over">
                <p className="gm-big">{kind === 'pong' && eng.current?.s.win ? t.youWin : t.over}</p>
                <p className="gm-res">{t.score}: {hud.score} · {t.best}: {hi}</p>
                <div className="gm-row"><button className="gm-btn" onClick={() => start()}>↻ {t.again}</button><button className="gm-btn ghost" onClick={toMenu}>{t.toMenu}</button></div>
              </div>
            )}
          </div>
          <div className="gm-brand"><span>RUBIN · 1987</span><i /><i /></div>
        </div>
        <aside className="gm-side" key={kind}>
          {playing ? <>
            <p className="gm-kick">{t.arcTitle} · CH 0{GAMES.indexOf(kind) + 1}</p>
            <h3 className="gm-title">{t.games[kind]}</h3>
            <dl className="gm-hud">
              <div><dt>{t.score}</dt><dd>{String(hud.score).padStart(6, '0')}</dd></div>
              <div><dt>{t.best}</dt><dd>{String(hi).padStart(6, '0')}</dd></div>
              {hudRows.map(([k, v, warn]) => <div key={k}><dt>{k}</dt><dd className={warn ? 'warn' : ''}>{v}</dd></div>)}
            </dl>
            <p className="gm-help">{t.help[kind]}</p>
            <div className="gm-row">
              <button className="gm-btn ghost" onClick={togglePause}>{paused ? '▶' : '❚❚'} {t.pause}</button>
              <button className="gm-btn ghost" onClick={toMenu}>← {t.toMenu}</button>
            </div>
            <p className="gm-esc">{t.escHint}</p>
          </> : <>
            <p className="gm-kick">{t.arcTitle}</p>
            <h3 className="gm-title">{t.games[GAMES[sel]]}</h3>
            <p className="gm-help">{t.help[GAMES[sel]]}</p>
            <button className="gm-btn" onClick={() => pick(GAMES[sel])}>▶ {t.tvPlay}</button>
            <p className="gm-esc">{t.menuHint}</p>
          </>}
        </aside>
      </div>
      {playing && (
        <div className="gm-pad" aria-hidden="true">
          <div className="gm-dpad">
            <button className="u" {...pad('up')} /><button className="l" {...pad('left')} /><button className="r" {...pad('right')} /><button className="d" {...pad('down')} />
          </div>
          {kind === 'racer' && <p className="gm-padnote">{t.touchGas}: auto · ↓ {t.touchBrake}</p>}
          {(kind === 'shooter' || kind === 'pong') && <p className="gm-padnote">{t.touchDrag}</p>}
        </div>
      )}
    </div>,
    document.body,
  )
}
