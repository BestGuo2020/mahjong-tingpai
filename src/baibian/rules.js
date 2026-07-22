import { INVERTED_KUNLUN_TILES, rankOf, suitOf, tileName } from './tiles.js'

export const CAPS = { small: 3000, big: 4000, top: 6000, hard: 9000 }
export const CATEGORY_NAMES = { small: '小胡', big: '大胡', top: '顶胡', hard: '硬胡', super: '超级硬胡' }
const categoryWeight = { small: 0, big: 1, top: 2, hard: 3, super: 4 }

const additive = (id, name, value, category, test, extra = {}) => ({ id, name, kind: 'add', value, category, test, ...extra })

// 截图中的“一条龙”“十八罗汉”“幺九”分别使用现有规则的规范 ID。
export const RULE_ALIASES = Object.freeze({
  yi_tiao_long: 'qing_long',
  shi_ba_luo_han: 'si_gang_zi',
  yao_jiu: 'dai_yao_jiu'
})

// 规则图只把这些番型作为“不计”目标引用，当前规则没有为它们提供独立番值。
// 显式保留这些规范 ID，避免关系表中的拼写错误被静默忽略。
export const REFERENCE_ONLY_RULE_IDS = Object.freeze([
  'peng_peng_hu',
  'dan_diao_ruan_hu',
  'san_tong_shun',
  'lian_liu'
])

// 唯一的“不计”数据源。只在说明中出现、没有独立番值的规则仍保留 ID，
// 但在它们拥有计分规则之前不会凭空进入 matched 列表。
export const EXCLUSION_RELATIONS = Object.freeze({
  lian_qi_dui: ['qing_yi_se', 'lian_liu_dui', 'dan_diao_ruan_hu'],
  yi_se_shuang_long: ['qing_yi_se', 'shuang_lao_shao_fu', 'lao_shao_fu'],
  da_qi_xing: ['zi_yi_se', 'san_yuan_qi_dui', 'si_xi_qi_dui', 'dan_diao_ruan_hu'],
  shi_san_yao: ['dai_yao_jiu', 'dan_diao_ruan_hu', 'wu_men_qi', 'hun_yao_jiu'],
  jiu_lian_bao_deng: ['qing_yi_se', 'lao_shao_fu'],
  long_yu_si_fang_hua: ['hua_long'],
  long_yu_si_fang_qing: ['qing_long'],
  long_yu_si_fang_zuhe: ['zu_he_long'],
  hong_kong_que: ['hun_yi_se'],
  lv_yi_se: ['duan_hong', 'qing_duan_hong', 'hun_yi_se'],
  bai_wan_shi: ['qing_yi_se'],
  hei_yi_se: ['hun_yi_se', 'duan_hong', 'qing_duan_hong'],
  zhong_yuan_yi_dian_hong: ['dan_qing_liu_cai', 'dan_diao_ruan_hu'],
  jiang_jiang_hu: ['duan_yao_jiu'],
  qing_yao_jiu: ['quan_dan', 'dai_yao_jiu', 'hun_yao_jiu'],
  chun_zheng_shi_quan: ['peng_peng_hu'],
  chun_zheng_jiu_wu: ['quan_dan'],
  quan_da: ['da_yu_wu'],
  quan_zhong: ['duan_yao_jiu'],
  quan_xiao: ['xiao_yu_wu'],
  qing_duan_hong: ['duan_hong'],
  quan_shuang: ['duan_yao_jiu'],
  er_shi_liu_jin_fo: ['san_gang_zi', 'si_gang_zi', 'er_shi_er_tian_wang'],
  si_bu_gao: ['san_bu_gao', 'lao_shao_fu'],
  hun_shuang_long: ['hun_yi_se', 'shuang_lao_shao_fu', 'lao_shao_fu'],
  xiao_qi_xing: ['zi_yi_se', 'san_yuan_qi_dui', 'si_xi_qi_dui'],
  hun_bai_wan_shi: ['hun_yi_se'],
  da_si_xi: ['peng_peng_hu', 'san_feng_ke', 'dai_yao_jiu', 'xiao_si_xi', 'dan_diao_ruan_hu'],
  da_san_yuan: ['shuang_jian_ke', 'xiao_san_yuan'],
  si_tong_shun: ['san_lian_ke', 'yi_ban_gao', 'san_tong_shun', 'dan_diao_ruan_hu'],
  xi_bei_wan_chong_shan: ['xiao_xi_bei'],
  cai_yuan_gun_gun: ['xiao_cai_yuan'],
  kong_que_dong_nan_fei: ['xiao_kong_que'],
  xiao_si_xi: ['san_feng_ke', 'xiao_san_feng'],
  shuang_lao_shao_fu: ['lao_shao_fu'],
  si_xi_qi_dui: ['dan_diao_ruan_hu'],
  zi_yi_se: ['peng_peng_hu', 'hun_yao_jiu', 'dai_yao_jiu'],
  san_tong_ke: ['shuang_tong_ke'],
  shuang_shuang_tong_ke: ['shuang_tong_ke'],
  san_yuan_qi_dui: ['shuang_jian_ke', 'dan_diao_ruan_hu'],
  hun_yao_jiu: ['peng_peng_hu', 'dai_yao_jiu', 'hun_dan'],
  er_shi_er_tian_wang: ['san_gang_zi', 'si_gang_zi'],
  qi_xing_bu_kao: ['wu_men_qi', 'quan_bu_kao'],
  quan_bu_kao: ['wu_men_qi'],
  si_lian_ke: ['san_lian_ke'],
  xiao_san_yuan: ['shuang_jian_ke'],
  san_lian_ke: ['san_tong_shun', 'lian_liu'],
  san_feng_ke: ['xiao_san_feng'],
  qing_long: ['lian_liu', 'lao_shao_fu'],
  si_gang_zi: ['san_gang_zi']
})

