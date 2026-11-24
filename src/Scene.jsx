import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from './world.js'
import Particles from './Particles.jsx'
import { sfx } from './audio.js'

/* ---------- helpers ---------- */
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
const hash = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v) }
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const easeBack = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }

function pix(seed, draw) {
  const c = document.createElement('canvas'); c.width = c.height = 16
  const g = c.getContext('2d'); const r = rng(seed)
  const fill = (cols, y0 = 0, y1 = 16) => {
    for (let y = y0; y < y1; y++) for (let x = 0; x < 16; x++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, y, 1, 1) }
  }
  draw(g, r, fill)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace
  return t
}

function useMaterials() {
  return useMemo(() => {
    const snow = ['#f4fafb', '#e6f0f2', '#ffffff', '#eef6f7']
    const dirt = ['#6f5444', '#7d604d', '#5f4739', '#866955']
    const top = pix(1, (g, r, f) => f(snow))
    const side = pix(2, (g, r, f) => {
      f(dirt)
      for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3); for (let y = 0; y < h; y++) { g.fillStyle = snow[Math.floor(r() * 4)]; g.fillRect(x, y, 1, 1) } }
    })
    const stone = pix(3, (g, r, f) => f(['#5b6a72', '#4e5b63', '#66767e', '#56646c', '#47535a']))
    const ice = pix(4, (g, r, f) => {
      f(['#9ccbd6', '#a9d4de', '#8fc0cc', '#b5dbe3'])
      g.fillStyle = '#e8f6f9'; for (let i = 0; i < 6; i++) g.fillRect(3 + i, 11 - i, 1, 1); for (let i = 0; i < 3; i++) g.fillRect(10 + i, 6 - i, 1, 1)
    })
    const bark = pix(5, (g, r, f) => { f(['#4f3a2d', '#5b4434', '#45332a']); g.fillStyle = '#3b2c23'; for (let x = 2; x < 16; x += 5) g.fillRect(x, 0, 1, 16) })
    const leaf = pix(6, (g, r, f) => f(['#2f5b57', '#3a6b66', '#264b48', '#335f5a']))
    const leafSnow = pix(7, (g, r, f) => { f(['#2f5b57', '#3a6b66', '#264b48']); f(snow, 0, 5) })
    const m = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, ...extra })
    const sideM = m(side), topM = m(top), stoneM = m(stone)
    return {
      snow: [sideM, sideM, topM, stoneM, sideM, sideM],
      lamp0: null,
      stone: stoneM,
      ice: m(ice, { transparent: true, opacity: 0.82, roughness: 0.2, metalness: 0.1 }),
      bark: m(bark),
      leaf: m(leaf),
      leafSnow: [m(leafSnow), m(leafSnow), topM, m(leaf), m(leafSnow), m(leafSnow)],
      lamp: new THREE.MeshStandardMaterial({ color: '#ffcf8f', emissive: '#ffb257', emissiveIntensity: 2.2 }),
      chip: new THREE.MeshStandardMaterial({ color: '#f4fafb', roughness: 1 }),
      chipIce: new THREE.MeshStandardMaterial({ color: '#a9d4de', roughness: 0.3 }),
    }
  }, [])
}

const box = new THREE.BoxGeometry(1, 1, 1)
const chipGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22)

