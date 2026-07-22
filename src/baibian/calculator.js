import { BASE_TILES, LAIZI_TILES, idsToCounts, laiziCounts, tileName } from './tiles.js'
import { enumerateWinningDecompositions } from './winEngine.js'
import { scoreSolution } from './rules.js'

export function knownPhysicalCounts(state) {
  const counts = idsToCounts([...state.hand, ...(state.discards || [])])
  state.kongs.forEach(kong => { counts[kong.tile] += kongSize(kong) })
  return counts
}

export function kongSize(kong) {
  return kong.size ?? 4
}

export function availableKongOptions(hand, tile, establishedKongCount = 0) {
  const copies = hand.filter(id => id === tile).length
  const maxGroups = Math.max(0, Math.min(Math.floor(copies / 4), 4 - establishedKongCount))
  const options = []

  function chooseSizes(groupsLeft, remaining, minimum, sizes) {
    if (!groupsLeft) {
      const selected = [...sizes]
      options.push({ sizes:selected, total:selected.reduce((sum,size)=>sum+size,0) })
      return
    }
    const maxSize = remaining - (groupsLeft - 1) * 4
    for (let size=minimum;size<=maxSize;size++) chooseSizes(groupsLeft-1,remaining-size,size,[...sizes,size])
  }

  for (let groupCount=1;groupCount<=maxGroups;groupCount++) chooseSizes(groupCount,copies,4,[])
  return options
}

export function completedPhysicalCounts(hand, kongs) {
  const counts = idsToCounts(hand)
  kongs.forEach(kong => { counts[kong.tile] += kongSize(kong) })
  return counts
}

export function validateState(state) {
  if (state.kongs.some(kong => !Number.isInteger(kongSize(kong)) || kongSize(kong) < 4)) return '普通杠每组至少需要4张牌'
  const known = knownPhysicalCounts(state)
  const over = known.findIndex(n => n > 12)
  if (over >= 0) return `${tileName(over)}在暗手牌和杠组中合计超过12张`
  if (state.kongs.length > 4) return '普通杠组最多占用四个面子'
  const structural = state.hand.length + state.kongs.length * 3
  if (structural > 14) return '当前有效结构牌数超过14张'
  return ''
}

function finalCountsFor(solution, physicalCounts) {
  const counts = [...physicalCounts]
  solution.assignments.forEach(item => { counts[item.as]++ })
  return counts
}

function compareScored(a, b) {
  return b.score.actual - a.score.actual || b.score.theoretical - a.score.theoretical || b.score.additive.length - a.score.additive.length
}

function scoringSignature(item) {
  return [
    item.solution.kind,
    item.score.additive.map(rule => rule.id).sort().join(','),
    item.score.multipliers.map(rule => rule.id).sort().join(',')
  ].join('|')
}

function universalDistributions(total) {
  const out=[]
  for(let m=0;m<=total;m++) for(let p=0;p<=total-m;p++) for(let s=0;s<=total-m-p;s++) out.push([m,p,s,total-m-p-s])
  return out
}

function markUniversalAssignments(solution, specificCounts) {
  const remaining=[...specificCounts]
  const index={lm:0,lp:1,ls:2,lz:3}
  return {
    ...solution,
    assignments:solution.assignments.map(item => {
      const i=index[item.laizi]
      if(remaining[i]>0){ remaining[i]--; return item }
      return {...item,laizi:'la'}
    })
  }
}

export function calculateWaits(state) {
  const error = validateState(state)
  if (error) return { error, waits: [], structural: state.hand.length + state.kongs.length * 3 }
  const structural = state.hand.length + state.kongs.length * 3
  if (structural % 3 !== 1) return { error: `有效结构牌数为${structural}，需要满足3n+1才能计算听牌`, waits: [], structural }

  const known = knownPhysicalCounts(state)
  // 硬胡只看摸牌前的暗手：暗手无癞子时，胡到一张癞子仍算硬胡。
  const concealedWildCount = laiziCounts(state.hand).reduce((a,b)=>a+b,0)
  const candidates = [
    ...BASE_TILES.filter(id => known[id] < 12).map(id => ({ id, left:12-known[id] })),
    ...LAIZI_TILES.map(id => ({ id, left:Infinity }))
  ]
  const waits = []
  for (const candidate of candidates) {
    const hand = [...state.hand, candidate.id]
    const counts = idsToCounts(hand)
    const allWild = laiziCounts(hand)
    const specificWild=allWild.slice(0,4)
    const universal=allWild[4]
    const solutions = universalDistributions(universal).flatMap(distribution => {
      const allocated=specificWild.map((n,index)=>n+distribution[index])
      return enumerateWinningDecompositions(counts,allocated,state.kongs).map(solution=>markUniversalAssignments(solution,specificWild))
    })
    if (!solutions.length) continue
    const physicalCounts = completedPhysicalCounts(hand, state.kongs)
    const physicalTileTotal = hand.length + state.kongs.reduce((sum, kong) => sum + kongSize(kong), 0)
    const scored = solutions.map(solution => {
      const finalCounts = finalCountsFor(solution, physicalCounts)
      const score = scoreSolution({
        solution,
        finalCounts,
        physicalCounts,
        physicalTileTotal,
        kongs:state.kongs,
        laiziKongs:state.laiziKongs.length,
        activeWildCount:concealedWildCount,
        flags:state.flags
      })
      return { solution, score, finalCounts }
    }).sort(compareScored)
    const best = scored[0]
    const seenAlternatives = new Set([scoringSignature(best)])
    const alternatives = scored.filter(item => {
      const signature = scoringSignature(item)
      if (seenAlternatives.has(signature)) return false
      seenAlternatives.add(signature)
      return true
    }).slice(0,5)
    waits.push({ id:candidate.id, left:candidate.left, ...best, alternatives })
  }
  waits.sort((a,b) => b.score.actual-a.score.actual || b.score.theoretical-a.score.theoretical || String(a.id).localeCompare(String(b.id)))
  const theoreticalBest = [...waits].sort((a,b)=>b.score.theoretical-a.score.theoretical)[0] || null
  const actualBest = waits[0] || null
  return { error:'', waits, structural, theoreticalBest, actualBest }
}

export function describeSolution(solution) {
  const labels = { sequence:'顺子', pung:'刻子', kong:'杠', pair:'将', special:'特殊牌组', combinationDragon:'组合龙' }
  return solution.groups.map(group => ({
    type:labels[group.type] || group.type,
    tiles:group.tiles.map(tileName).join(' ')
  }))
}

export function describeAssignments(solution) {
  return solution.assignments.map(item => `${tileName(item.laizi)}→${tileName(item.as)}`)
}