function buildFacts(ctx) {
  const counts = ctx.finalCounts
  const ids = counts.flatMap((n, id) => Array(n).fill(id))
  const numbered = ids.filter(id => id < 27)
  const honors = ids.filter(id => id >= 27)
  const usedSuits = [...new Set(numbered.map(suitOf))]
  const melds = ctx.solution.groups.filter(g => ['sequence', 'pung', 'kong'].includes(g.type))
  const sequences = melds.filter(g => g.type === 'sequence')
  const pungs = melds.filter(g => g.type === 'pung' || g.type === 'kong')
  const pairGroups = ctx.solution.groups.filter(g => g.type === 'pair')
  const pair = pairGroups[0]?.tiles[0]
  const honorGroups = ctx.solution.groups.filter(g => ['pung', 'kong', 'pair'].includes(g.type) && g.tiles[0] >= 27)
  const pungTiles = pungs.map(g => g.tiles[0])
  const sequenceStarts = sequences.map(g => g.tiles[0])
  const allGroups = [...melds, ...pairGroups]
  const hasPung = id => pungTiles.includes(id)
  const hasSequence = start => sequenceStarts.includes(start)
  const countSequences = start => sequenceStarts.filter(x => x === start).length
  const allNumberRanks = predicate => numbered.length > 0 && numbered.every(id => predicate(rankOf(id)))
  const allTiles = predicate => ids.length > 0 && ids.every(predicate)
  const allMelds = predicate => melds.length > 0 && melds.every(predicate)
  const pungRankSuitCount = rank => new Set(pungTiles.filter(id => id < 27 && rankOf(id) === rank).map(suitOf)).size
  const windPungTiles = pungTiles.filter(id => id >= 27 && id <= 30)
  const windPungs = [...new Set(windPungTiles)]
  const dragonPungs = [31,32,33].filter(hasPung)
  const hasHonorPair = pairGroups.some(group => group.tiles[0] >= 27)
  // 除混一色、混幺九外，“混”只能包含一个完整的字牌刻、杠或将，不能再夹带其他字牌组。
  const hasExactlyOneHonorGroup = honorGroups.length === 1 && honors.length === honorGroups[0].tiles.length
  const isSevenPairs = ctx.solution.kind === 'sevenPairs'
  const pairTiles = ctx.solution.groups.filter(g => g.type === 'pair').map(g => g.tiles[0]).sort((a,b) => a-b)
  return { counts, ids, numbered, honors, usedSuits, melds, sequences, pungs, pair, pairGroups, honorGroups, pungTiles, sequenceStarts, allGroups, hasPung, hasSequence, countSequences, allNumberRanks, allTiles, allMelds, pungRankSuitCount, windPungTiles, windPungs, dragonPungs, hasHonorPair, hasExactlyOneHonorGroup, isSevenPairs, pairTiles }
}