/* ---------- island data: every block is its own mineable piece ---------- */
function buildIsland() {
  const cols = []
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
    const d = Math.hypot(x, z) + (hash(x, z) - 0.5) * 1.3
    if (d > 4.7) continue
    const pond = Math.hypot(x - 1.4, z + 1.1) < 1.75
    const top = !pond && d < 2.8 && hash(z, x) > 0.62 ? 1 : 0
    cols.push({ x, z, top, pond, depth: 1 + Math.floor((4.9 - d) * 0.85) })
  }
  const blocks = []
  cols.forEach((c) => {
    blocks.push({ p: [c.x, c.top, c.z], k: c.pond ? 'ice' : 'snow' })
    if (c.top === 1) blocks.push({ p: [c.x, 0, c.z], k: 'stone' })
    for (let i = 1; i <= c.depth; i++) blocks.push({ p: [c.x, c.top - i, c.z], k: 'stone', s: i > c.depth - 1 && c.depth > 2 ? 0.9 : 1 })
  })
  const find = (x, z) => cols.find((c) => c.x === x && c.z === z && !c.pond)
  ;[[-2, -1], [1, 3]].map(([x, z]) => find(x, z)).filter(Boolean).forEach((c) => {
    const b = c.top + 1
    for (let y = 0; y < 3; y++) blocks.push({ p: [c.x, b + y, c.z], k: 'bark' })
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z) blocks.push({ p: [c.x + x, b + 1, c.z + z], k: Math.abs(x) + Math.abs(z) === 2 ? 'leafSnow' : 'leaf' })
    ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([x, z]) => blocks.push({ p: [c.x + x, b + 2, c.z + z], k: 'leafSnow' }))
    blocks.push({ p: [c.x, b + 3, c.z], k: 'leafSnow' })
  })
  blocks.forEach((b, i) => { b.id = i; b.delay = (b.p[1] + 7) * 0.09 + hash(b.p[0], b.p[2] + b.p[1]) * 0.25 })
  const lamp = find(0, -2) || find(-1, -2)
  return { blocks, lamp }
}

/* ---------- pieces ---------- */
function useHover(ref, y) {
  const hov = useRef(false)
  useEffect(() => () => { if (hov.current) document.body.style.cursor = '' }, [])
  useFrame((_, dt) => {
    const m = ref.current; if (!m) return
    const ty = y + (hov.current ? 0.14 : 0)
    m.position.y += (ty - m.position.y) * Math.min(1, dt * 14)
  })
  return {
    hov,
    on: {
      onPointerOver: (e) => { e.stopPropagation(); hov.current = true; document.body.style.cursor = 'pointer' },
      onPointerOut: () => { hov.current = false; document.body.style.cursor = '' },
    },
  }
}

function Block({ b, mats, onMine, fresh }) {
  const ref = useRef()
  const [mined, setMined] = useState(false)
  const grow = useRef(fresh ? -b.delay : 1)
  const { hov, on } = useHover(ref, b.p[1])
  useFrame((_, dt) => {
    const m = ref.current; if (!m || grow.current >= 1) return
    grow.current = Math.min(1, grow.current + dt * 2.4)
    m.scale.setScalar(Math.max(0.001, easeBack(Math.max(0, grow.current))) * (b.s || 1))
  })
  if (mined) return null
  return (
    <mesh
      ref={ref} position={b.p} geometry={box} material={mats[b.k]} scale={fresh ? 0.001 : b.s || 1}
      castShadow receiveShadow {...on}
      onClick={(e) => {
        if (e.delta > 6) return
        e.stopPropagation(); hov.current = false; document.body.style.cursor = ''
        setMined(true); onMine(b.p, b.k)
      }}
    />
  )
}

function Lamp({ c, mats, onMine }) {
  const ref = useRef(), light = useRef()
  const [mined, setMined] = useState(false)
  const y = c.top + 0.8
  const { hov, on } = useHover(ref, y)
  useFrame(() => { if (light.current) light.current.intensity = 2 + world.night * 6 })
  if (mined) return null
  return (
    <group ref={ref} position={[c.x, y, c.z]} {...on}
      onClick={(e) => { if (e.delta > 6) return; e.stopPropagation(); hov.current = false; document.body.style.cursor = ''; setMined(true); onMine([c.x, y, c.z], 'lamp') }}>
      <mesh geometry={box} material={mats.bark} scale={[0.18, 0.6, 0.18]} position={[0, -0.05, 0]} />
      <mesh geometry={box} material={mats.lamp} scale={0.34} position={[0, 0.4, 0]} />
      <pointLight ref={light} color="#ffb257" intensity={2} distance={7} decay={1.6} position={[0, 0.5, 0]} />
    </group>
  )
}

const CHIP = { snow: '#f4fafb', ice: '#a9d4de', stone: '#5b6a72', bark: '#5b4434', leaf: '#2f5b57', leafSnow: '#e6f0f2', lamp: '#ffcf8f' }
const chipMats = Object.fromEntries(Object.entries(CHIP).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })]))

