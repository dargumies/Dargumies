// shared mutable state between the DOM (scroll) and the 3D scene
export const world = {
  A: 0, B: 0, mix: 0, night: 0, scatter: 1, soft: 1, pix: 0, restore: 0,
  arc: 0, arcSX: 0, arcSY: 0, // arcade "tv screen" amount and its on/off squash
  zone: 'snow', lenis: null, modal: false, entered: false,
}
