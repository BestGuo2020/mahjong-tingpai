import { INVERTED_KUNLUN_TILES, allowedByLaizi, laiziIndexForTile, tileCode } from './tiles.js'

const MAX_SOLUTIONS = 4000

function cloneWild(wild) { return [...wild] }
function consumeWild(wild, tile, amount) {
  const index = laiziIndexForTile(tile)
  if (wild[index] < amount) return null
  const next = cloneWild(wild)
  next[index] -= amount
  return next
}
function assignmentList(tile, amount) {
  const laizi = ['lm', 'lp', 'ls', 'lz'][laiziIndexForTile(tile)]
  return Array.from({ length: amount }, () => ({ laizi, as: tile }))
}
function groupKey(group) { return `${group.type}:${group.tiles.map(tileCode).join('-')}` }

function sequenceChoices(counts, wild, ids, forcedPhysical) {
  const out = []
  function walk(pos, nextCounts, nextWild, assigned) {
    if (pos === ids.length) return out.push({ counts: nextCounts, wild: nextWild, assigned })
    const id = ids[pos]
    const mustPhysical = id === forcedPhysical && assigned.every(x => x.forced !== true)
    if (nextCounts[id] > 0) {
      const c = [...nextCounts]; c[id]--
      walk(pos + 1, c, nextWild, [...assigned, { tile: id, forced: mustPhysical }])
    }
    if (!mustPhysical) {
      const w = consumeWild(nextWild, id, 1)
      if (w) walk(pos + 1, nextCounts, w, [...assigned, { tile: id, wildcard: true }])
    }
  }
  walk(0, counts, wild, [])
  return out.filter(choice => choice.assigned.some(x => x.tile === forcedPhysical && !x.wildcard))
}

function enumerateStandard(counts, wild, fixedKongs, targetOverride = null, prefixGroups = [], prefixAssignments = [], kind = 'standard') {
  const targetMelds = targetOverride ?? (4 - fixedKongs.length)
  if (targetMelds < 0) return []
  const total = counts.reduce((a, b) => a + b, 0) + wild.reduce((a, b) => a + b, 0)
  if (total !== targetMelds * 3 + 2) return []
  const solutions = []

  function melds(c, w, left, groups, assignments, minKey = '') {
    if (solutions.length >= MAX_SOLUTIONS) return
    if (!left) {
      if (c.every(n => n === 0) && w.every(n => n === 0)) {
        const allGroups = [...fixedKongs.map(k => ({ type: 'kong', tiles: Array(k.size ?? 4).fill(k.tile), fixed: true })), ...prefixGroups, ...groups]
        solutions.push({ kind, groups: allGroups, assignments: [...prefixAssignments, ...assignments] })
      }
      return
    }
    const first = c.findIndex(n => n > 0)
    if (first < 0) {
      for (let tile = 0; tile < 34; tile++) {
        const key = `pung:${tileCode(tile)}-${tileCode(tile)}-${tileCode(tile)}`
        if (key < minKey) continue
        const nw = consumeWild(w, tile, 3)
        if (nw) melds(c, nw, left - 1, [...groups, { type: 'pung', tiles: [tile, tile, tile] }], [...assignments, ...assignmentList(tile, 3)], key)
      }
      for (let start = 0; start < 27; start++) if (start % 9 <= 6) {
        const ids = [start, start + 1, start + 2]
        const key = `sequence:${ids.map(tileCode).join('-')}`
        if (key < minKey) continue
        let nw = w
        for (const id of ids) { nw = nw && consumeWild(nw, id, 1) }
        if (nw) melds(c, nw, left - 1, [...groups, { type: 'sequence', tiles: ids }], [...assignments, ...ids.flatMap(id => assignmentList(id, 1))], key)
      }
      return
    }

    for (let physical = 1; physical <= Math.min(3, c[first]); physical++) {
      const wildcard = 3 - physical
      const nw = consumeWild(w, first, wildcard)
      if (!nw) continue
      const nc = [...c]; nc[first] -= physical
      const group = { type: 'pung', tiles: [first, first, first] }
      const key = groupKey(group)
      melds(nc, nw, left - 1, [...groups, group], [...assignments, ...assignmentList(first, wildcard)], key)
    }
    if (first < 27) {
      const rank = first % 9
      for (let delta = -2; delta <= 0; delta++) {
        const startRank = rank + delta
        if (startRank < 0 || startRank > 6) continue
        const start = Math.floor(first / 9) * 9 + startRank
        const ids = [start, start + 1, start + 2]
        for (const choice of sequenceChoices(c, w, ids, first)) {
          const group = { type: 'sequence', tiles: ids }
          const assigned = choice.assigned.filter(x => x.wildcard).flatMap(x => assignmentList(x.tile, 1))
          melds(choice.counts, choice.wild, left - 1, [...groups, group], [...assignments, ...assigned], groupKey(group))
        }
      }
    }
  }

  for (let pair = 0; pair < 34; pair++) {
    for (let physical = 0; physical <= Math.min(2, counts[pair]); physical++) {
      const wildcard = 2 - physical
      if (!physical && counts.some((n, i) => i === pair ? n : false) && wildcard === 2) { /* still legal */ }
      const nw = consumeWild(wild, pair, wildcard)
      if (!nw) continue
      const nc = [...counts]; nc[pair] -= physical
      melds(nc, nw, targetMelds, [{ type: 'pair', tiles: [pair, pair] }], assignmentList(pair, wildcard))
    }
  }
  return solutions
}

