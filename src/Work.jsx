import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { sfx } from './audio.js'

gsap.registerPlugin(ScrollTrigger)
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const BUR = '#3E0202', CREAM = '#ECE9D3'

/* ---------- torn paper edge ---------- */
function tornPath(seed, w = 1200, h = 80, flip = false) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  let d = flip ? `M0 0 L0 ${h * 0.4}` : `M0 ${h} L0 ${h * 0.55}`
  for (let x = 0; x <= w; x += 14 + r() * 26) {
    const y = flip ? h * 0.25 + r() * h * 0.55 : h * 0.15 + r() * h * 0.6
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
  }
  d += flip ? ` L${w} ${h * 0.4} L${w} 0 Z` : ` L${w} ${h * 0.5} L${w} ${h} Z`
  return d
}
function Tear({ flip, layers }) {
  return (
    <div className={'tear' + (flip ? ' bot' : ' top')} aria-hidden="true">
      {layers.map(([seed, col], i) => (
        <svg key={i} className={'tl tl' + i} viewBox="0 0 1200 80" preserveAspectRatio="none"><path d={tornPath(seed, 1200, 80, flip)} fill={col} /></svg>
      ))}
    </div>
  )
}

/* ---------- draggable things ---------- */
const Cassette = ({ c = CREAM, label = 'MIX 01', ink = BUR }) => (
  <svg viewBox="0 0 160 100" className="toy-svg">
    <rect x="2" y="2" width="156" height="96" rx="8" fill={c} stroke={ink} strokeWidth="3" />
    <rect x="16" y="12" width="128" height="40" rx="4" fill="#fffdf2" stroke={ink} strokeWidth="2" />
    <text x="24" y="30" fontFamily="Marck Script, cursive" fontSize="17" fill={ink}>{label}</text>
    <line x1="24" y1="40" x2="134" y2="40" stroke={ink} strokeWidth="1" opacity=".5" />
    <rect x="40" y="58" width="80" height="24" rx="12" fill={ink} />
    <circle cx="56" cy="70" r="8" fill="#fffdf2" /><circle cx="104" cy="70" r="8" fill="#fffdf2" />
    <g className="reel"><path d="M56 63v14M49 70h14" stroke={ink} strokeWidth="2" /></g>
    <g className="reel"><path d="M104 63v14M97 70h14" stroke={ink} strokeWidth="2" /></g>
    <path d="M30 98l8-12h84l8 12" fill="none" stroke={ink} strokeWidth="2.5" />
  </svg>
)
const Floppy = () => (
  <svg viewBox="0 0 100 100" className="toy-svg">
    <path d="M4 4h80l12 12v80H4z" fill="#1d1d1f" />
    <rect x="22" y="4" width="50" height="30" fill="#c9c9c9" /><rect x="56" y="9" width="10" height="20" fill="#1d1d1f" />
    <rect x="16" y="50" width="68" height="46" fill={CREAM} />
    <text x="22" y="72" fontFamily="Marck Script, cursive" fontSize="14" fill={BUR}>backup</text>
    <text x="22" y="88" fontFamily="Oswald, sans-serif" fontSize="9" fill={BUR}>1.44 MB</text>
  </svg>
)
const Star = ({ c = BUR }) => (
  <svg viewBox="0 0 100 100" className="toy-svg"><path d="M50 4l12 30 32 2-25 20 9 31-28-18-28 18 9-31L6 36l32-2z" fill={c} stroke={CREAM} strokeWidth="3" /></svg>
)
const Stamp = ({ text }) => (
  <svg viewBox="0 0 170 80" className="toy-svg">
    <rect x="4" y="4" width="162" height="72" rx="6" fill="none" stroke="#9c1c1c" strokeWidth="4" />
    <rect x="11" y="11" width="148" height="58" rx="3" fill="none" stroke="#9c1c1c" strokeWidth="2" />
    <text x="85" y="50" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="28" letterSpacing="3" fill="#9c1c1c">{text}</text>
  </svg>
)
const Clip = () => (
  <svg viewBox="0 0 40 100" className="toy-svg"><path d="M28 30V82a10 10 0 01-20 0V18a8 8 0 0116 0v58a4 4 0 01-8 0V30" fill="none" stroke="#8a8a8a" strokeWidth="4" strokeLinecap="round" /></svg>
)
const Ticket = () => (
  <svg viewBox="0 0 150 70" className="toy-svg">
    <path d="M4 4h142v20a11 11 0 000 22v20H4V46a11 11 0 000-22z" fill="#d9b44a" stroke={BUR} strokeWidth="2" />
    <line x1="108" y1="8" x2="108" y2="62" stroke={BUR} strokeDasharray="4 4" />
    <text x="16" y="32" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="18" fill={BUR}>ADMIT ONE</text>
    <text x="16" y="52" fontFamily="Marck Script, cursive" fontSize="15" fill={BUR}>retro show</text>
    <text x="116" y="40" fontFamily="Oswald, sans-serif" fontSize="12" fill={BUR}>№042</text>
  </svg>
)

