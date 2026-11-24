import { useEffect, useRef } from 'react'

/* A cursor that changes its look per section: frost pixel, neon crosshair, ink blot.
   Elements can set data-cursor="label" to show a small caption next to it. */
const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches
const HOVER = 'a,button,select,input,textarea,label,[role=tab],[data-cursor],.tv'

export default function Cursor() {
  const dot = useRef(), ring = useRef(), label = useRef()
  useEffect(() => {
    if (!fine) return
    document.documentElement.classList.add('has-cur')
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf, shown = false, lastLabel = ''
    const move = (e) => {
      if (!ring.current) return
      x = e.clientX; y = e.clientY
      if (!shown) { shown = true; rx = x; ry = y; ring.current.parentNode.classList.add('show') }
      const el = e.target.closest?.(HOVER)
      const root = ring.current.parentNode
      root.classList.toggle('hov', !!el)
      root.classList.toggle('grab', !!e.target.closest?.('[data-drag]'))
      const l = el?.closest('[data-cursor]')?.dataset.cursor || ''
      if (l !== lastLabel) { lastLabel = l; label.current.textContent = l; root.classList.toggle('lab', !!l) }
    }
    const down = () => ring.current.parentNode.classList.add('down')
    const up = () => ring.current.parentNode.classList.remove('down')
    const leave = () => { shown = false; ring.current.parentNode.classList.remove('show') }
    const loop = () => {
      if (!dot.current || !ring.current || !label.current) return
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2
      dot.current.style.transform = `translate3d(${x}px,${y}px,0)`
      ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`
      label.current.style.transform = `translate3d(${rx + 22}px,${ry + 18}px,0)`
      raf = requestAnimationFrame(loop)
    }
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerdown', down); addEventListener('pointerup', up)
    document.addEventListener('mouseleave', leave)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', move); removeEventListener('pointerdown', down); removeEventListener('pointerup', up)
      document.removeEventListener('mouseleave', leave)
      document.documentElement.classList.remove('has-cur')
    }
  }, [])
  if (!fine) return null
  return (
    <div className="cur" aria-hidden="true">
      <div className="cur-ring" ref={ring}><i /></div>
      <div className="cur-dot" ref={dot}><i /></div>
      <div className="cur-label" ref={label} />
    </div>
  )
}