function enumerateCombinationDragon(counts, wild, fixedKongs) {
  if (fixedKongs.length > 1) return []
  const orders = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]
  const out = []
  for (const order of orders) {
    const required = [[1,4,7],[2,5,8],[3,6,9]].flatMap((ranks,index) => ranks.map(rank => order[index]*9+rank-1))
    function take(pos, c, w, assigned) {
      if (pos === required.length) {
        out.push(...enumerateStandard(c, w, fixedKongs, 1-fixedKongs.length, [{ type:'combinationDragon', tiles:required }], assigned, 'combinationDragon'))
        return
      }
      const tile = required[pos]
      if (c[tile] > 0) { const nc=[...c]; nc[tile]--; take(pos+1,nc,w,assigned) }
      const nw=consumeWild(w,tile,1)
      if (nw) take(pos+1,c,nw,[...assigned,...assignmentList(tile,1)])
    }
    take(0,counts,wild,[])
  }
  return out
}

function enumerateSevenPairs(counts, wild, fixedKongs) {
  if (fixedKongs.length || counts.reduce((a, b) => a + b, 0) + wild.reduce((a, b) => a + b, 0) !== 14) return []
  const results = []
  function walk(c, w, pairs, assignments, start) {
    if (results.length >= MAX_SOLUTIONS) return
    if (pairs.length === 7) {
      if (c.every(n => n === 0) && w.every(n => n === 0)) results.push({ kind: 'sevenPairs', groups: pairs, assignments })
      return
    }
    const first = c.findIndex(n => n > 0)
    const from = first < 0 ? start : Math.min(first, start)
    for (let tile = from; tile < 34; tile++) {
      for (let physical = 0; physical <= Math.min(2, c[tile]); physical++) {
        if (first >= 0 && tile === first && physical === 0) continue
        if (first >= 0 && tile !== first && c[first] > 0) continue
        const wildcard = 2 - physical
        const nw = consumeWild(w, tile, wildcard)
        if (!nw) continue
        const nc = [...c]; nc[tile] -= physical
        walk(nc, nw, [...pairs, { type: 'pair', tiles: [tile, tile] }], [...assignments, ...assignmentList(tile, wildcard)], tile)
      }
    }
  }
  walk(counts, wild, [], [], 0)
  return results
}

