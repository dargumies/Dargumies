import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { sound, sfx } from './audio.js'

const CUBE = [
  '.....tt.....',
  '...tttttt...',
  '.tttttttttt.',
  'lttttttttttr',
  'lllttttttrrr',
  'lllllttrrrrr',
  'llllllrrrrrr',
  'llllllrrrrrr',
  'llllllrrrrrr',
  '.lllllrrrrr.',
  '...lllrrr...',
  '.....lr.....',
]
const COL = { t: '#D9E7E8', l: '#528A9A', r: '#3d6f7d' }
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Loader({ t, onEnter, onDone }) {
  const [p, setP] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const root = useRef(), tiles = useRef()
  const cells = useMemo(() => {
    const out = []
    CUBE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') out.push({ x, y, c: COL[ch], th: 4 + ((y * 7 + x * 13) % 23) * 3.9 + Math.random() * 6 }) }))
    return out
  }, [])
  const ready = p >= 100

  useEffect(() => {
    let fonts = false, loaded = document.readyState === 'complete', raf, v = 0
    const t0 = performance.now()
    document.fonts?.ready.then(() => { fonts = true })
    const onLoad = () => { loaded = true }
    addEventListener('load', onLoad)
    const tick = (now) => {
      const el = now - t0
      const goal = Math.min(100, Math.min(el / (reduced ? 400 : 1700), 1) * 60 + (fonts ? 20 : 0) + (loaded ? 20 : 0))
      v = Math.min(goal, v + Math.max(0.35, (goal - v) * 0.07))
      if (el > 6000) v = 100 // never get stuck on a slow font
      setP(Math.floor(v))
      if (v < 100) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); removeEventListener('load', onLoad) }
  }, [])

  const enter = (withSound) => {
    if (!ready || leaving) return
    if (withSound) { sound.set(true); sfx('enter') } else sound.set(false)
    setLeaving(true)
    onEnter()
  }

  useEffect(() => {
    if (!ready) return
    const k = (e) => { if (e.key === 'Enter') enter(true) }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })

  useEffect(() => {
    if (!leaving) return
    if (reduced) { onDone(); return }
    const tl = gsap.timeline({ onComplete: onDone })
    tl.to(root.current.querySelector('.ld-in'), { scale: 0.92, opacity: 0, duration: 0.35, ease: 'power2.in' })
    tl.set(root.current, { background: 'transparent' })
    tl.to(tiles.current.children, { scale: 0, duration: 0.5, ease: 'power2.in', stagger: { grid: [8, 12], from: 'center', amount: 0.55 } }, '<0.2')
  }, [leaving])

  const logs = t.boot.filter((_, i) => p >= [8, 30, 55, 80, 100][i])
  return (
    <div className="loader" ref={root} role="dialog" aria-label="Loading">
      <div className="ld-tiles" ref={tiles} aria-hidden="true">{Array.from({ length: 96 }, (_, i) => <i key={i} />)}</div>
      <div className="ld-snow" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 0.7) % 6}s`, animationDuration: `${5 + (i % 5)}s` }} />)}</div>
      <div className="ld-in">
        <div className="ld-cube" aria-hidden="true">
          {cells.map((c, i) => <i key={i} className={p >= c.th ? 'on' : ''} style={{ gridColumn: c.x + 1, gridRow: c.y + 1, background: c.c }} />)}
        </div>
        <p className="ld-name">DARGUMIES</p>
        <div className="ld-bar" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i key={i} className={p >= (i + 1) * 5 ? 'on' : ''} />)}</div>
        <p className="ld-pct" aria-live="polite">{String(p).padStart(3, '0')}%</p>
        <ul className="ld-log">{logs.map((l) => <li key={l}>{'> '}{l}</li>)}</ul>
        <div className={'ld-go' + (ready ? ' show' : '')}>
          <button className="ld-enter" onClick={() => enter(true)} disabled={!ready}>▶ {t.enter}</button>
          <button className="ld-mute" onClick={() => enter(false)} disabled={!ready}>{t.enterMute}</button>
          <p className="ld-hint">♪ {t.loadHint}</p>
        </div>
      </div>
    </div>
  )
}