function Burst({ at, kind, onDone }) {
  const refs = useRef([])
  const parts = useMemo(() => Array.from({ length: 12 }, () => ({
    v: new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5),
    p: new THREE.Vector3(...at).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)),
    r: Math.random() * 6,
  })), [at])
  const life = useRef(0)
  useFrame((_, dt) => {
    life.current += dt
    parts.forEach((q, i) => {
      q.v.y -= 14 * dt; q.p.addScaledVector(q.v, dt)
      const m = refs.current[i]; if (!m) return
      m.position.copy(q.p); m.rotation.set(q.r + life.current * 5, q.r, 0)
      m.scale.setScalar(Math.max(0.001, 1 - life.current / 0.9))
    })
    if (life.current > 0.9) onDone()
  })
  return parts.map((_, i) => <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={chipGeo} material={chipMats[kind] || chipMats.snow} />)
}

function Island({ onMine, reduced }) {
  const mats = useMaterials()
  const data = useMemo(buildIsland, [])
  const g = useRef()
  const [bursts, setBursts] = useState([])
  const [epoch, setEpoch] = useState(0)
  const mine = (at, kind) => {
    setBursts((b) => [...b, { id: Math.random(), at, kind }])
    onMine(); sfx('mine')
  }

  const inner = useRef()
  const holes = useRef(null)
  useFrame((state, dt) => {
    if (world.restore !== epoch) setEpoch(world.restore)
    if (!holes.current || !holes.current[0]?.isConnected) holes.current = [...document.querySelectorAll('[data-island]')]
    const vh = innerHeight, vw = innerWidth
    const cam = state.camera
    const dist = cam.position.length()
    const H = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), W = H * (vw / vh)
    let best = null, bestVis = 0
    for (const el of holes.current) {
      const r = el.getBoundingClientRect()
      const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.max(1, Math.min(r.height, vh))
      if (vis > bestVis) { bestVis = vis; best = r }
    }
    const v = ss(0.35, 0.8, bestVis)
    const t = state.clock.elapsedTime
    const o = g.current
    const k = Math.min(1, dt * 5)
    let tx = o.position.x, ty = -9, ts = 0.001
    if (best) {
      const cx = Math.min(Math.max(best.left + best.width / 2, 0), vw)
      const cy = Math.min(Math.max(best.top + best.height / 2, -vh * 0.2), vh * 1.2)
      tx = (cx / vw - 0.5) * W
      ty = (0.5 - cy / vh) * H - 0.15 - (1 - v) * 4
      const wW = (best.width / vw) * W, hW = (Math.min(best.height, vh) / vh) * H
      ts = Math.min(0.46, wW / 11.5, hW / 9.5) * (0.6 + 0.4 * v)
    }
    o.position.x += (tx - o.position.x) * k
    o.position.y += (ty + (reduced ? 0 : Math.sin(t * 0.9) * 0.1) - o.position.y) * k
    const s = inner.current.scale.x + (ts - inner.current.scale.x) * k
    inner.current.scale.setScalar(Math.max(0.001, s))
    const ry = (reduced ? 0.6 : t * 0.07) + scrollY * 0.0012 + state.pointer.x * 0.3
    o.rotation.y += (ry - o.rotation.y) * k
    o.rotation.x += (0.5 - state.pointer.y * 0.08 - o.rotation.x) * k
    o.visible = v > 0.02
  })

  return (
    <group ref={g} position={[0, -9, 0]}>
      <group ref={inner} scale={0.001}>
        {data.blocks.map((b) => <Block key={b.id + '-' + epoch} b={b} mats={mats} onMine={mine} fresh={epoch > 0} />)}
        {data.lamp && <Lamp key={'lamp' + epoch} c={data.lamp} mats={mats} onMine={mine} />}
        {bursts.map((b) => <Burst key={b.id} at={b.at} kind={b.kind} onDone={() => setBursts((x) => x.filter((y) => y.id !== b.id))} />)}
      </group>
    </group>
  )
}