function enumerateThirteenOrphans(counts, wild, fixedKongs) {
  if (fixedKongs.length) return []
  const yaochu = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
  const allowed = new Set(yaochu)
  if (counts.some((n, i) => n && !allowed.has(i))) return []
  const out = []
  for (const pair of yaochu) {
    const target = Array(34).fill(0); yaochu.forEach(i => target[i] = 1); target[pair]++
    if (counts.some((n, i) => n > target[i])) continue
    const need = target.map((n, i) => n - counts[i])
    const requiredWild = [0, 1, 2, 3].map(suit => need.reduce((sum, n, i) => sum + (allowedByLaizi(suit, i) ? n : 0), 0))
    if (!requiredWild.every((n, i) => n === wild[i])) continue
    const assignments = need.flatMap((n, tile) => assignmentList(tile, n))
    out.push({ kind: 'thirteenOrphans', groups: [{ type: 'special', tiles: target.flatMap((n, i) => Array(n).fill(i)) }], assignments })
  }
  return out
}

function enumerateInvertedKunlun(counts, wild, fixedKongs) {
  if (fixedKongs.length) return []
  const total = counts.reduce((a, b) => a + b, 0) + wild.reduce((a, b) => a + b, 0)
  if (total !== 14) return []
  const allowed = new Set(INVERTED_KUNLUN_TILES)
  if (counts.some((n, id) => n && !allowed.has(id))) return []

  const targets = []
  const allDistinct = Array(34).fill(0)
  INVERTED_KUNLUN_TILES.forEach(id => { allDistinct[id] = 1 })
  targets.push(allDistinct)
  for (const missing of INVERTED_KUNLUN_TILES) {
    for (const duplicate of INVERTED_KUNLUN_TILES) {
      if (duplicate === missing) continue
      const target = [...allDistinct]
      target[missing] = 0
      target[duplicate] = 2
      targets.push(target)
    }
  }

  return targets.flatMap(target => {
    if (counts.some((n, id) => n > target[id])) return []
    const need = target.map((n, id) => n - counts[id])
    const requiredWild = [0, 1, 2, 3].map(suit => need.reduce((sum, n, id) => sum + (allowedByLaizi(suit, id) ? n : 0), 0))
    if (!requiredWild.every((n, suit) => n === wild[suit])) return []
    const assignments = need.flatMap((n, tile) => assignmentList(tile, n))
    const tiles = target.flatMap((n, id) => Array(n).fill(id))
    return [{ kind:'invertedKunlun', groups:[{ type:'special', tiles }], assignments }]
  })
}

const DRAGON_ORDERS = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]
const FOUR_WINDS = [27,28,29,30]

function enumerateThirteenFaceSpecial(counts, wild, fixedKongs, targetSets, kind) {
  if (fixedKongs.length) return []
  const total = counts.reduce((a, b) => a + b, 0) + wild.reduce((a, b) => a + b, 0)
  if (total !== 14) return []
  return targetSets.flatMap(targetTiles => targetTiles.flatMap(duplicate => {
    const target = Array(34).fill(0)
    targetTiles.forEach(id => { target[id] = 1 })
    target[duplicate]++
    if (counts.some((n, id) => n > target[id])) return []
    const need = target.map((n, id) => n - counts[id])
    const requiredWild = [0,1,2,3].map(suit => need.reduce((sum, n, id) => sum + (allowedByLaizi(suit, id) ? n : 0), 0))
    if (!requiredWild.every((n, suit) => n === wild[suit])) return []
    const assignments = need.flatMap((n, tile) => assignmentList(tile, n))
    const tiles = target.flatMap((n, id) => Array(n).fill(id))
    return [{ kind, groups:[{ type:'special', tiles }], assignments }]
  }))
}

function enumerateImperialPureDragon(counts, wild, fixedKongs) {
  const targets = [0,1,2].map(suit => [...Array.from({length:9},(_,rank)=>suit*9+rank),...FOUR_WINDS])
  return enumerateThirteenFaceSpecial(counts,wild,fixedKongs,targets,'imperialPureDragon')
}