const consecutive = (values, length, step = 1) => {
  const unique = [...new Set(values)].sort((a,b) => a-b)
  return unique.some(start => Array.from({ length }, (_, i) => start + i * step).every(v => unique.includes(v)))
}
const pairsConsecutive = (pairs, n) => {
  for (let suit = 0; suit < 3; suit++) {
    const ranks = pairs.filter(id => suitOf(id) === suit).map(rankOf)
    if (consecutive(ranks, n)) return true
  }
  return false
}
const hasAllPungs = (f, ids) => ids.every(f.hasPung)
const twoPungsAndPair = (f, ids) => {
  const matchingPungs = f.pungTiles.filter(id => ids.includes(id))
  const distinctPungs = new Set(matchingPungs)
  return matchingPungs.length === 2 && distinctPungs.size === 2 && ids.includes(f.pair) && !distinctPungs.has(f.pair)
}
const isMixedRankFamily = (f, predicate) => f.numbered.length > 0 && f.hasExactlyOneHonorGroup && f.allNumberRanks(predicate)
const isMixedDoubleDragon = f => f.hasExactlyOneHonorGroup && f.hasHonorPair && f.usedSuits.length === 1 && [0,1,2].some(suit => f.countSequences(suit * 9) >= 2 && f.countSequences(suit * 9 + 6) >= 2)
const isNineFiveNumberStructure = f => f.numbered.length > 0 && f.sequences.length === 0 && f.allNumberRanks(rank => [5,9].includes(rank)) && [5,9].every(rank => f.numbered.some(id => rankOf(id) === rank))

