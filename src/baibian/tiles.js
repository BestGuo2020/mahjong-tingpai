export const BASE_TILES = Array.from({ length: 34 }, (_, id) => id)
export const LAIZI_TILES = ['lm', 'lp', 'ls', 'lz', 'la']
// 倒转昆仑规则图中的14种中心对称牌：245689条、1234589筒、白板。
export const INVERTED_KUNLUN_TILES = Object.freeze([19,21,22,23,25,26,9,10,11,12,13,16,17,33])
export const HONOR_NAMES = ['东', '南', '西', '北', '中', '发', '白']
export const SUITS = [
  { key: 'm', name: '万', tiles: BASE_TILES.slice(0, 9) },
  { key: 'p', name: '筒', tiles: BASE_TILES.slice(9, 18) },
  { key: 's', name: '条', tiles: BASE_TILES.slice(18, 27) },
  { key: 'z', name: '字', tiles: BASE_TILES.slice(27) }
]
export const LAIZI_META = [
  { id: 'lm', name: '万赖', suit: 0 },
  { id: 'lp', name: '筒赖', suit: 1 },
  { id: 'ls', name: '条赖', suit: 2 },
  { id: 'lz', name: '字赖', suit: 3 },
  { id: 'la', name: '万能赖', suit: 'any' }
]

export function suitOf(id) { return id < 27 ? Math.floor(id / 9) : 3 }
export function rankOf(id) { return id < 27 ? id % 9 + 1 : id - 26 }
export function tileCode(id) {
  if (typeof id === 'string') return id
  return id < 27 ? `${rankOf(id)}${['m', 'p', 's'][suitOf(id)]}` : `${rankOf(id)}z`
}
export function tileName(id) {
  if (typeof id === 'string') return LAIZI_META.find(x => x.id === id)?.name || id
  return id < 27 ? `${rankOf(id)}${['万', '筒', '条'][suitOf(id)]}` : HONOR_NAMES[id - 27]
}
export function emptyCounts() { return Array(34).fill(0) }
export function idsToCounts(ids) {
  const counts = emptyCounts()
  ids.forEach(id => { if (typeof id === 'number') counts[id]++ })
  return counts
}
export function laiziCounts(ids) {
  return LAIZI_TILES.map(id => ids.filter(x => x === id).length)
}
export function allowedByLaizi(index, tile) { return suitOf(tile) === index }
export function laiziIndexForTile(tile) { return suitOf(tile) }

export function parseTileCode(input) {
  const compact = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!compact) return []
  const result = []
  let digits = ''
  for (let i = 0; i < compact.length; i++) {
    const ch = compact[i]
    if (/[1-9]/.test(ch)) { digits += ch; continue }
    if (ch === 'l') {
      if (digits || i + 1 >= compact.length || !/[mpsza]/.test(compact[i + 1])) throw new Error('癞子请使用 lm / lp / ls / lz / la')
      result.push(`l${compact[++i]}`)
      continue
    }
    if (!/[mpsz]/.test(ch) || !digits) throw new Error('格式错误，请使用 123m456p789s123z lm')
    const base = { m: 0, p: 9, s: 18, z: 27 }[ch]
    for (const digit of digits) {
      const rank = Number(digit)
      if (ch === 'z' && rank > 7) throw new Error('字牌编号只能是 1～7')
      result.push(base + rank - 1)
    }
    digits = ''
  }
  if (digits) throw new Error('数字后需要花色 m / p / s / z')
  return result
}
