// 8-bit sprites used both by the particle field and by the pixel-art covers
export const SPRITES = {
  browser: [
    '################',
    '#.#.#..........#',
    '################',
    '#..............#',
    '#..............#',
    '#..#......#.#..#',
    '#.#......#...#.#',
    '##......#.....##',
    '#.#....#.....#.#',
    '#..#..#.....#..#',
    '#..............#',
    '#..............#',
    '################',
  ],
  pickaxe: [
    '......######....',
    '....##########..',
    '...###......###.',
    '..##.....##..##.',
    '..#.....###...#.',
    '.......###......',
    '......###.......',
    '.....###........',
    '....###.........',
    '...###..........',
    '..###...........',
    '.###............',
    '###.............',
    '##..............',
  ],
  robot: [
    '.......##.......',
    '.......##.......',
    '...##########...',
    '..#..........#..',
    '..#.###..###.#..',
    '###.###..###.###',
    '###..........###',
    '..#..........#..',
    '..#..######..#..',
    '..#..........#..',
    '...##########...',
    '.....######.....',
    '....########....',
  ],
  gamepad: [
    '...####..####...',
    '.##############.',
    '################',
    '###.#######..###',
    '##...#####.##.##',
    '###.#######..###',
    '################',
    '######....######',
    '.####......####.',
    '..##........##..',
  ],
  chart: [
    '................',
    '.............##.',
    '.............##.',
    '..........##.##.',
    '..........##.##.',
    '.......##.##.##.',
    '.......##.##.##.',
    '....##.##.##.##.',
    '....##.##.##.##.',
    '.##.##.##.##.##.',
    '.##.##.##.##.##.',
    '................',
    '################',
  ],
}

/* ---------- pixel-art covers, painted at low-res and upscaled ---------- */
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

function painter(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d'); const r = rng(seed)
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, 1, 1) }
  const rect = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, ww | 0, hh | 0) }
  const sky = (cols) => { const band = Math.ceil(h / cols.length); cols.forEach((col, i) => rect(0, i * band, w, band + 1, col)) }
  const stars = (n, col) => { for (let i = 0; i < n; i++) px(r() * w, r() * h * 0.55, col) }
  const aurora = (y, cols) => {
    for (let x = 0; x < w; x++) {
      const yy = y + Math.sin(x * 0.09) * 4 + Math.sin(x * 0.23) * 2
      cols.forEach((col, i) => { if (r() > 0.15 + i * 0.12) rect(x, yy + i * 2, 1, 2 + (r() * 3 | 0), col) })
    }
  }
  const hills = (base, amp, col, snow, f = 0.08, ph = 0) => {
    for (let x = 0; x < w; x++) {
      const y = Math.round(base - Math.abs(Math.sin(x * f + ph)) * amp - Math.sin(x * f * 2.7) * amp * 0.25)
      rect(x, y, 1, h - y, col); if (snow) rect(x, y, 1, 2, snow)
    }
  }
  const pine = (x, y, hh, col, snow) => {
    for (let i = 0; i < hh; i++) { const ww = Math.max(1, Math.floor((i / hh) * hh * 0.55)); rect(x - ww, y - hh + i, ww * 2 + 1, 1, col); if (i % 3 === 0) rect(x - ww, y - hh + i, ww * 2 + 1, 1, snow) }
    rect(x, y, 1, 2, '#4f3a2d')
  }
  const sprite = (name, x, y, col, s = 1) => SPRITES[name].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && rect(x + i * s, y + j * s, s, s, col)))
  const snowfall = (n, col) => { for (let i = 0; i < n; i++) px(r() * w, r() * h, col) }
  return { c, g, r, px, rect, sky, stars, aurora, hills, pine, sprite, snowfall, w, h }
}