export const RULE_CATALOG = [
  additive('lian_qi_dui','连七对',2800,'top',f => f.isSevenPairs && pairsConsecutive(f.pairTiles, 7), { superCap: 10000 }),
  additive('yi_se_shuang_long','一色双龙会',2800,'top',f => !f.honors.length && f.usedSuits.length === 1 && f.sequences.filter(g => rankOf(g.tiles[0]) === 1).length >= 2 && f.sequences.filter(g => rankOf(g.tiles[0]) === 7).length >= 2 && f.pair != null && f.pair < 27 && rankOf(f.pair) === 5, { superCap: 10000 }),
  additive('da_qi_xing','大七星',2800,'top',f => f.isSevenPairs && f.pairTiles.every(id => id >= 27), { superCap: 15000 }),
  additive('long_yu_si_fang_hua','龙御四方（花龙）',2500,'top',(_f,ctx) => ctx.solution.kind === 'imperialFlowerDragon'),
  additive('long_yu_si_fang_qing','龙御四方（清龙）',2500,'top',(_f,ctx) => ctx.solution.kind === 'imperialPureDragon'),
  additive('long_yu_si_fang_zuhe','龙御四方（组合龙）',2500,'top',(_f,ctx) => ctx.solution.kind === 'imperialCombinationDragon'),
  additive('dao_zhuan_kun_lun','倒转昆仑',2500,'top',f => new Set(f.ids).size >= 13 && f.ids.every(id => INVERTED_KUNLUN_TILES.includes(id))),
  additive('shi_san_yao','十三幺／国士无双',2500,'top',(f,ctx) => ctx.solution.kind === 'thirteenOrphans'),
  additive('jiu_lian_bao_deng','九莲宝灯',2500,'top',isNineGates,{ superWhen: f => isPureDragon(f), superCap: 10000 }),
  additive('hong_kong_que','红孔雀',1500,'top',f => f.ids.every(id => [18,22,24,26,31].includes(id)) && f.ids.some(id => id === 31)),
  additive('lv_yi_se','绿一色',1500,'top',f => f.ids.every(id => [19,20,21,23,25,32].includes(id))),
  additive('bai_wan_shi','百万石',1500,'top',f => f.numbered.length === f.ids.length && f.usedSuits.length === 1 && f.usedSuits[0] === 0 && f.numbered.reduce((s,id) => s + rankOf(id),0) >= 100),
  additive('hei_yi_se','黑一色',1500,'top',f => f.ids.every(id => [10,12,16,27,28,29,30].includes(id))),
  additive('zhong_yuan_yi_dian_hong','中原一点红',1200,'top',f => f.ids.includes(31) && f.ids.every(id => id === 31 || (suitOf(id) === 1 && [1,3,5,6,7,9].includes(rankOf(id))))),
  additive('san_sheng_wan_wu','三生万物',1200,'top',f => f.ids.every(id => id < 27 && [3,6,9].includes(rankOf(id))) && f.sequences.length === 0),
  additive('man_jiu_zhou','满九州结克',1200,'top',f => f.ids.every(id => id < 27 && [1,4,7].includes(rankOf(id))) && f.sequences.length === 0),
  additive('jiang_jiang_hu','将将胡',1200,'top',f => f.ids.every(id => id < 27 && [2,5,8].includes(rankOf(id))) && f.sequences.length === 0),
  additive('qing_yao_jiu','清幺九',1000,'top',f => f.ids.every(id => id < 27 && [1,9].includes(rankOf(id))) && f.sequences.length === 0),
  additive('chun_zheng_shi_quan','纯正十全十美',1000,'top',f => tenPerfectPairs(f) >= 2 && f.pair != null && f.pair < 27 && rankOf(f.pair) === 5,{ superCap: 12000 }),
  additive('chun_zheng_jiu_wu','纯正九五至尊',1000,'top',f => !f.honors.length && isNineFiveNumberStructure(f)),
  additive('quan_da','全大',600,'top',f => !f.honors.length && f.allNumberRanks(r => r >= 7)),
  additive('quan_zhong','全中',600,'top',f => !f.honors.length && f.allNumberRanks(r => r >= 4 && r <= 6)),
  additive('quan_xiao','全小',600,'top',f => !f.honors.length && f.allNumberRanks(r => r <= 3)),
  additive('qing_duan_hong','清断红胡',500,'top',f => !f.honors.length && f.ids.every(isBrokenRedTile)),
  additive('quan_shuang','全双',500,'top',f => !f.honors.length && f.allNumberRanks(r => r % 2 === 0)),
  additive('quan_dan','全单',500,'top',f => !f.honors.length && f.allNumberRanks(r => r % 2 === 1)),
  additive('dan_qing_liu_cai','丹青流彩',400,'top',f => f.ids.every(id => [18,22,24,26,9,11,13,14,15,17].includes(id))),

  additive('si_bu_gao','四步高',2700,'big',f => stepHigh(f,4),{ promoteWhen: f => f.usedSuits.length === 1 && !f.honors.length, superWhen: f => f.usedSuits.length === 1 && !f.honors.length, superCap: 10000 }),
  additive('hun_shuang_long','混双龙会',1800,'big',isMixedDoubleDragon),
  additive('xiao_qi_xing','小七星',1800,'big',f => f.isSevenPairs && f.pairTiles.filter(id => id >= 27).length === 6),
  additive('qi_xing_bu_kao','七星不靠',1800,'big',(f,ctx) => ctx.solution.kind === 'allUnrelated' && [27,28,29,30,31,32,33].every(id => f.counts[id] === 1)),
  additive('lian_liu_dui','连六对',1500,'small',f => f.isSevenPairs && pairsConsecutive(f.pairTiles,6),{ categoryWith:{ qing_yi_se:'top', hun_yi_se:'big' } }),
  additive('zu_he_long','组合龙',1000,'big',(f,ctx) => isCombinationDragon(f) || ctx.solution.kind === 'imperialCombinationDragon',{ superWhen:(f,ctx)=>ctx.solution.kind==='allUnrelated',superCap:10000 }),
  additive('hun_bai_wan_shi','混百万石',1000,'big',f => f.usedSuits.length === 1 && f.usedSuits[0] === 0 && f.hasExactlyOneHonorGroup && f.numbered.reduce((s,id) => s + rankOf(id),0) >= 100),
  additive('san_bu_gao','三步高',1000,'big',f => stepHigh(f,3)),
  additive('da_si_xi','大四喜',900,'big',f => [27,28,29,30].every(f.hasPung),{ superWhen: f => f.ids.every(id => id >= 27) || isMixedTerminals(f) || isBrokenRed(f), superCap: 12000 }),
  additive('da_san_yuan','大三元',800,'big',f => [31,32,33].every(f.hasPung)),
  additive('quan_bu_kao','全不靠',800,'big',(f,ctx) => ctx.solution.kind === 'allUnrelated'),
  additive('si_tong_shun','四同顺',600,'big',f => f.sequenceStarts.some(start => f.countSequences(start) >= 4),{ superWhen: f => f.usedSuits.length === 1 && !f.honors.length, superCap: 10000 }),
  additive('xi_nan_cui_zhu_hai','西南翠竹海',500,'big',f => f.hasPung(28) && f.hasPung(29) && [19,20,21,23,25].some(f.hasPung),{ promoteWith: 'duan_hong' }),
  additive('xi_bei_wan_chong_shan','西北万重山',500,'big',f => hasAllPungs(f,[29,30,8]),{ promoteWith: 'hun_yao_jiu' }),
  additive('cai_yuan_gun_gun','财源滚滚',500,'big',f => hasAllPungs(f,[32,9,17]),{ promoteWith: 'hun_yao_jiu' }),
  additive('kong_que_dong_nan_fei','孔雀东南飞',500,'big',f => hasAllPungs(f,[18,27,28]),{ promoteWith: 'hun_yao_jiu' }),
  additive('dong_bei_hei_shui_zhai','东北黑水寨',500,'big',f => f.hasPung(27) && f.hasPung(30) && [10,12,16].some(f.hasPung),{ promoteWith: 'duan_hong' }),
  additive('xiao_si_xi','小四喜',500,'big',f => f.windPungTiles.length === 3 && f.windPungs.length === 3 && [27,28,29,30].includes(f.pair) && !f.windPungs.includes(f.pair)),
  additive('shuang_lao_shao_fu','双老少副',500,'big',f => countOldYoung(f) >= 2),
  additive('jiu_wu_zhi_zun','九五至尊',500,'top',f => f.hasExactlyOneHonorGroup && isNineFiveNumberStructure(f)),
  additive('hua_long','花龙',500,'big',(f,ctx) => isFlowerDragon(f) || ctx.solution.kind === 'imperialFlowerDragon'),
  additive('wu_men_qi','五门齐',500,'small',f => [0,1,2].every(s => f.usedSuits.includes(s)) && f.ids.some(id => id >= 27 && id <= 30) && f.ids.some(id => id >= 31)),
  additive('si_xi_qi_dui','四喜七对',400,'big',f => f.isSevenPairs && [27,28,29,30].every(id => f.counts[id] >= 2)),
  additive('tui_bu_dao','推不倒',400,'big',f => f.ids.every(id => [9,10,11,12,13,17,19,20,21,23,24,25,33].includes(id))),
  additive('zi_yi_se','字一色',300,'big',f => f.ids.every(id => id >= 27)),
  additive('san_tong_ke','三同刻',300,'big',f => [1,2,3,4,5,6,7,8,9].some(rank => f.pungRankSuitCount(rank) === 3)),
  additive('shi_quan_shi_mei','十全十美',300,'big',f => tenPerfectPairs(f) >= 2 && f.hasHonorPair),
  additive('si_lian_ke','四连刻',300,'small',f => consecutivePungs(f,4),{
    categoryWith:{ qing_yi_se:'top' },
    superWhen: f => f.usedSuits.length === 1 && !f.honors.length,
    superCap:10000
  }),
  additive('hun_jiang_hu','混将胡',200,'big',f => isMixedRankFamily(f, rank => [2,5,8].includes(rank))),
  additive('shuang_shuang_tong_ke','双双同刻',200,'big',f => [1,2,3,4,5,6,7,8,9].filter(rank => f.pungRankSuitCount(rank) >= 2).length >= 2),
  additive('san_yuan_qi_dui','三元七对',200,'big',f => f.isSevenPairs && [31,32,33].every(id => f.counts[id] >= 2)),
  additive('hun_zhong','混中',200,'big',f => isMixedRankFamily(f, rank => rank >= 4 && rank <= 6)),
  additive('hun_xiao','混小',200,'big',f => isMixedRankFamily(f, rank => rank <= 3)),
  additive('hun_da','混大',200,'big',f => isMixedRankFamily(f, rank => rank >= 7)),
  additive('xiao_san_yuan','小三元',150,'small',f => twoPungsAndPair(f,[31,32,33])),
  additive('xiao_xi_bei','小西北万重山',150,'small',f => twoPungsAndPair(f,[29,30,8])),
  additive('xiao_cai_yuan','小财源滚滚',150,'small',f => twoPungsAndPair(f,[32,9,17])),
  additive('qi_dui','七对',150,'small',f => f.isSevenPairs),
  additive('san_lian_ke','三连刻',150,'small',f => consecutivePungs(f,3)),
  additive('san_feng_ke','三风刻',150,'small',f => f.windPungs.length === 3),
  additive('xiao_kong_que','小孔雀东南飞',150,'small',f => twoPungsAndPair(f,[18,27,28])),
  additive('da_yu_wu','大于五',100,'small',f => !f.honors.length && f.allNumberRanks(r => r >= 6)),
  additive('hun_shuang','混双',100,'small',f => isMixedRankFamily(f, rank => rank % 2 === 0)),
  additive('duan_hong','断红胡',100,'big',isBrokenRed),
  additive('shuang_jian_ke','双箭刻',100,'small',f => f.dragonPungs.length === 2),
  additive('xiao_yu_wu','小于五',100,'small',f => !f.honors.length && f.allNumberRanks(r => r <= 4)),
  additive('xiao_san_feng','小三风',100,'small',f => f.windPungTiles.length === 2 && f.windPungs.length === 2 && [27,28,29,30].includes(f.pair) && !f.windPungs.includes(f.pair)),
  additive('lao_shao_fu','老少副',100,'small',f => countOldYoung(f) >= 1),
  additive('shuang_tong_ke','双同刻',100,'small',f => [1,2,3,4,5,6,7,8,9].some(rank => f.pungRankSuitCount(rank) >= 2)),
  additive('qing_yi_se','清一色',100,'small',f => f.usedSuits.length === 1 && !f.honors.length),
  additive('hun_dan','混单',100,'small',f => isMixedRankFamily(f, rank => rank % 2 === 1)),
  additive('qing_long','清龙（一条龙）',100,'small',isPureDragon),
  additive('duan_yao_jiu','断幺九',50,'small',f => !f.honors.length && f.allNumberRanks(r => r !== 1 && r !== 9)),
  additive('yi_ban_gao','一般高',50,'small',f => f.sequenceStarts.some(start => f.countSequences(start) >= 2)),
  additive('dai_yao_jiu','带幺九',50,'small',f => f.allGroups.length > 0 && f.allGroups.every(group => group.tiles.some(id => id >= 27 || [1,9].includes(rankOf(id))))),
  additive('hun_yi_se','混一色',50,'small',f => f.usedSuits.length === 1 && f.honors.length > 0),
  additive('hun_yao_jiu','混幺九',100,'big',isMixedTerminals)
]