/* soft snow, animated entirely on the GPU; flakes part around the cursor */
const snowVert = /* glsl */ `
attribute float aSpd; attribute float aSeed;
uniform float uTime, uProj, uSize; uniform vec2 uMouse, uHalf;
varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y - uTime * aSpd + 8., 16.) - 8.;
  p.x += sin(uTime * .6 + aSeed * 6.283) * .3;
  float k = (14. - p.z) / 14.;
  vec2 d = p.xy - uMouse * uHalf * k;
  float l = length(d);
  p.xy += d / (l + 1e-3) * smoothstep(1.7 * k, 0., l) * .9 * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uProj / -mv.z;
  vA = .65 + .35 * aSeed;
}`
const snowFrag = /* glsl */ `
uniform float uOp; varying float vA;
void main(){
  float r = length(gl_PointCoord - .5) * 2.;
  if (r > 1.) discard;
  vec3 col = mix(vec3(1.), vec3(.32, .54, .6), smoothstep(.45, 1., r));
  gl_FragColor = vec4(col, smoothstep(1., .35, r) * uOp * vA);
}`
function SoftSnow({ reduced, mobile }) {
  const count = mobile ? 700 : 1400
  const { size, camera } = useThree()
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3), spd = new Float32Array(count), seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = (Math.random() - 0.5) * 16; pos[i * 3 + 2] = Math.random() * 10 - 7
      spd[i] = 0.35 + Math.random() * 0.8; seed[i] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: snowVert, fragmentShader: snowFrag, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uProj: { value: 800 }, uSize: { value: 0.2 }, uOp: { value: 1 }, uMouse: { value: new THREE.Vector2() }, uHalf: { value: new THREE.Vector2() } },
  }), [])
  const ref = useRef()
  useFrame((state, dt) => {
    const u = mat.uniforms
    u.uTime.value += dt * (reduced ? 0.25 : 1)
    const H = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    u.uHalf.value.set((H * size.width) / size.height / 2, H / 2)
    u.uProj.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * state.gl.getPixelRatio()
    u.uMouse.value.lerp(state.pointer, Math.min(1, dt * 6))
    u.uOp.value += (world.soft - u.uOp.value) * Math.min(1, dt * 4)
    ref.current.visible = u.uOp.value > 0.01
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/* ---------- arcade: neon synthwave world ---------- */
const gridFrag = /* glsl */ `
varying vec2 vW; uniform float uTime, uOp;
void main(){
  vec2 p = vW * .5; p.y += uTime;
  vec2 d = abs(fract(p) - .5);
  float m = max(d.x, d.y);
  float line = smoothstep(.465, .5, m), glow = smoothstep(.3, .5, m) * .22;
  float dist = length(vW - vec2(0., 14.));
  float fade = smoothstep(62., 6., dist);
  vec3 col = mix(vec3(1., .24, .67), vec3(.24, .95, 1.), smoothstep(10., 45., dist));
  gl_FragColor = vec4(col * (line + glow) * fade * uOp, 1.);
}`
const sunFrag = /* glsl */ `
varying vec2 vUv; uniform float uTime, uOp;
void main(){
  vec2 c = vUv - .5; float r = length(c) * 2.;
  if (r > 1.) discard;
  float y = vUv.y;
  float band = step(.5, fract(y * 14. - uTime * .4));
  float cut = y < .55 ? band * smoothstep(.0, .55, .55 - y) * 1.6 : 0.;
  if (cut > .5) discard;
  vec3 col = mix(vec3(1., .24, .67), vec3(1., .89, .24), smoothstep(.15, .95, y));
  float rim = smoothstep(.85, 1., r);
  gl_FragColor = vec4(col * (1. - rim * .6) * uOp, 1.);
}`
const basicVert = /* glsl */ `varying vec2 vUv; varying vec2 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`

const VOX = {
  chomper: { c: '#e8e4dc', rows: ['..####..', '.######.', '####.##.', '#####...', '####....', '######..', '.######.', '..####..'] },
  glitch: { c: '#bdb6a8', rows: ['.#....#.', '..####..', '.######.', '##.##.##', '########', '########', '#.#..#.#', '#......#'] },
  bug: { c: '#8f8a80', rows: ['..####..', '.#....#.', '#..##..#', '#.####.#', '#..##..#', '.#....#.', '#.#..#.#'] },
  skull: { c: '#d8d2c4', rows: ['.######.', '########', '##.##.##', '##.##.##', '########', '.##..##.', '.#.##.#.', '.######.'] },
}
const SPOTS = [['chomper', [-6.4, 2.2, -3]], ['glitch', [6.6, 2.6, -5]], ['bug', [-5.6, -1.4, -6]], ['skull', [6, -1, -2.5]]]
const noirGridFrag = /* glsl */ `
varying vec2 vW; uniform float uTime, uOp;
void main(){
  vec2 p = vW * .5; p.y += uTime * .05;
  vec2 d = abs(fract(p) - .5);
  float line = smoothstep(.47, .5, max(d.x, d.y));
  float dist = length(vW - vec2(0., 14.));
  float fade = smoothstep(40., 4., dist);
  float flick = .85 + .15 * sin(uTime * 23.) * sin(uTime * 7.);
  gl_FragColor = vec4(vec3(.85, .82, .76) * line * fade * .35 * flick * uOp, 1.);
}`
const moonFrag = /* glsl */ `
varying vec2 vUv; uniform float uTime, uOp;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+1.), f.x), f.y); }
void main(){
  vec2 c = vUv - .5; float r = length(c) * 2.;
  float halo = smoothstep(1., .45, r) * .18;
  float disc = smoothstep(.62, .6, r);
  float crat = n(c * 9.) * .5 + n(c * 23.) * .25;
  vec3 col = vec3(.9, .88, .82) * (disc * (.75 - crat * .35)) + vec3(.8) * halo;
  gl_FragColor = vec4(col * uOp, 1.);
}`
const dustVert = /* glsl */ `
attribute float aSeed; uniform float uTime, uProj; uniform vec2 uMouse;
varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime * .2 + aSeed * 20.) * .6;
  p.y = mod(p.y + uTime * (.05 + aSeed * .1) + 6., 12.) - 6.;
  vec2 d = p.xy - uMouse * vec2(7., 4.);
  float l = length(d);
  p.xy += d / (l + 1e-3) * smoothstep(2.2, 0., l) * 1.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.5 + aSeed * 2.5) * uProj / -mv.z * .012;
  vA = .25 + .5 * fract(aSeed * 13.7 + uTime * .1);
}`
const dustFrag = /* glsl */ `
uniform float uOp; varying float vA;
void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; gl_FragColor = vec4(vec3(.9, .88, .84), (1. - r) * vA * uOp); }`
const vbox = new THREE.BoxGeometry(0.2, 0.2, 0.2)

function VoxSprite({ kind, pos, mobile }) {
  const { c, rows } = VOX[kind]
  const ref = useRef(), grp = useRef()
  const cells = useMemo(() => {
    const out = [], w = rows[0].length, h = rows.length
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && out.push(new THREE.Vector3((x - w / 2) * 0.22, (h / 2 - y) * 0.22, 0))))
    return out
  }, [rows])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true }), [c])
  const st = useRef({ boom: -1, vel: cells.map(() => new THREE.Vector3()), seed: Math.random() * 10, spin: 0 })
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((state, dt) => {
    const s = st.current, t = state.clock.elapsedTime
    const g = grp.current
    g.position.set(pos[0] + state.pointer.x * 0.4, pos[1] + Math.sin(t * 0.8 + s.seed) * 0.25 + state.pointer.y * 0.25, pos[2])
    s.spin *= Math.pow(0.2, dt)
    g.rotation.y = Math.sin(t * 0.5 + s.seed) * 0.5 + state.pointer.x * 0.5 + s.spin
    g.rotation.z = Math.sin(t * 0.7 + s.seed) * 0.08
    // ghosts flicker like a bad signal
    const fl = Math.sin(t * 13 + s.seed * 5) * Math.sin(t * 3.1 + s.seed) > 0.85 ? 0.15 : 0.55 + Math.sin(t * 1.3 + s.seed) * 0.15
    mat.opacity = world.arc * fl
    let k = 0
    if (s.boom >= 0) {
      s.boom += dt
      k = s.boom < 1.3 ? 1 : Math.max(0, 1 - (s.boom - 1.3) / 0.9)
      if (s.boom > 2.2) s.boom = -1
    }
    cells.forEach((p, i) => {
      const v = s.vel[i], e = Math.min(s.boom, 1.3)
      dummy.position.set(p.x + v.x * e * k, p.y + v.y * e * k - (k ? e * e * 0.6 : 0) * k, p.z + v.z * e * k)
      dummy.rotation.set(v.x * e * 3 * k, v.y * e * 3 * k, 0)
      dummy.scale.setScalar(1 - k * Math.min(1, e) * 0.3)
      dummy.updateMatrix(); ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  const hit = (e) => {
    const target = e.nativeEvent?.target
    if (e.delta > 6 || target?.closest?.('.tv,.console,button,a,[data-drag],.gm,.arc-head')) return
    e.stopPropagation()
    const s = st.current
    if (s.boom >= 0) { s.spin += 6; return }
    s.boom = 0
    s.vel.forEach((v) => v.set((Math.random() - 0.5) * 5, Math.random() * 4 - 1, (Math.random() - 0.2) * 4))
    sfx('ghost')
  }
  return (
    <group ref={grp}>
      <instancedMesh ref={ref} args={[vbox, mat, cells.length]} onClick={hit} />
    </group>
  )
}

/* arcade: a dark, foggy black-and-white room with a pale moon, drifting dust and ghostly sprites */
function Noir({ mobile }) {
  const g = useRef(), op = useRef(0)
  const { size, camera } = useThree()
  const mk = (frag) => new THREE.ShaderMaterial({ vertexShader: basicVert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uOp: { value: 0 } } })
  const gridMat = useMemo(() => mk(noirGridFrag), [])
  const moonMat = useMemo(() => mk(moonFrag), [])
  const n = mobile ? 260 : 600
  const dustGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n)
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = (Math.random() - 0.5) * 12; pos[i * 3 + 2] = Math.random() * 8 - 6; seed[i] = Math.random() }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return geo
  }, [n])
  const dustMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uProj: { value: 800 }, uOp: { value: 0 }, uMouse: { value: new THREE.Vector2() } } }), [])
  useFrame((state, dt) => {
    op.current += (world.arc - op.current) * Math.min(1, dt * 6)
    const a = op.current
    g.current.visible = a > 0.01
    if (!g.current.visible) return
    for (const m of [gridMat, moonMat, dustMat]) { m.uniforms.uTime.value += dt; m.uniforms.uOp.value = a }
    dustMat.uniforms.uProj.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * state.gl.getPixelRatio()
    dustMat.uniforms.uMouse.value.lerp(state.pointer, Math.min(1, dt * 5))
    g.current.rotation.y += (state.pointer.x * 0.05 - g.current.rotation.y) * Math.min(1, dt * 2)
    g.current.rotation.x += (-state.pointer.y * 0.025 - g.current.rotation.x) * Math.min(1, dt * 2)
  })
  return (
    <group ref={g} visible={false}>
      <mesh material={gridMat} rotation-x={-Math.PI / 2} position={[0, -3.6, -20]}><planeGeometry args={[120, 70]} /></mesh>
      <mesh material={moonMat} position={[7, 4.5, -40]} scale={12}><planeGeometry args={[1, 1]} /></mesh>
      <points geometry={dustGeo} material={dustMat} frustumCulled={false} />
      {SPOTS.slice(0, mobile ? 2 : 4).map(([k, p]) => <VoxSprite key={k} kind={k} pos={p} mobile={mobile} />)}
    </group>
  )
}