function Toys({ host, cover, t, mobile }) {
  const items = useMemo(() => {
    const all = [
      { k: 'cas1', x: 0.74, y: 0.035, r: 8, w: 170, el: <Cassette label="MIX 01" /> },
      { k: 'pol', x: 0.86, y: 0.2, r: -7, w: 150, el: <div className="polaroid"><img src={cover} alt="" /><span>{t.workScript}!</span></div> },
      { k: 'star', x: 0.035, y: 0.07, r: -12, w: 74, el: <Star /> },
      { k: 'clip', x: 0.5, y: 0.02, r: 20, w: 26, el: <Clip /> },
      { k: 'cas2', x: 0.01, y: 0.48, r: -16, w: 160, el: <Cassette c={BUR} ink={CREAM} label="DEMO" /> },
      { k: 'tick', x: 0.88, y: 0.56, r: 9, w: 150, el: <Ticket /> },
      { k: 'flop', x: 0.9, y: 0.86, r: 12, w: 96, el: <Floppy /> },
      { k: 'stamp', x: 0.03, y: 0.88, r: -9, w: 160, el: <Stamp text={t.lang === 'en' ? 'APPROVED' : 'ОДОБРЕНО'} /> },
      { k: 'star2', x: 0.62, y: 0.93, r: 14, w: 52, el: <Star c="#9c1c1c" /> },
    ]
    return mobile ? all.filter((i) => ['cas1', 'star', 'pol', 'stamp', 'flop'].includes(i.k)).map((i) => ({ ...i, w: i.w * 0.66 })) : all
  }, [cover, t.lang, t.workScript, mobile])
  const refs = useRef([]), st = useRef([]), loopOn = useRef(false), raf = useRef(0), top = useRef(10)

  const apply = (s) => { s.el.style.transform = `translate3d(${s.x}px,${s.y}px,0) rotate(${s.r}deg) scale(${s.drag ? 1.07 : 1})` }
  const bounds = () => ({ w: host.current?.clientWidth || 1, h: host.current?.clientHeight || 1 })

  const wake = () => {
    if (loopOn.current) return
    loopOn.current = true
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now
      const { w, h } = bounds()
      let moving = false
      for (const s of st.current) {
        if (s.drag) { moving = true; continue }
        const sp = Math.hypot(s.vx, s.vy)
        if (sp < 6 && Math.abs(s.vr) < 0.5) { s.vx = s.vy = s.vr = 0; continue }
        moving = true
        s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt
        const f = Math.pow(0.05, dt) // strong paper friction
        s.vx *= f; s.vy *= f; s.vr *= Math.pow(0.1, dt)
        const mw = w - s.el.offsetWidth, mh = h - s.el.offsetHeight
        if (s.x < 0 || s.x > mw) { if (Math.abs(s.vx) > 260) sfx('bump'); s.x = Math.max(0, Math.min(mw, s.x)); s.vx *= -0.45; s.vr *= -0.6 }
        if (s.y < 0 || s.y > mh) { if (Math.abs(s.vy) > 260) sfx('bump'); s.y = Math.max(0, Math.min(mh, s.y)); s.vy *= -0.45 }
        apply(s)
      }
      if (moving) raf.current = requestAnimationFrame(step)
      else loopOn.current = false
    }
    raf.current = requestAnimationFrame(step)
  }

  useEffect(() => {
    const { w, h } = bounds()
    st.current = items.map((it, i) => {
      const el = refs.current[i]
      const s = { x: Math.min(it.x * w, w - el.offsetWidth), y: Math.min(it.y * h, h - el.offsetHeight), r: it.r, vx: 0, vy: 0, vr: 0, drag: false, el, home: it.r }
      apply(s); return s
    })
    const ro = new ResizeObserver(() => {
      const b = bounds()
      st.current.forEach((s) => { s.x = Math.min(s.x, b.w - s.el.offsetWidth); s.y = Math.min(s.y, b.h - s.el.offsetHeight); apply(s) })
    })
    ro.observe(host.current)
    // fast cursor sweeps nudge the things like a gust of wind
    let px = 0, py = 0, pt = 0
    const wind = (e) => {
      const now = performance.now(), dt = Math.max(1, now - pt)
      const vx = (e.clientX - px) / dt * 1000, vy = (e.clientY - py) / dt * 1000
      px = e.clientX; py = e.clientY; pt = now
      if (e.pointerType !== 'mouse' || Math.hypot(vx, vy) < 900) return
      const r = host.current.getBoundingClientRect()
      for (const s of st.current) {
        if (s.drag) continue
        const cx = r.left + s.x + s.el.offsetWidth / 2, cy = r.top + s.y + s.el.offsetHeight / 2
        if (Math.hypot(e.clientX - cx, e.clientY - cy) < Math.max(s.el.offsetWidth, s.el.offsetHeight) * 0.6) {
          s.vx += vx * 0.22; s.vy += vy * 0.22; s.vr += (vx > 0 ? 1 : -1) * 90; wake()
        }
      }
    }
    host.current.addEventListener('pointermove', wind)
    const hostEl = host.current
    return () => { ro.disconnect(); hostEl.removeEventListener('pointermove', wind); cancelAnimationFrame(raf.current); loopOn.current = false }
  }, [items])

  const down = (i) => (e) => {
    const s = st.current[i]; if (!s) return
    e.preventDefault()
    s.el.setPointerCapture(e.pointerId)
    const r = host.current.getBoundingClientRect()
    s.drag = true; s.ox = e.clientX - r.left - s.x; s.oy = e.clientY - r.top - s.y; s.t = performance.now(); s.vx = s.vy = 0
    s.el.style.zIndex = ++top.current; s.el.classList.add('held')
    apply(s); sfx('pick'); wake()
  }
  const move = (i) => (e) => {
    const s = st.current[i]; if (!s?.drag) return
    const r = host.current.getBoundingClientRect(), now = performance.now(), dt = Math.max(1, now - s.t) / 1000
    const nx = e.clientX - r.left - s.ox, ny = e.clientY - r.top - s.oy
    s.vx = s.vx * 0.5 + ((nx - s.x) / dt) * 0.5; s.vy = s.vy * 0.5 + ((ny - s.y) / dt) * 0.5
    s.r += (nx - s.x) * 0.08; s.r += (s.home - s.r) * 0.05
    s.x = nx; s.y = ny; s.t = now
    apply(s)
  }
  const up = (i) => () => {
    const s = st.current[i]; if (!s?.drag) return
    s.drag = false; s.el.classList.remove('held')
    const sp = Math.hypot(s.vx, s.vy), cap = 1800
    if (sp > cap) { s.vx *= cap / sp; s.vy *= cap / sp }
    s.vr = s.vx * 0.15
    apply(s); sfx('place'); wake()
  }

  return items.map((it, i) => (
    <div key={it.k} ref={(el) => (refs.current[i] = el)} className={'toy toy-' + it.k} style={{ width: it.w }} data-drag data-cursor={t.curDrag}
      onPointerDown={down(i)} onPointerMove={move(i)} onPointerUp={up(i)} onPointerCancel={up(i)}>
      {it.el}
    </div>
  ))
}