function isBrokenRedTile(id) {
  if (id >= 27) return id !== 31
  if (suitOf(id) === 0) return false
  if (suitOf(id) === 1) return [2,4,8].includes(rankOf(id))
  return [2,3,4,6,8].includes(rankOf(id))
}
function isBrokenRed(f) { return f.ids.every(isBrokenRedTile) }
function isMixedTerminals(f) { return f.ids.every(id => id >= 27 || [1,9].includes(rankOf(id))) && f.sequences.length === 0 }
function isPureDragon(f) { return [0,1,2].some(s => [0,3,6].every(r => f.hasSequence(s*9+r))) }
function isFlowerDragon(f) {
  return [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].some(order => f.hasSequence(order[0]*9) && f.hasSequence(order[1]*9+3) && f.hasSequence(order[2]*9+6))
}
function isCombinationDragon(f) {
  return [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].some(order => {
    const needed = [[1,4,7],[2,5,8],[3,6,9]].flatMap((ranks,i) => ranks.map(rank => order[i]*9+rank-1))
    return needed.every(id => f.counts[id] > 0)
  })
}
function isNineGates(f) {
  if (f.usedSuits.length !== 1 || f.honors.length || f.ids.length !== 14) return false
  const suit = f.usedSuits[0], base=suit*9
  return f.counts[base] >= 3 && f.counts[base+8] >= 3 && Array.from({length:7},(_,i)=>base+i+1).every(id => f.counts[id] >= 1)
}
function stepHigh(f,n) {
  for (let suit=0;suit<3;suit++) {
    const starts=f.sequenceStarts.filter(id=>suitOf(id)===suit).map(rankOf)
    if (consecutive(starts,n,1) || consecutive(starts,n,2)) return true
  }
  return false
}
function consecutivePungs(f,n) {
  for(let suit=0;suit<3;suit++) if(consecutive(f.pungTiles.filter(id=>suitOf(id)===suit).map(rankOf),n)) return true
  return false
}
function countOldYoung(f) {
  let total=0
  for(let suit=0;suit<3;suit++) total+=Math.min(f.countSequences(suit*9),f.countSequences(suit*9+6))
  return total
}
function tenPerfectPairs(f) {
  let total=0
  for(let suit=0;suit<3;suit++) for(const [a,b] of [[1,9],[2,8],[3,7],[4,6]]) if(f.hasPung(suit*9+a-1)&&f.hasPung(suit*9+b-1)) total++
  return total
}