function Lights() {
  const hemi = useRef(), dir = useRef()
  const c = useMemo(() => ({ skyD: new THREE.Color('#ffffff'), skyN: new THREE.Color('#7f9fb0'), grD: new THREE.Color('#528A9A'), grN: new THREE.Color('#15151a'), dD: new THREE.Color('#fff4e6'), dN: new THREE.Color('#a9c9dc') }), [])
  useFrame(() => {
    const n = world.night
    hemi.current.intensity = 1.5 - n * 0.6
    hemi.current.color.lerpColors(c.skyD, c.skyN, n); hemi.current.groundColor.lerpColors(c.grD, c.grN, n)
    dir.current.intensity = 2.2 - n * 1.3; dir.current.color.lerpColors(c.dD, c.dN, n)
  })
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={dir} position={[6, 10, 8]} castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0005} />
    </>
  )
}

export default function Scene({ onMine }) {
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const mobile = useMemo(() => matchMedia('(max-width: 700px), (pointer: coarse)').matches, [])
  return (
    <Canvas
      className="scene"
      shadows={!mobile}
      dpr={mobile ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 14], fov: 35 }}
      eventSource={document.getElementById('root')}
      eventPrefix="client"
    >
      <Lights />
      <Island onMine={onMine} reduced={reduced} />
      <Particles reduced={reduced} />
      <SoftSnow reduced={reduced} mobile={mobile} />
      <Noir mobile={mobile} />
    </Canvas>
  )
}