const RACES = [['#ffd27a', '#528A9A'], ['#b49bff', '#2f5b57'], ['#7dffc8', '#5b4434']]
export const COVERS = [
  (p) => { // Minecraft: magic & races on a big scene
    p.sky(['#0d1d26', '#10232d', '#132833', '#183542']); p.stars(40, '#dceff6')
    p.aurora(8, ['#b49bff', '#78d7ff'])
    p.hills(46, 9, '#2a4652', '#e9f6f8', 0.06, 1)
    for (let i = 0; i < 4; i++) p.pine(6 + i * 26 + (p.r() * 6 | 0), 50, 9 + (p.r() * 4 | 0), '#1f3e3b', '#e9f6f8')
    for (let x = 0; x < p.w; x += 4) { p.rect(x, 54, 4, 2, '#f4fafb'); p.rect(x, 56, 4, 4, x % 8 ? '#6f5444' : '#5f4739') }
    // magic circle
    for (let a = 0; a < Math.PI * 2; a += 0.05) { p.px(48 + Math.cos(a) * 22, 50 + Math.sin(a) * 5, '#b49bff'); p.px(48 + Math.cos(a) * 15, 50 + Math.sin(a) * 3.4, '#78d7ff') }
    // three races
    ;[[30, 0], [45, 1], [60, 2]].forEach(([x, k]) => { const [skin, cloth] = RACES[k]; p.rect(x, 38, 4, 4, skin); p.rect(x - 1, 42, 6, 6, cloth); p.rect(x, 48, 1, 3, '#25252B'); p.rect(x + 3, 48, 1, 3, '#25252B') })
    // spell beams and sparks
    for (let i = 0; i < 60; i++) { const a = p.r() * Math.PI * 2, d = 4 + p.r() * 18; p.px(48 + Math.cos(a) * d * 1.4, 30 + Math.sin(a) * d * 0.7, ['#7dffc8', '#b49bff', '#ffd27a', '#78d7ff'][i % 4]) }
    p.rect(47, 14, 2, 20, '#e7dcff'); p.rect(46, 12, 4, 2, '#ffffff')
  },
  (p) => { // websites: UI/UX in a browser window
    p.sky(['#cfe0e2', '#D9E7E8', '#e4eff0']); p.hills(52, 8, '#b4cdd1', '#ffffff', 0.05)
    p.rect(14, 8, 68, 44, '#25252B'); p.rect(15, 13, 66, 38, '#f4fafb'); p.rect(15, 9, 66, 3, '#25252B')
    ;[17, 20, 23].forEach((x, i) => p.rect(x, 10, 2, 1, ['#ff8f8f', '#ffd27a', '#7dffc8'][i]))
    p.rect(19, 16, 26, 3, '#25252B'); p.rect(19, 21, 18, 2, '#528A9A'); p.rect(19, 26, 12, 4, '#528A9A')
    p.rect(50, 16, 27, 18, '#78d7ff'); p.rect(54, 20, 8, 8, '#f4fafb'); p.rect(64, 24, 9, 6, '#2f5b57')
    for (let i = 0; i < 3; i++) { p.rect(19 + i * 20, 38, 17, 10, '#D9E7E8'); p.rect(21 + i * 20, 40, 9, 2, '#25252B'); p.rect(21 + i * 20, 43, 13, 1, '#528A9A') }
    p.snowfall(40, '#528A9A')
  },
  (p) => { // games: 3D and 2D
    p.sky(['#1d2440', '#2b2f5a', '#4a3f75', '#6b5a8f']); p.stars(30, '#ffffff')
    p.aurora(8, ['#7dffc8', '#78d7ff'])
    p.hills(44, 12, '#2d3a5c', '#dceff6', 0.07, 2); p.hills(52, 6, '#223050', '#f4fafb', 0.11, 4)
    for (let x = 0; x < p.w; x += 6) { p.rect(x, 55, 6, 1, '#f4fafb'); p.rect(x, 56, 6, 4, '#3a4a6a') }
    p.rect(30, 44, 12, 2, '#f4fafb'); p.rect(30, 46, 12, 3, '#5b6a72')
    p.rect(22, 46, 4, 4, '#ffd27a'); p.rect(21, 50, 6, 3, '#ff8f8f'); p.rect(20, 53, 2, 2, '#25252B'); p.rect(26, 52, 2, 2, '#25252B')
    p.rect(70, 47, 3, 3, '#ffd27a'); p.rect(80, 41, 3, 3, '#ffd27a')
    // isometric 3D cube floating
    const cx = 72, cy = 18
    for (let i = 0; i < 9; i++) { p.rect(cx - i, cy + i / 2, i * 2, 1, '#9ccbd6') }
    p.rect(cx - 9, cy + 4, 9, 10, '#528A9A'); p.rect(cx, cy + 4, 9, 10, '#3d6f7d')
    p.sprite('gamepad', 4, 4, 'rgba(220,239,246,.6)', 1)
    p.snowfall(25, '#ffffff')
  },
  (p) => { // data: SQL tables and charts
    p.sky(['#10232d', '#132833', '#10232d'])
    for (let x = 0; x < p.w; x += 8) p.rect(x, 0, 1, p.h, '#183542')
    for (let y = 0; y < p.h; y += 8) p.rect(0, y, p.w, 1, '#183542')
    const bars = [10, 16, 13, 22, 19, 28, 34]
    bars.forEach((h, i) => { p.rect(8 + i * 7, 52 - h, 5, h, i === bars.length - 1 ? '#7dffc8' : '#528A9A'); p.rect(8 + i * 7, 52 - h, 5, 1, '#78d7ff') })
    p.rect(6, 52, 50, 1, '#dceff6')
    let py = 40
    for (let x = 6; x < 56; x++) { py += (p.r() - 0.62) * 2; p.px(x, Math.max(10, py), '#ffd27a') }
    // table
    p.rect(62, 8, 28, 44, '#183542'); p.rect(62, 8, 28, 5, '#528A9A')
    for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) p.rect(64 + c * 9, 16 + r * 5, 4 + (p.r() * 4 | 0), 2, r % 2 ? '#91afbb' : '#dceff6')
  },
  (p) => { // AI & bots: chat with a bot
    p.sky(['#25252B', '#2a2a31', '#25252B']); p.stars(20, '#3c4a52')
    p.sprite('robot', 8, 14, '#78d7ff', 2)
    const bubble = (x, y, w, col, txt) => { p.rect(x, y, w, 9, col); p.rect(x + 2, y + 3, Math.floor(w * 0.6), 1, txt); p.rect(x + 2, y + 5, Math.floor(w * 0.4), 1, txt) }
    bubble(44, 10, 40, '#528A9A', '#D9E7E8'); bubble(54, 23, 32, '#D9E7E8', '#25252B'); bubble(44, 36, 36, '#528A9A', '#D9E7E8'); bubble(60, 49, 24, '#7dffc8', '#25252B')
    // AI spark
    ;[[38, 8], [36, 10], [40, 10], [38, 12], [38, 9], [38, 11], [37, 10], [39, 10]].forEach(([x, y]) => p.px(x, y, '#ffd27a'))
  },
]

export function paintCover(i) {
  if (!COVERS[i]) i = i % COVERS.length
  const p = painter(96, 60, 11 + i * 7)
  COVERS[i](p)
  return p.c.toDataURL()
}
