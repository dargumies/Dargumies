import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from './world.js'
import { SPRITES } from './pixels.js'

// form order: 0 snow, 1 browser, 2 pickaxe, 3 robot, 4 gamepad, 5 cube, 6 chart
const NAMES = ['browser', 'pickaxe', 'robot', 'gamepad']

function snowForm(n) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 26; a[i * 3 + 1] = (Math.random() - 0.5) * 14; a[i * 3 + 2] = Math.random() * 9 - 6 }
  return a
}
function spriteForm(rows, n) {
  const cells = []
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && cells.push([x, y])))
  const w = rows[0].length, h = rows.length, m = Math.max(w, h)
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const [x, y] = cells[i % cells.length]
    a[i * 3] = (x + Math.random() - w / 2) / m
    a[i * 3 + 1] = (h / 2 - y - Math.random()) / m
    a[i * 3 + 2] = (Math.random() - 0.5) * (1.6 / m)
  }
  return a
}
function cubeForm(n) {
  const a = new Float32Array(n * 3), v = new THREE.Vector3(), e = new THREE.Euler(0.62, 0.785, 0)
  for (let i = 0; i < n; i++) {
    const s = 0.34
    if (i % 3) { // edges
      const ax = i % 3 === 1 ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 3)
      const p = [Math.sign(Math.random() - 0.5) * s, Math.sign(Math.random() - 0.5) * s, Math.sign(Math.random() - 0.5) * s]
      p[ax] = (Math.random() - 0.5) * 2 * s
      v.set(...p)
    } else { // voxel face grid
      const f = Math.floor(Math.random() * 3)
      const p = [(Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s]
      p[f] = s; const g = 2 * s / 4
      const ax = (f + 1) % 3; p[ax] = Math.round(p[ax] / g) * g
      v.set(...p)
    }
    v.applyEuler(e)
    a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z
  }
  return a
}

const vert = /* glsl */ `
attribute vec3 aF0; attribute vec3 aF1; attribute vec3 aF2; attribute vec3 aF3; attribute vec3 aF4; attribute vec3 aF5; attribute vec3 aF6;
attribute vec4 aRnd;
uniform float uPix, uA, uB, uMix, uTime, uNight, uScale, uProj, uSway, uScatter;
uniform vec2 uShift, uMouse;
varying vec3 vCol; varying float vA;
vec3 pick(float i){ if(i<.5) return aF0; if(i<1.5) return aF1; if(i<2.5) return aF2; if(i<3.5) return aF3; if(i<4.5) return aF4; if(i<5.5) return aF5; return aF6; }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
vec3 place(float id){
  if(id<.5){
    vec3 p = aF0;
    p.y = mod(p.y - uTime*(.35+aRnd.y*.7) + 7., 14.) - 7.;
    p.x += sin(uTime*.6 + aRnd.z*6.28)*.35;
    return p;
  }
  vec3 p = rotY(uSway + uMouse.x*.35) * pick(id);
  p.y += sin(uTime*1.3 + p.x*3.)*.01;
  return p*uScale + vec3(uShift, 0.);
}
void main(){
  float t = smoothstep(aRnd.x*.45, aRnd.x*.45+.55, uMix);
  vec3 p = mix(place(uA), place(uB), t);
  p += (aRnd.xyz-.5) * vec3(4.,3.,3.) * sin(t*3.14159) * uScatter;
  // only a few flakes in pure snow, all particles when a shape is formed
  float vis = step(aRnd.y, .085) * uPix;
  float sA = uA<.5 ? vis : 1.;
  float sB = uB<.5 ? vis : 1.;
  float sz = mix(sA, sB, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float base = mix(.055, .042, step(.5, mix(uA,uB,step(.5,t))) );
  gl_PointSize = sz * base * (.65 + aRnd.w*.7) * uProj / -mv.z;
  // day: teal/ink/white pixel snow; night: aurora
  vec3 day = aRnd.z < .55 ? vec3(.322,.541,.604) : (aRnd.z < .8 ? vec3(.145,.145,.169) : vec3(1.));
  vec3 night = aRnd.z < .55 ? vec3(.93,.98,1.) : (aRnd.z < .75 ? vec3(.49,1.,.78) : (aRnd.z < .9 ? vec3(.47,.84,1.) : vec3(.71,.61,1.)));
  vCol = mix(day, night, uNight);
  vA = mix(.85, .95, uNight);
}`
const frag = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){ gl_FragColor = vec4(vCol, vA); }`

export default function Particles({ reduced }) {
  const { size, camera } = useThree()
  const n = size.width < 700 ? 14000 : 26000
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const forms = [snowForm(n), ...NAMES.map((k) => spriteForm(SPRITES[k], n)), cubeForm(n), spriteForm(SPRITES.chart, n)]
    forms.forEach((f, i) => g.setAttribute('aF' + i, new THREE.BufferAttribute(f, 3)))
    g.setAttribute('position', new THREE.BufferAttribute(forms[0].slice(), 3))
    const r = new Float32Array(n * 4); for (let i = 0; i < r.length; i++) r[i] = Math.random()
    g.setAttribute('aRnd', new THREE.BufferAttribute(r, 4))
    return g
  }, [n])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    uniforms: { uPix: { value: 0 }, uA: { value: 0 }, uB: { value: 0 }, uMix: { value: 0 }, uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 4 }, uProj: { value: 800 }, uSway: { value: 0 }, uScatter: { value: 1 }, uShift: { value: new THREE.Vector2() }, uMouse: { value: new THREE.Vector2() } },
  }), [])
  const sm = useRef({ mix: 0 })

  useFrame((state, dt) => {
    const u = mat.uniforms
    const H = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const W = H * (size.width / size.height)
    const wide = size.width > 900
    u.uProj.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * state.gl.getPixelRatio()
    u.uTime.value += dt * (reduced ? 0.3 : 1)
    if (u.uA.value !== world.A || u.uB.value !== world.B) sm.current.mix = world.mix
    sm.current.mix += (world.mix - sm.current.mix) * Math.min(1, dt * 8)
    u.uA.value = world.A; u.uB.value = world.B; u.uMix.value = sm.current.mix
    u.uNight.value = world.night
    u.uPix.value += (world.pix - u.uPix.value) * Math.min(1, dt * 4)
    u.uScatter.value = reduced ? 0.2 : 1
    u.uSway.value = reduced ? 0 : Math.sin(u.uTime.value * 0.45) * 0.45
    u.uMouse.value.lerp(state.pointer, 0.05)
    if (wide) { u.uShift.value.set(W * 0.24, -H * 0.02); u.uScale.value = Math.min(H * 0.6, W * 0.36) }
    else { u.uShift.value.set(0, H * 0.24); u.uScale.value = Math.min(W * 0.62, H * 0.3) }
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
