import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import Scene from './Scene.jsx'
import Room from './arcade/Room.jsx'
import Work from './Work.jsx'
import Loader from './Loader.jsx'
import Cursor from './Cursor.jsx'
import { world } from './world.js'
import { T, STACK } from './content.js'
import { paintCover } from './pixels.js'
import { sound, sfx } from './audio.js'
import { drawStatic } from './arcade/demos.js'

gsap.registerPlugin(ScrollTrigger)
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const bell = (x, c, w = 0.12) => Math.max(0, 1 - Math.abs(x - c) / w)
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* 8-bit text scramble when it enters the screen, and again on hover */
const GLYPHS = '█▓▒░#@$%&*01<>/'
function Scramble({ text, as: Tag = 'span', className }) {
  const ref = useRef(), runRef = useRef(() => {})
  useEffect(() => {
    const el = ref.current; if (!el) return
    if (reduced) { el.textContent = text; return }
    let raf, done = false, busy = false
    const run = () => {
      if (busy) return
      busy = true
      const start = performance.now(), dur = 700 + text.length * 18
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur)
        el.textContent = [...text].map((ch, i) => ch === ' ' || i / text.length < p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('')
        if (p < 1) raf = requestAnimationFrame(tick); else busy = false
      }
      raf = requestAnimationFrame(tick)
    }
    runRef.current = run
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !done) { done = true; run() } }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [text])
  return <Tag ref={ref} className={className} aria-label={text} onMouseEnter={() => runRef.current()}>{text}</Tag>
}

/* pixel-block transition strip between day and night */
function PixelEdge({ flip }) {
  const cols = 24, rows = 5
  const cells = useMemo(() => Array.from({ length: cols * rows }, (_, i) => i), [])
  return (
    <div className={'pxedge' + (flip ? ' flip' : '')} aria-hidden="true" style={{ '--cols': cols }}>
      {cells.map((i) => <i key={i} data-row={Math.floor(i / cols)} />)}
    </div>
  )
}

function Cube({ c = ['#528A9A', '#D9E7E8'] }) {
  return (
    <svg viewBox="0 0 40 40" className="cube" aria-hidden="true">
      <path d="M20 4l15 8-15 8-15-8z" fill={c[1]} /><path d="M5 12l15 8v16L5 28z" fill={c[0]} /><path d="M35 12l-15 8v16l15-8z" fill={c[0]} opacity=".7" />
    </svg>
  )
}

function SoundBtn({ t }) {
  const [on, setOn] = useState(sound.on)
  useEffect(() => sound.sub(setOn), [])
  return (
    <button className={'snd' + (on ? ' on' : '')} onClick={() => sound.toggle()} aria-label={on ? t.soundOn : t.soundOffL} title={on ? t.soundOn : t.soundOffL} aria-pressed={on}>
      <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path d="M1 6h3l4-4v12l-4-4H1z" fill="currentColor" /></svg>
      <span className="eq" aria-hidden="true"><i /><i /><i /></span>
    </button>
  )
}

const EMAIL = 'Dargumies@gmail.com'
const getMode = () => { try { return localStorage.getItem('dg-mode') || 'light' } catch { return 'light' } }
const getLang = () => { try { return localStorage.getItem('dg-lang') || 'ru' } catch { return 'ru' } }