function rootMultipliers(physicalCounts) {
  const table = { 4:2, 5:2.5, 6:3, 7:4, 8:5, 9:6, 10:7, 11:8, 12:9 }
  return physicalCounts.flatMap((n,id) => table[n] ? [{ id:`root_${id}`, name:`${['','一','二','三','四','五','六','七','八','九','十','十一','十二'][n]}根（${tileName(id)}）`, value:table[n], kind:'multiply' }] : [])
}

export const canonicalRuleId = id => RULE_ALIASES[id] || id

export function resolveExclusions(rules) {
  const byId = new Map(rules.map(rule => [canonicalRuleId(rule.id), rule]))
  const suppressedById = new Map()

  for (const [rawSourceId, rawTargetIds] of Object.entries(EXCLUSION_RELATIONS)) {
    const source = byId.get(canonicalRuleId(rawSourceId))
    if (!source) continue
    for (const rawTargetId of rawTargetIds) {
      const targetId = canonicalRuleId(rawTargetId)
      const target = byId.get(targetId)
      if (!target || targetId === canonicalRuleId(source.id)) continue
      if (!suppressedById.has(targetId)) suppressedById.set(targetId, new Map())
      suppressedById.get(targetId).set(source.id, { id: source.id, name: source.name })
    }
  }

  const kept = rules.filter(rule => !suppressedById.has(canonicalRuleId(rule.id)))
  const suppressed = rules.filter(rule => suppressedById.has(canonicalRuleId(rule.id))).map(rule => ({
    id: rule.id,
    name: rule.name,
    kind: rule.kind,
    value: rule.value,
    suppressedBy: [...suppressedById.get(canonicalRuleId(rule.id)).values()]
  }))
  return { kept, suppressed }
}