const ROT = [-1.6, 2.2, -2.4, 1.4, -1.1]
export default function Work({ t, covers, lang }) {
  const sec = useRef()
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 700px)').matches

  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.p-title .ch', { yPercent: 110, rotate: () => gsap.utils.random(-25, 25) }, { yPercent: 0, rotate: 0, duration: 0.9, ease: 'back.out(1.7)', stagger: 0.05, clearProps: 'transform', scrollTrigger: { trigger: '.p-title', start: 'top 85%' } })
      gsap.fromTo('.p-script', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: 'power2.inOut', delay: 0.4, scrollTrigger: { trigger: '.p-title', start: 'top 85%' } })
      gsap.utils.toArray('.pcard').forEach((c, i) => {
        gsap.fromTo(c, { y: 140, rotate: ROT[i] * 6, scale: 1.08, opacity: 0 }, { y: 0, rotate: ROT[i], scale: 1, opacity: 1, duration: 1, ease: 'back.out(1.4)', clearProps: 'transform,opacity', scrollTrigger: { trigger: c, start: 'top 92%' } })
      })
      // torn layers slide at different speeds for a layered paper feel
      // layers only ever slide towards the paper, so no gap opens at the seam
      gsap.utils.toArray('.tear').forEach((tear) => {
        const bot = tear.classList.contains('bot')
        tear.querySelectorAll('.tl').forEach((l, i) => {
          gsap.fromTo(l, { yPercent: bot ? 0 : (i + 1) * 28 }, { yPercent: bot ? -(i + 1) * 22 : 0, ease: 'none', scrollTrigger: { trigger: tear, start: 'top bottom', end: 'bottom 30%', scrub: true } })
        })
      })
      gsap.to('.ribbon .rb-a', { xPercent: -30, ease: 'none', scrollTrigger: { trigger: '.ribbon', start: 'top bottom', end: 'bottom top', scrub: true } })
      gsap.fromTo('.ribbon .rb-b', { xPercent: -30 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.ribbon', start: 'top bottom', end: 'bottom top', scrub: true } })
    }, sec)
    return () => ctx.revert()
  }, [lang])

  // background word drifts against the cursor
  const onMove = (e) => {
    const r = sec.current.getBoundingClientRect()
    sec.current.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    sec.current.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }
  const words = lang === 'ru' ? ['дизайн', 'код', 'игры', 'боты', 'данные', 'магия'] : ['design', 'code', 'games', 'bots', 'data', 'magic']
  const strip = [...words, ...words, ...words].map((w, i) => <span key={i}>{w}<b>✦</b></span>)

  return (
    <section id="work" className="paper-sec" data-zone="paper" ref={sec} onPointerMove={onMove}>
      <Tear layers={[[7, BUR], [19, '#d8d3b8'], [31, CREAM]]} />
      <div className="p-grain" aria-hidden="true" />
      <p className="p-bgword" aria-hidden="true">{lang === 'ru' ? 'РАБОТЫ' : 'WORKS'}</p>
      <div className="toys"><Toys host={sec} cover={covers[1]} t={{ ...t, lang }} mobile={mobile} /></div>
      <div className="wrap p-in">
        <div className="p-top">
          <span>{t.workKick}</span>
          <span>{lang === 'ru' ? 'портфолио' : 'portfolio'} ✦ 2026</span>
        </div>
        <h2 className="p-title" aria-label={t.workTitle}>
          <span className="p-word">{[...t.workTitle].map((c, i) => <span key={lang + i} className="ch">{c}</span>)}</span>
          <span className="p-script" aria-hidden="true">{t.workScript}</span>
          <span className="p-star" aria-hidden="true">✦</span>
        </h2>
        <div className="p-sub">
          <p>{t.workNote}</p>
          <p className="p-hint" aria-hidden="true"><svg viewBox="0 0 60 30"><path d="M58 4C40 2 20 6 6 24M6 24l2-10M6 24l10-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>{t.dragHint}</p>
        </div>
        <div className="p-grid">
          {t.projects.map((x, i) => (
            <article key={x.n} className={'pcard pc' + i} style={{ '--r': ROT[i] + 'deg' }}>
              <span className="pc-clip" aria-hidden="true"><Clip /></span>
              {i % 2 === 1 && <span className="pc-tape" aria-hidden="true" />}
              <div className="pc-ph"><img src={covers[i]} alt="" loading="lazy" /><span className="pc-dots" /></div>
              <div className="pc-body">
                <span className="pc-n">№ {String(i + 1).padStart(2, '0')} · {t.dims[i]}</span>
                <h3>{x.n}</h3>
                <p className="pc-t">{x.t}</p>
                <p className="pc-d">{x.d}</p>
                <span className="pc-k">{x.k}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="ribbon" aria-hidden="true">
        <div className="rb rb-a">{strip}</div>
        <div className="rb rb-b">{strip}</div>
      </div>
      <Tear flip layers={[[57, BUR], [43, '#d8d3b8'], [71, CREAM]]} />
    </section>
  )
}