export default function App() {
  const [lang, setLang] = useState(getLang)
  const [mode, setMode] = useState(getMode)
  const [loading, setLoading] = useState(true)
  const [entered, setEntered] = useState(false)
  const modeRef = useRef(mode); modeRef.current = mode
  useEffect(() => { document.documentElement.dataset.mode = mode; try { localStorage.setItem('dg-mode', mode) } catch {} }, [mode])
  const t = T[lang]
  const [mined, setMined] = useState(0)
  const [active, setActive] = useState(0)
  const [form, setForm] = useState({ name: '', contact: '', type: '', msg: '' })
  const [sent, setSent] = useState(null)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [navv, setNavv] = useState('')
  const covers = useMemo(() => T.ru.projects.map((_, i) => paintCover(i)), [])
  const root = useRef(), staticCv = useRef()

  useEffect(() => { document.documentElement.lang = lang; try { localStorage.setItem('dg-lang', lang) } catch {} ; ScrollTrigger.refresh() }, [lang])

  /* smooth scroll + world state driven by scroll */
  useEffect(() => {
    const lenis = reduced ? null : new Lenis({ lerp: 0.1 })
    world.lenis = lenis
    if (lenis) { lenis.on('scroll', ScrollTrigger.update); if (!world.entered) lenis.stop() }
    const onAnchor = (e) => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return
      const el = document.querySelector(a.getAttribute('href')); if (!el) return
      e.preventDefault(); lenis ? lenis.scrollTo(el, { offset: -60 }) : el.scrollIntoView()
    }
    document.addEventListener('click', onAnchor)

    // cache the things we read every frame
    const q = {}
    const cache = () => {
      q.night = [...document.querySelectorAll('[data-night]')]
      q.pix = [...document.querySelectorAll('[data-pix]')]
      q.zones = [...document.querySelectorAll('section[data-zone]')]
      q.svc = document.getElementById('services')
      q.arc = document.getElementById('arcade')
      q.arcIn = q.arc?.querySelector('.arc-in')
      q.work = document.getElementById('work')
      q.hero = document.querySelector('.hero h1')
      q.letters = [...document.querySelectorAll('.hero h1 .mg')]
    }
    cache()
    let dirty = false
    const mo = new MutationObserver(() => { dirty = true })
    mo.observe(document.getElementById('top'), { childList: true, subtree: true })

    // pointer for the magnetic hero letters
    const ptr = { x: -9999, y: -9999 }
    const onPtr = (e) => { ptr.x = e.clientX; ptr.y = e.clientY }
    addEventListener('pointermove', onPtr, { passive: true })
    const lp = new Map()

    let lastActive = -1, lastNav = null, lastZone = null, offFired = false, frame = 0
    const rs = document.documentElement.style
    const tick = (time) => {
      if (lenis) lenis.raf(time * 1000)
      frame++
      if (dirty && frame % 10 === 0) { dirty = false; cache() }
      const vh = innerHeight
      const pres = (list) => { let m = 0; list.forEach((el) => { const r = el.getBoundingClientRect(); m = Math.max(m, Math.min(ss(0.85, 0.3, r.top / vh), ss(0.3, 0.75, r.bottom / vh))) }); return m }
      let night = pres(q.night), pix = pres(q.pix)
      if (modeRef.current === 'dark') night = 1

      // ---- arcade: an old-film iris closes to black, the world swaps in the dark, the iris opens ----
      let voidA = 0, iris = 1
      if (q.arc) {
        const ar = q.arc.getBoundingClientRect()
        const a = ar.top / vh, b = ar.bottom / vh
        const close = (x) => (x > 0.5 ? 1 - ss(1.0, 0.56, x) : ss(0.44, 0.02, x)) // 1 open → 0 shut at x=.5 → 1 open
        // only on the way in; on the way out the torn paper edge does the job
        iris = a > -0.2 && a < 1.2 ? close(a) : 1
        voidA = ar.top < vh * 0.5 && ar.bottom > 0 ? 1 : 0
      }
      const R = Math.hypot(innerWidth, vh) * 0.56
      const jit = iris < 0.999 ? Math.sin(time * 31) * 3 : 0
      world.arc = voidA
      world.night = night; world.pix = pix; world.soft = (1 - pix) * (1 - voidA)
      rs.setProperty('--night', night.toFixed(3)); rs.setProperty('--nbg', night.toFixed(3))
      rs.setProperty('--arc-void', String(voidA))
      rs.setProperty('--iris', (iris * iris * R + (iris > 0 ? 0 : -40)).toFixed(1) + 'px')
      rs.setProperty('--iris-on', iris < 0.999 ? '1' : '0')
      rs.setProperty('--iris-x', (50 + jit * 0.08).toFixed(2) + '%'); rs.setProperty('--iris-y', (50 + jit * 0.05).toFixed(2) + '%')
      const stat = iris < 0.999 ? 1 - iris : 0
      rs.setProperty('--arc-static', stat.toFixed(3))
      if (stat > 0.02 && staticCv.current && frame % 3 === 0) drawStatic(staticCv.current.getContext('2d'))

      // ---- zone: which world is in the middle of the screen ----
      let zone = 'snow'
      for (const el of q.zones) { const r = el.getBoundingClientRect(); if (r.top <= vh * 0.5 && r.bottom >= vh * 0.5) { zone = el.dataset.zone; break } }
      if (zone !== lastZone) {
        document.documentElement.dataset.zone = zone; world.zone = zone
        sound.theme(zone === 'arcade' ? 'noir' : zone === 'paper' ? 'paper' : 'frost', zone === 'night')
        if (lastZone && world.entered) {
          if (zone === 'arcade') sfx('projector')
          else if (zone === 'paper') sfx('tape')
          else if (lastZone === 'arcade' || lastZone === 'paper') sfx('chime')
          else if (zone === 'night') sfx('night')
        }
        lastZone = zone
      }
      const nv = zone === 'arcade' ? 'dark noir' : zone === 'paper' ? 'paper' : night > 0.5 ? 'dark' : ''
      if (nv !== lastNav) { lastNav = nv; setNavv(nv) }

      // ---- hero letters shy away from the cursor ----
      if (q.hero && q.letters.length) {
        const hr = q.hero.getBoundingClientRect()
        if (hr.bottom > 0 && hr.top < vh) {
          for (const el of q.letters) {
            const cx = hr.left + el.offsetLeft + el.offsetWidth / 2, cy = hr.top + el.offsetTop + el.offsetHeight / 2
            const dx = cx - ptr.x, dy = cy - ptr.y, d = Math.hypot(dx, dy) || 1
            const f = reduced ? 0 : Math.max(0, 1 - d / 260)
            const s = lp.get(el) || { x: 0, y: 0, h: 0 }
            s.x += ((dx / d) * f * f * 70 - s.x) * 0.14; s.y += ((dy / d) * f * f * 50 - s.y) * 0.14; s.h += (f - s.h) * 0.12
            lp.set(el, s)
            el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) rotate(${(s.x * 0.25).toFixed(1)}deg)`
            el.style.setProperty('--h', s.h.toFixed(2))
          }
        }
      }

      // ---- particle forms follow the services scroller ----
      const svc = q.svc
      if (svc) {
        const r = svc.getBoundingClientRect()
        const n = 6
        if (r.top > 0) { world.A = 0; world.B = 1; world.mix = ss(0.9, 0.15, r.top / vh) }
        else if (r.bottom < vh) { world.A = 6; world.B = 0; world.mix = ss(1, 0.35, r.bottom / vh) }
        else {
          const sp = Math.min(0.9999, Math.max(0, -r.top / (r.height - vh)))
          const x = sp * n, i = Math.floor(x), f = x - i
          world.A = i + 1; world.B = Math.min(i + 2, n); world.mix = i + 1 === n ? 0 : ss(0.7, 1, f)
          const act = i + (f > 0.85 && i < n - 1 ? 1 : 0)
          if (act !== lastActive) { lastActive = act; setActive(act) }
        }
      }
    }
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(tick); lenis?.destroy(); document.removeEventListener('click', onAnchor); removeEventListener('pointermove', onPtr); mo.disconnect() }
  }, [])

  /* the loader lets people in */
  const enter = () => {
    world.entered = true; setEntered(true)
    scrollTo(0, 0); world.lenis?.start()
    document.documentElement.classList.remove('loading')
    setTimeout(() => ScrollTrigger.refresh(), 120)
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
  }
  useEffect(() => { document.documentElement.classList.add('loading') }, [])
  useLayoutEffect(() => {
    if (!entered || reduced) return
    const tl = gsap.timeline({ delay: 0.35 })
    tl.fromTo('.hero h1 > span', { yPercent: 60, rotate: (i) => (i ? 4 : -4), opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 1, ease: 'back.out(1.6)', stagger: 0.12, clearProps: 'transform,opacity' })
      .fromTo('.hello, .hero-bot > *', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' }, '-=0.7')
      .fromTo('.nav', { yPercent: -100 }, { yPercent: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform' }, 0)
  }, [entered])

  /* scroll-scrubbed animations */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.manifesto .w', { '--f': 0 }, { '--f': 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top 75%', end: 'bottom 45%', scrub: true } })
      document.querySelectorAll('.pxedge').forEach((edge) => {
        const flip = edge.classList.contains('flip')
        const cells = edge.querySelectorAll('i')
        const tl = gsap.timeline({ scrollTrigger: { trigger: edge, start: flip ? 'top 80%' : 'top bottom', end: flip ? 'bottom 25%' : 'bottom 40%', scrub: true } })
        cells.forEach((c) => {
          const row = +c.dataset.row, depth = flip ? row : 4 - row
          tl.fromTo(c, { scale: flip ? 1 : 0 }, { scale: flip ? 0 : 1, duration: 0.3, ease: 'none' }, depth * 0.12 + Math.random() * 0.35)
        })
      })
      gsap.utils.toArray('.mrow').forEach((row, i) => {
        const dir = i % 2 ? 1 : -1
        gsap.fromTo(row, { xPercent: dir < 0 ? 5 : -35 }, { xPercent: dir < 0 ? -35 : 5, ease: 'none', scrollTrigger: { trigger: '#stack', start: 'top bottom', end: 'bottom top', scrub: true } })
      })
      const steps = gsap.utils.toArray('.lvl')
      gsap.fromTo('.path-fill', { scaleX: 0 }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: {
          trigger: '#process', start: 'top 70%', end: 'bottom 70%', scrub: true,
          onUpdate: (s) => steps.forEach((el, i) => el.classList.toggle('on', s.progress >= i / steps.length + 0.02)),
        },
      })
      gsap.utils.toArray('.rise').forEach((el) => gsap.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }))
      // the intertitle burns in like an old film card
      gsap.fromTo('.it-title span', { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.5, stagger: { each: 0.09, from: 'random' }, ease: 'power2.out', clearProps: 'filter', scrollTrigger: { trigger: '.intertitle', start: 'top 75%' } })
    }, root)
    return () => ctx.revert()
  }, [lang])

  const svc = t.services[active]
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.contact.trim()) return setSent({ err: true })
    const f = { name: form.name.trim(), contact: form.contact.trim(), type: form.type || t.services[0].t, msg: form.msg.trim() }
    const text = t.msg(f)
    setSending(true); setCopied(false)
    try {
      const res = await fetch('https://formsubmit.co/ajax/' + EMAIL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: 'Новая заявка с сайта Dargumies', _template: 'table', _captcha: 'false', Имя: f.name, Контакт: f.contact, Услуга: f.type, Сообщение: f.msg || '—' }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || String(j.success) !== 'true') throw new Error('fail')
      setSent({ ok: true }); sfx('level')
    } catch { setSent({ text, fail: true }) }
    setSending(false)
  }
  const copy = async () => { try { await navigator.clipboard.writeText(sent.text); setCopied(true) } catch { setCopied(false) } }

  return (
    <div ref={root}>
      {loading && <Loader t={t} onEnter={enter} onDone={() => setLoading(false)} />}
      <Cursor />
      <div className="sky" aria-hidden="true">
        <div className="night"><div className="aurora a1" /><div className="aurora a2" /><div className="aurora a3" /></div>
        <div className="arcfx"><div className="ascreen" /></div>
      </div>
      <Scene onMine={() => setMined((m) => m + 1)} />
      <div className="iris" aria-hidden="true" />
      <canvas className="static" ref={staticCv} width="160" height="90" aria-hidden="true" />

      <header className={'nav ' + navv}>
        <a href="#top" className="logo"><Cube /><span>dargumies</span></a>
        <nav className="links">
          {['#services', '#stack', '#arcade', '#work', '#boosty'].map((h, i) => <a key={h} href={h} className="hide-s">{t.nav[i]}</a>)}
          <SoundBtn t={t} />
          <button className="mode" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} aria-label={mode === 'dark' ? t.toLight : t.toDark} title={mode === 'dark' ? t.toLight : t.toDark}>
            <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">{mode === 'dark'
              ? <path d="M7 0h2v3H7zM7 13h2v3H7zM0 7h3v2H0zM13 7h3v2h-3zM2 2h2v2H2zM12 2h2v2h-2zM2 12h2v2H2zM12 12h2v2h-2zM5 4h6v1h1v6h-1v1H5v-1H4V5h1z" fill="currentColor" />
              : <path d="M6 1h4v1H8v1H7v2H6v6h1v1h1v1h2v1H6v-1H4v-1H3v-1H2V6h1V4h1V3h1V2h1z" fill="currentColor" />}</svg>
          </button>
          <button className="lang" onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')} aria-label="Language">
            <span className={lang === 'ru' ? 'on' : ''}>RU</span>/<span className={lang === 'en' ? 'on' : ''}>EN</span>
          </button>
          <a href="#contact" className="pill">{t.cta}</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-top">
            <p className="hello"><span className="badge">{t.open}</span>{t.hello}</p>
            <h1 aria-label="DARGUMIES">
              <span className="fill">{[...'DARGU'].map((c, i) => <span key={i} className="mg">{c}</span>)}</span>
              <span className="outline">{[...'MIES'].map((c, i) => <span key={i} className="mg">{c}</span>)}</span>
            </h1>
          </div>
          <div className="hero-hole" data-island aria-hidden="true" />
          <div className="hero-bot">
            <p className="lead">{t.lead}</p>
            <div className="ctas"><a href="#contact" className="btn">{t.talk}</a><a href="#work" className="btn ghost">{t.see}</a></div>
            <div className="mine-row">
              <p className="mine" aria-live="polite">{mined === 0 ? t.mine0 : mined < 25 ? t.mineN(mined) : t.mineX(mined)}</p>
              {mined > 0 && <button className="restore" onClick={() => { world.restore++; setMined(0); sfx('restore') }}>{t.restore}</button>}
            </div>
          </div>
        </section>

        <section className="manifesto band">
          <p className="wrap">{t.manifesto.split(' ').map((w, i) => <span key={lang + i} className="w">{w} </span>)}</p>
        </section>

        <section id="services" data-pix style={{ height: `${t.services.length * 85 + 40}svh` }}>
          <div className="sticky">
            <div className="svc-panel">
              <div className="svc-head">
                <h2><Scramble text={t.svcTitle} /></h2>
                <div className="bar" aria-hidden="true">{t.services.map((_, i) => <i key={i} className={i <= active ? 'on' : ''} />)}</div>
              </div>
              <div className="svc-body" key={lang + active}>
                <span className="count">{active + 1} / {t.services.length}</span>
                <h3>{svc.t}</h3>
                <p className="sub">{svc.s}</p>
                <p className="d">{svc.d}</p>
                <ul className="pts">{svc.p.map((q) => <li key={q}>{q}</li>)}</ul>
                <div className="tags">{svc.k.map((q) => <span key={q}>{q}</span>)}</div>
              </div>
              <ol className="svc-list">
                {t.services.map((x, i) => <li key={x.t} className={i === active ? 'on' : ''}>{x.t}</li>)}
              </ol>
              <p className="hint">{t.scrollHint}</p>
            </div>
          </div>
        </section>

        <section id="stack" className="night-sec" data-night data-pix data-zone="night">
          <PixelEdge />
          <div className="band wrap stack-head">
            <h2 className="rise"><Scramble text={t.stackTitle} /></h2>
            <p>{t.stackSub}</p>
          </div>
          <div className="marquee">
            {STACK.map((row, i) => (
              <div className="mrow" key={i}>
                {[...row, ...row].map((s, j) => <span key={j} className={(j + i) % 3 === 1 ? 'o' : (j + i) % 3 === 2 ? 'a' : ''}>{s}<b aria-hidden="true">✦</b></span>)}
              </div>
            ))}
          </div>
          <PixelEdge flip />
        </section>

        <Room t={t} lang={lang} />

        <Work t={t} covers={covers} lang={lang} />

        <section id="process" className="band">
          <div className="wrap">
            <div className="head"><h2 className="rise"><Scramble text={t.procTitle} /></h2><p>{t.procSub}</p></div>
            <div className="levels">
              <div className="path" aria-hidden="true"><div className="path-fill" /></div>
              {t.steps.map(([h, d], i) => (
                <div key={h} className="lvl">
                  <span className="node" aria-hidden="true" />
                  <span className="lv">{t.lvl} {i + 1}</span>
                  <h3>{h}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="boosty" className="band">
          <div className="wrap">
            <div className="head">
              <h2 className="rise"><Scramble text={t.boostyTitle} /></h2>
              <p>{t.boostySub}</p>
            </div>
            <div className="tiers">
              {t.tiers.map((x, i) => (
                <article key={x.n} className={'tier' + (i === 1 ? ' hot' : '')}>
                  <div className="tier-ico" aria-hidden="true">{[...Array(i + 1)].map((_, k) => <i key={k} />)}</div>
                  <h3>{x.n}</h3>
                  <p className="price">{x.p}</p>
                  <ul>{x.f.map((q) => <li key={q}>{q}</li>)}</ul>
                  <a className="btn" href="https://boosty.to/dargumies">{t.boostyBtn}</a>
                </article>
              ))}
            </div>
            <p className="note">{t.boostyNote}</p>
          </div>
        </section>

        <section id="contact" className="night-sec contact-sec" data-night data-zone="night">
          <PixelEdge />
          <div className="contact">
            <div className="c-hole" data-island aria-hidden="true" />
            <div className="c-panel">
              <h2><Scramble text={t.cTitle} /></h2>
              <p className="sub">{t.cSub}</p>
              {sent?.ok ? (
                <div className="ready ok"><p>{t.sentOk}</p><button className="btn ghost" onClick={() => { setSent(null); setForm({ name: '', contact: '', type: '', msg: '' }) }}>{t.edit}</button></div>
              ) : sent?.text ? (
                <div className="ready">
                  <p>{t.sendFail}</p>
                  <pre>{sent.text}</pre>
                  <p className="mailto">{EMAIL}</p>
                  <div className="ctas">
                    <a className="btn" href={`mailto:${EMAIL}?subject=${encodeURIComponent('Заявка с сайта')}&body=${encodeURIComponent(sent.text)}`}>{t.mailBtn}</a>
                    <button className="btn ghost" onClick={copy}>{copied ? t.copied : t.copy}</button>
                    <button className="btn ghost" onClick={() => setSent(null)}>{t.edit}</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <label>{t.fName}<input id="f-name" value={form.name} onChange={set('name')} onKeyDown={() => sfx('tick')} autoComplete="name" /></label>
                  <label>{t.fContact}<input id="f-contact" value={form.contact} onChange={set('contact')} onKeyDown={() => sfx('tick')} /></label>
                  <label>{t.fType}
                    <select id="f-type" value={form.type || t.services[0].t} onChange={set('type')}>
                      {t.services.map((x) => <option key={x.t}>{x.t}</option>)}<option>{t.fOther}</option>
                    </select>
                  </label>
                  <label>{t.fMsg}<textarea id="f-msg" rows="4" value={form.msg} onChange={set('msg')} onKeyDown={() => sfx('tick')} /></label>
                  {sent?.err && <p className="err" role="alert">{t.fErr}</p>}
                  <button className="btn" type="submit" disabled={sending}>{sending ? t.sending : t.fBtn}</button>
                </form>
              )}
              <ul className="socials">
                <li><span>Telegram</span><a href="https://t.me/dargumies">@dargumies</a></li>
                <li><span>Discord</span><b>dargumies</b></li>
                <li><span>GitHub</span><a href="https://github.com/dargumies">github.com/dargumies</a></li>
              </ul>
              <p className="note">{t.stub}</p>
            </div>
          </div>
          <footer className="foot"><span>© 2026 Dargumies</span><span>{t.made}</span></footer>
        </section>
      </main>
    </div>
  )
}