export function scoreSolution(context) {
  const facts = buildFacts(context)
  const rawAdditive = RULE_CATALOG.filter(rule => rule.test(facts, context))
  const rawMultipliers = rootMultipliers(context.physicalCounts)
  const kongCount = context.kongs.length
  const physicalTotal = context.physicalTileTotal ?? context.physicalCounts.reduce((a,b)=>a+b,0)
  if (kongCount >= 3) rawMultipliers.push({ id:'san_gang_zi', name:'三杠子／十二金钗', kind:'multiply', value:1.5 })
  if (kongCount >= 4) rawMultipliers.push({
    id:'si_gang_zi', name:'四杠子／十八罗汉', kind:'multiply', value:8,
    categoryWith:{ qing_yi_se:'top', zi_yi_se:'top' }
  })
  if (kongCount === 4 && physicalTotal >= 22) rawMultipliers.push({
    id:'er_shi_er_tian_wang', name:'二十二天王', kind:'multiply', value:16, category:'big',
    categoryWith:{ hun_yi_se:'top', qing_yi_se:'top', zi_yi_se:'top' }
  })
  if (kongCount === 4 && physicalTotal >= 26) rawMultipliers.push({ id:'er_shi_liu_jin_fo', name:'二十六金佛', kind:'multiply', value:32, category:'top' })
  for(let i=0;i<context.laiziKongs;i++) rawMultipliers.push({ id:`laizi_kong_${i}`, name:'赖子杠', kind:'multiply', value:1.5 })
  if (context.flags?.tianHu) rawMultipliers.push({ id:'tian_hu', name:'天胡', kind:'multiply', value:20, category:'top' })
  if (context.flags?.gangShangKaiHua) rawMultipliers.push({ id:'gang_shang_kai_hua', name:'杠上开花', kind:'multiply', value:2, category:'top' })
  if (context.flags?.tianHuBonus) rawMultipliers.push({ id:'tian_hu_bonus', name:'天胡加成', kind:'multiply', value:2 })
  const hasActiveLaizi = context.activeWildCount > 0
  if (!hasActiveLaizi) rawMultipliers.push({ id:'ying_hu', name:'硬胡', kind:'multiply', value:3, category:'hard' })

  const { kept, suppressed } = resolveExclusions([...rawAdditive, ...rawMultipliers])
  let matched = kept.filter(rule => rule.kind === 'add')
  const multipliers = kept.filter(rule => rule.kind === 'multiply')
  if (!matched.length) matched = [{ id:'ji_hu', name:'鸡胡', kind:'add', value:20, category:'small' }]

  let category = [...matched, ...multipliers].reduce((best, rule) => categoryWeight[rule.category] > categoryWeight[best] ? rule.category : best, 'small')
  let superCap = 0
  const scoredRules = [...matched, ...multipliers]
  const ids = new Set(scoredRules.map(rule => rule.id))
  for (const rule of scoredRules) {
    for (const [otherId, promotedCategory] of Object.entries(rule.categoryWith || {})) {
      if (ids.has(otherId) && categoryWeight[promotedCategory] > categoryWeight[category]) category = promotedCategory
    }
    if (rule.promoteWith && ids.has(rule.promoteWith) && categoryWeight.top > categoryWeight[category]) category = 'top'
    if (rule.promoteWhen?.(facts, context) && categoryWeight.top > categoryWeight[category]) category = 'top'
    if (!hasActiveLaizi && rule.superCap && (!rule.superWhen || rule.superWhen(facts, context))) { category = 'super'; superCap = Math.max(superCap, rule.superCap) }
  }

  const additiveTotal = matched.reduce((sum, rule) => sum + rule.value, 0)
  const multiplier = multipliers.reduce((product, rule) => product * rule.value, 1)
  const theoretical = additiveTotal * multiplier
  const cap = category === 'super' ? superCap : CAPS[category]
  const actual = Math.min(theoretical, cap)
  return { additive:matched, multipliers, suppressed, additiveTotal, multiplier, theoretical, actual, cap, category, categoryName:CATEGORY_NAMES[category], facts }
}