function enumerateImperialFlowerDragon(counts, wild, fixedKongs) {
  const targets = DRAGON_ORDERS.map(order => [
    ...[0,1,2].map(rank=>order[0]*9+rank),
    ...[3,4,5].map(rank=>order[1]*9+rank),
    ...[6,7,8].map(rank=>order[2]*9+rank),
    ...FOUR_WINDS
  ])
  return enumerateThirteenFaceSpecial(counts,wild,fixedKongs,targets,'imperialFlowerDragon')
}

function enumerateImperialCombinationDragon(counts, wild, fixedKongs) {
  const targets = DRAGON_ORDERS.map(order => [
    ...[0,3,6].map(rank=>order[0]*9+rank),
    ...[1,4,7].map(rank=>order[1]*9+rank),
    ...[2,5,8].map(rank=>order[2]*9+rank),
    ...FOUR_WINDS
  ])
  return enumerateThirteenFaceSpecial(counts,wild,fixedKongs,targets,'imperialCombinationDragon')
}

function combinations(items, count, start = 0, prefix = [], out = []) {
  if (!count) { out.push(prefix); return out }
  for (let i = start; i <= items.length - count; i++) combinations(items, count - 1, i + 1, [...prefix, items[i]], out)
  return out
}
function enumerateAllUnrelated(counts, wild, fixedKongs) {
  if (fixedKongs.length || counts.some(n => n > 1)) return []
  const total = counts.reduce((a, b) => a + b, 0) + wild.reduce((a, b) => a + b, 0)
  if (total !== 14) return []
  const groups = [[0, 3, 6], [1, 4, 7], [2, 5, 8]]
  const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]
  const out = []
  for (const order of permutations) {
    const allowed = new Set(Array.from({ length: 7 }, (_, i) => i + 27))
    order.forEach((groupIndex, suit) => groups[groupIndex].forEach(rank => allowed.add(suit * 9 + rank)))
    if (counts.some((n, i) => n && !allowed.has(i))) continue
    const physical = new Set(counts.flatMap((n, i) => n ? [i] : []))
    const missingBySuit = [0,1,2,3].map(suit => [...allowed].filter(i => allowedByLaizi(suit, i) && !physical.has(i)))
    if (wild.some((n, suit) => n > missingBySuit[suit].length)) continue
    const choices = missingBySuit.map((items, suit) => combinations(items, wild[suit]))
    for (const a of choices[0]) for (const b of choices[1]) for (const c of choices[2]) for (const d of choices[3]) {
      const selected = [...a, ...b, ...c, ...d]
      if (physical.size + selected.length !== 14) continue
      out.push({ kind: 'allUnrelated', groups: [{ type: 'special', tiles: [...physical, ...selected].sort((x,y) => x-y) }], assignments: selected.flatMap(tile => assignmentList(tile, 1)) })
    }
  }
  return out
}

export function enumerateWinningDecompositions(counts, wild, fixedKongs = []) {
  const all = [
    ...enumerateStandard(counts, wild, fixedKongs),
    ...enumerateSevenPairs(counts, wild, fixedKongs),
    ...enumerateThirteenOrphans(counts, wild, fixedKongs),
    ...enumerateInvertedKunlun(counts, wild, fixedKongs),
    ...enumerateImperialPureDragon(counts, wild, fixedKongs),
    ...enumerateImperialFlowerDragon(counts, wild, fixedKongs),
    ...enumerateImperialCombinationDragon(counts, wild, fixedKongs),
    ...enumerateAllUnrelated(counts, wild, fixedKongs),
    ...enumerateCombinationDragon(counts, wild, fixedKongs)
  ]
  const seen = new Set()
  return all.filter(solution => {
    const key = `${solution.kind}|${solution.groups.map(groupKey).sort().join('|')}|${solution.assignments.map(a => `${a.laizi}>${a.as}`).sort().join(',')}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}
