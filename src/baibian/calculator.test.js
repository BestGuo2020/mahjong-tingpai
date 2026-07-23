import { describe, expect, it } from 'vitest'
import { availableKongOptions, calculateWaits, completedPhysicalCounts, knownPhysicalCounts, validateState } from './calculator.js'
import {
  EXCLUSION_RELATIONS,
  REFERENCE_ONLY_RULE_IDS,
  RULE_ALIASES,
  RULE_CATALOG,
  canonicalRuleId,
  resolveExclusions,
  scoreSolution
} from './rules.js'
import { INVERTED_KUNLUN_TILES, parseTileCode } from './tiles.js'

const flags = { tianHu:false, gangShangKaiHua:false, tianHuBonus:false }

const pung = id => ({ type:'pung', tiles:[id,id,id] })
const kong = id => ({ type:'kong', tiles:[id,id,id,id], fixed:true })
const sequence = start => ({ type:'sequence', tiles:[start,start+1,start+2] })
const pair = id => ({ type:'pair', tiles:[id,id] })
const special = tiles => ({ type:'special', tiles })

function countsForGroups(groups) {
  const counts=Array(34).fill(0)
  groups.flatMap(group=>group.tiles).forEach(id=>counts[id]++)
  return counts
}

function scoreGroups(groups, options={}) {
  const finalCounts=options.finalCounts || countsForGroups(groups)
  return scoreSolution({
    solution:{kind:options.kind || 'standard',groups,assignments:options.assignments || []},
    finalCounts,
    physicalCounts:options.physicalCounts || finalCounts,
    physicalTileTotal:options.physicalTileTotal,
    kongs:options.kongs || [],
    laiziKongs:options.laiziKongs || 0,
    activeWildCount:options.activeWildCount || 0,
    flags:options.flags || flags
  })
}

function detectedIds(score) {
  return new Set([...score.additive,...score.multipliers,...score.suppressed].map(rule=>rule.id))
}

function physicalCountsWithTotal(total) {
  const counts=Array(34).fill(0)
  for(let i=0,left=total;left>0;i++) {
    const amount=Math.min(3,left)
    counts[i]=amount
    left-=amount
  }
  return counts
}

const EXPECTED_EXCLUSIONS = {
  lian_qi_dui: ['qing_yi_se', 'lian_liu_dui', 'dan_diao_ruan_hu'],
  yi_se_shuang_long: ['qing_yi_se', 'shuang_lao_shao_fu', 'lao_shao_fu'],
  da_qi_xing: ['zi_yi_se', 'san_yuan_qi_dui', 'si_xi_qi_dui', 'dan_diao_ruan_hu'],
  shi_san_yao: ['dai_yao_jiu', 'dan_diao_ruan_hu', 'wu_men_qi', 'hun_yao_jiu'],
  jiu_lian_bao_deng: ['qing_yi_se', 'lao_shao_fu'],
  long_yu_si_fang_hua: ['hua_long'],
  long_yu_si_fang_qing: ['qing_long'],
  long_yu_si_fang_zuhe: ['zu_he_long'],
  hong_kong_que: ['hun_yi_se', 'dan_qing_liu_cai'],
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
}

describe('百变斗牌计算器', () => {
  it('解析四种限花色癞子代码', () => {
    expect(parseTileCode('123m 456p 789s 123z lm lp ls lz la')).toEqual([0,1,2,12,13,14,24,25,26,27,28,29,'lm','lp','ls','lz','la'])
  })

  it('复现西南翠竹海听东、北为1500番顶胡', () => {
    const state = {
      hand:['lz',19,20,21,23,23,23,28,28,28],
      discards:[],
      kongs:[{tile:29,size:4}],
      laiziKongs:[], flags
    }
    const result=calculateWaits(state)
    for(const id of [27,30]) {
      const wait=result.waits.find(item=>item.id===id)
      expect(wait.score.additive.map(x=>x.name)).toEqual(expect.arrayContaining(['西南翠竹海','断红胡','小三风','混一色']))
      expect(wait.score.multipliers.map(x=>x.name)).toContain('四根（西）')
      expect(wait.score.theoretical).toBe(1500)
      expect(wait.score.actual).toBe(1500)
      expect(wait.score.categoryName).toBe('顶胡')
    }
  })

  it('癞子替代不增加实体根数', () => {
    const physical=Array(34).fill(0); physical[23]=4
    const final=[...physical]; final[23]=5
    const score=scoreSolution({
      solution:{kind:'standard',groups:[
        {type:'pung',tiles:[23,23,23]}, {type:'sequence',tiles:[0,1,2]},
        {type:'sequence',tiles:[9,10,11]}, {type:'pung',tiles:[27,27,27]}, {type:'pair',tiles:[23,23]}
      ],assignments:[{laizi:'ls',as:23}]},
      finalCounts:final, physicalCounts:physical, kongs:[], laiziKongs:0, activeWildCount:1, flags
    })
    expect(score.multipliers.map(x=>x.name)).toContain('四根（6条）')
    expect(score.multipliers.map(x=>x.name).some(name=>name.startsWith('五根'))).toBe(false)
  })

  it.each([
    ['一组8张',8,[8],5],
    ['两组4+4',8,[4,4],5],
    ['两组4+5',9,[4,5],6],
    ['两组4+4并留1张',9,[4,4],6],
    ['两组4+6',10,[4,6],7],
    ['两组5+5',10,[5,5],7],
    ['两组4+4并留2张',10,[4,4],7],
    ['两组4+5并留1张',10,[4,5],7],
    ['两组5+6',11,[5,6],8],
    ['三组4+4+4',12,[4,4,4],9]
  ])('%s按同牌实体总数只计算一个对应根', (_label,total,sizes,expectedMultiplier) => {
    const tile=22
    const physical=Array(34).fill(0); physical[tile]=total
    const kongs=sizes.map(size=>({tile,size}))
    const groups=kongs.map(item=>({type:'kong',tiles:Array(item.size).fill(tile),fixed:true}))
    const score=scoreGroups(groups,{finalCounts:physical,physicalCounts:physical,kongs,activeWildCount:1})
    const roots=score.multipliers.filter(rule=>rule.id.startsWith('root_'))
    expect(roots).toHaveLength(1)
    expect(roots[0]).toMatchObject({id:`root_${tile}`,value:expectedMultiplier})
    expect(roots[0].name).toContain(`${['','','','','四','五','六','七','八','九','十','十一','十二'][total]}根`)
  })

  it('不同牌种的根可以分别计算，但同牌多杠不会拆成多个低级根', () => {
    const physical=Array(34).fill(0); physical[0]=4; physical[22]=9
    const kongs=[{tile:0,size:4},{tile:22,size:4},{tile:22,size:5}]
    const groups=kongs.map(item=>({type:'kong',tiles:Array(item.size).fill(item.tile),fixed:true}))
    const score=scoreGroups(groups,{finalCounts:physical,physicalCounts:physical,kongs,activeWildCount:1})
    expect(score.multipliers.filter(rule=>rule.id.startsWith('root_')).map(rule=>[rule.id,rule.value])).toEqual([
      ['root_0',2],
      ['root_22',6]
    ])
  })

  it('万能赖可以替代任意花色并选择最高番方案', () => {
    const state={
      hand:['la',19,20,21,23,23,23,28,28,28],discards:[],
      kongs:[{tile:29,size:4}],laiziKongs:[],flags
    }
    const result=calculateWaits(state)
    const east=result.waits.find(item=>item.id===27)
    expect(east.score.actual).toBe(1500)
    expect(east.solution.assignments).toContainEqual({laizi:'la',as:27})
    expect(result.waits.some(item=>typeof item.id==='number' && item.id<27)).toBe(true)
  })

  it('多个癞子保留不同大牌解释，但不跨方案叠加计番', () => {
    const state={
      hand:[9,10,11,11,12,13,14,15,16,17,'la','la','la'],
      kongs:[],laiziKongs:[],flags
    }
    const result=calculateWaits(state)
    const east=result.waits.find(wait=>wait.id===27)
    const oneDot=result.waits.find(wait=>wait.id===9)
    const nineDot=result.waits.find(wait=>wait.id===17)

    expect(east.score.additive.map(rule=>rule.id)).toContain('si_bu_gao')
    expect(east.alternatives.some(item=>item.score.additive.some(rule=>rule.id==='long_yu_si_fang_qing'))).toBe(true)
    expect(oneDot.alternatives.some(item=>item.score.additive.some(rule=>rule.id==='jiu_lian_bao_deng'))).toBe(true)
    expect(nineDot.alternatives.some(item=>item.score.additive.some(rule=>rule.id==='jiu_lian_bao_deng'))).toBe(true)
    expect(east.score.additive.map(rule=>rule.id)).not.toContain('long_yu_si_fang_qing')
  })

  it('同一种牌可记录两个四张杠并遵守12张库存', () => {
    const state={hand:[],discards:[],kongs:[{tile:22},{tile:22}],laiziKongs:[],flags}
    expect(knownPhysicalCounts(state)[22]).toBe(8)
    expect(validateState(state)).toBe('')
    state.kongs.push({tile:22})
    expect(knownPhysicalCounts(state)[22]).toBe(12)
    state.discards.push(22)
    expect(validateState(state)).toContain('超过12张')
  })

  it.each([
    [5,2],
    [8,6],
    [9,8],
    [10,11],
    [11,14],
    [12,19]
  ])('暗手有%s张同牌时生成全部%s种合法杠组分配', (copies,expectedCount) => {
    const options=availableKongOptions(Array(copies).fill(22),22)
    expect(options).toHaveLength(expectedCount)
    expect(new Set(options.map(option=>option.sizes.join('+'))).size).toBe(options.length)
    for(const option of options) {
      expect(option.sizes.every(size=>size>=4)).toBe(true)
      expect(option.sizes).toEqual([...option.sizes].sort((a,b)=>a-b))
      expect(option.total).toBe(option.sizes.reduce((sum,size)=>sum+size,0))
      expect(option.total).toBeLessThanOrEqual(copies)
    }
  })

  it('多组杠允许不同张数、允许留下同牌且受剩余面子数限制', () => {
    expect(availableKongOptions(Array(9).fill(22),22).map(option=>option.sizes)).toEqual(expect.arrayContaining([[4,4],[4,5]]))
    expect(availableKongOptions(Array(10).fill(22),22).map(option=>option.sizes)).toEqual(expect.arrayContaining([[4,4],[4,5],[4,6],[5,5]]))
    expect(availableKongOptions(Array(12).fill(22),22).map(option=>option.sizes)).toContainEqual([4,4,4])
    expect(availableKongOptions(Array(12).fill(22),22,2).some(option=>option.sizes.length>2)).toBe(false)
    expect(availableKongOptions(Array(12).fill(22),22,4)).toEqual([])
  })

  it('实际杠组张数参与库存统计，缺少size的旧数据仍按4张处理', () => {
    const state={hand:[22],kongs:[{tile:22,size:5},{tile:22}],laiziKongs:[],flags}
    expect(knownPhysicalCounts(state)[22]).toBe(10)
    expect(completedPhysicalCounts([22,22],[{tile:22,size:6}])[22]).toBe(8)
    expect(validateState(state)).toBe('')
  })

  it('固定杠在胡牌拆分中保留实际张数，但仍只占一个面子', () => {
    const state={
      hand:[0,1,2,9,10,11,18,19,20,27],
      kongs:[{tile:31,size:5}],laiziKongs:[],flags
    }
    const result=calculateWaits(state)
    const east=result.waits.find(wait=>wait.id===27)
    expect(result.structural).toBe(13)
    expect(east).toBeTruthy()
    expect(east.solution.groups.find(group=>group.type==='kong')?.tiles).toEqual(Array(5).fill(31))
  })

  it('一组8张算一个面子，两组4+4算两个面子', () => {
    const oneGroup=calculateWaits({hand:[1,2,3,4,5,6,7,8,9,10],kongs:[{tile:0,size:8}],laiziKongs:[],flags})
    const twoGroups=calculateWaits({hand:[1,2,3,4,5,6,7],kongs:[{tile:0,size:4},{tile:0,size:4}],laiziKongs:[],flags})
    expect(oneGroup.structural).toBe(13)
    expect(twoGroups.structural).toBe(13)
  })

  it.each([
    [22,5,'er_shi_er_tian_wang'],
    [26,6,'er_shi_liu_jin_fo']
  ])('四组扩展杠与将牌合计%s张时命中特殊杠牌型', (total,size,ruleId) => {
    const kongs=[0,9,18,31].map(tile=>({tile,size}))
    const groups=[...kongs.map(item=>({type:'kong',tiles:Array(item.size).fill(item.tile),fixed:true})),pair(27)]
    const physical=completedPhysicalCounts([27,27],kongs)
    expect(physical.reduce((sum,count)=>sum+count,0)).toBe(total)
    const score=scoreGroups(groups,{finalCounts:physical,physicalCounts:physical,kongs,activeWildCount:1})
    expect(score.multipliers.map(rule=>rule.id)).toContain(ruleId)
  })

  it('counts a concealed laizi toward the 22-tile hand but excludes established laizi kongs', () => {
    const kongs=[0,9,18,31].map(tile=>({tile,size:5}))
    const result=calculateWaits({hand:['la'],kongs,laiziKongs:['lm'],flags})
    expect(result.error).toBe('')
    expect(result.waits.length).toBeGreaterThan(0)
    for (const wait of result.waits) {
      const ids=wait.score.multipliers.map(rule=>rule.id)
      expect(ids).toContain('er_shi_er_tian_wang')
      expect(ids).not.toContain('si_gang_zi')
      expect(ids).not.toContain('er_shi_liu_jin_fo')
    }
  })

  it.each([
    [21,[]],
    [22,['er_shi_er_tian_wang']],
    [23,['er_shi_er_tian_wang']],
    [24,['er_shi_er_tian_wang']],
    [25,['er_shi_er_tian_wang']],
    [26,['er_shi_liu_jin_fo']],
    [27,['er_shi_liu_jin_fo']]
  ])('uses reached thresholds for a four-kong physical total of %s', (physicalTileTotal,expected) => {
    const groups=[kong(0),kong(9),kong(18),kong(31),pair(27)]
    const kongs=groups.slice(0,4).map(group=>({tile:group.tiles[0]}))
    const score=scoreGroups(groups,{kongs,activeWildCount:1,physicalTileTotal})
    const special=score.multipliers.map(rule=>rule.id).filter(id=>id==='er_shi_er_tian_wang'||id==='er_shi_liu_jin_fo')
    expect(special).toEqual(expected)
    if (physicalTileTotal>=22) expect(score.multipliers.map(rule=>rule.id)).not.toContain('si_gang_zi')
  })

  it('普通杠每组不能少于4张', () => {
    const state={hand:[],kongs:[{tile:22,size:3}],laiziKongs:[],flags}
    expect(validateState(state)).toContain('至少需要4张')
  })

  it('只有没有其他加法番时才回退鸡胡', () => {
    const counts=Array(34).fill(0)
    const groups=[
      {type:'sequence',tiles:[0,1,2]}, {type:'sequence',tiles:[12,13,14]},
      {type:'sequence',tiles:[15,16,17]}, {type:'pung',tiles:[22,22,22]}, {type:'pair',tiles:[27,27]}
    ]
    groups.flatMap(g=>g.tiles).forEach(id=>counts[id]++)
    const score=scoreSolution({solution:{kind:'standard',groups,assignments:[]},finalCounts:counts,physicalCounts:counts,kongs:[],laiziKongs:0,activeWildCount:0,flags})
    expect(score.additive.map(x=>x.name)).toEqual(['鸡胡'])
    expect(score.additiveTotal).toBe(20)
    expect(score.multipliers.map(x=>x.name)).toContain('硬胡')
  })

  it('理论值先计算再按硬胡9000封顶', () => {
    const counts=Array(34).fill(0)
    const groups=[
      {type:'pung',tiles:[31,31,31]}, {type:'pung',tiles:[32,32,32]},
      {type:'pung',tiles:[33,33,33]}, {type:'sequence',tiles:[0,1,2]}, {type:'pair',tiles:[4,4]}
    ]
    groups.flatMap(g=>g.tiles).forEach(id=>counts[id]++)
    const score=scoreSolution({solution:{kind:'standard',groups,assignments:[]},finalCounts:counts,physicalCounts:counts,kongs:[],laiziKongs:0,activeWildCount:0,flags:{...flags,tianHu:true}})
    expect(score.categoryName).toBe('硬胡')
    expect(score.cap).toBe(9000)
    expect(score.theoretical).toBeGreaterThan(9000)
    expect(score.actual).toBe(9000)
  })
})

describe('声明式不计关系', () => {
  it('完整收录规则图及实战补充的50个不计条目', () => {
    expect(Object.keys(EXCLUSION_RELATIONS)).toHaveLength(50)
    expect(EXCLUSION_RELATIONS).toEqual(EXPECTED_EXCLUSIONS)
  })

  it('所有关系来源与目标都使用已知的规范ID', () => {
    const dynamicRuleIds=['san_gang_zi','si_gang_zi','er_shi_er_tian_wang','er_shi_liu_jin_fo']
    const knownIds=new Set([...RULE_CATALOG.map(rule=>rule.id),...REFERENCE_ONLY_RULE_IDS,...dynamicRuleIds])
    for(const [source,targets] of Object.entries(EXCLUSION_RELATIONS)) {
      expect(knownIds.has(canonicalRuleId(source)),`未知来源ID：${source}`).toBe(true)
      for(const target of targets) expect(knownIds.has(canonicalRuleId(target)),`未知目标ID：${target}`).toBe(true)
    }
    expect(RULE_ALIASES).toEqual({
      yi_tiao_long:'qing_long',
      shi_ba_luo_han:'si_gang_zi',
      yao_jiu:'dai_yao_jiu'
    })
    expect(REFERENCE_ONLY_RULE_IDS).toEqual(['peng_peng_hu','dan_diao_ruan_hu','san_tong_shun','lian_liu'])
  })

  it('保留被覆盖番型的值、类型和覆盖来源供界面展示', () => {
    const rules=[
      {id:'san_tong_ke',name:'三同刻',kind:'add',value:300},
      {id:'shuang_tong_ke',name:'双同刻',kind:'add',value:100}
    ]
    const result=resolveExclusions(rules)
    expect(result.kept.map(rule=>rule.id)).toEqual(['san_tong_ke'])
    expect(result.suppressed).toEqual([{
      id:'shuang_tong_ke',name:'双同刻',kind:'add',value:100,
      suppressedBy:[{id:'san_tong_ke',name:'三同刻'}]
    }])
  })

  it.each([
    ['三同刻不计双同刻',[pung(0),pung(9),pung(18),sequence(3),pair(27)],'san_tong_ke','shuang_tong_ke'],
    ['双双同刻不计双同刻',[pung(0),pung(9),pung(1),pung(10),pair(27)],'shuang_shuang_tong_ke','shuang_tong_ke'],
    ['四步高不计三步高',[sequence(0),sequence(1),sequence(2),sequence(3),pair(27)],'si_bu_gao','san_bu_gao'],
    ['四连刻不计三连刻',[pung(0),pung(1),pung(2),pung(3),pair(27)],'si_lian_ke','san_lian_ke']
  ])('%s', (_label,groups,source,target) => {
    const score=scoreGroups(groups)
    expect(score.additive.map(rule=>rule.id)).toContain(source)
    expect(score.additive.map(rule=>rule.id)).not.toContain(target)
    expect(score.suppressed.find(rule=>rule.id===target)?.suppressedBy.map(rule=>rule.id)).toContain(source)
  })

  it('小三风要求两个不同风刻和第三种风牌作将', () => {
    const valid=scoreGroups([pung(27),pung(28),sequence(0),sequence(3),pair(29)])
    const repeatedPair=scoreGroups([pung(27),pung(30),pung(0),pung(9),pair(27)])
    const threeWindPungGroups=scoreGroups([pung(27),pung(27),pung(28),sequence(0),pair(29)])
    expect(detectedIds(valid).has('xiao_san_feng')).toBe(true)
    expect(detectedIds(repeatedPair).has('xiao_san_feng')).toBe(false)
    expect(detectedIds(threeWindPungGroups).has('xiao_san_feng')).toBe(false)
  })

  it('小三元要求两种不同箭牌刻子和第三种箭牌作将', () => {
    const valid=scoreGroups([pung(31),pung(32),sequence(0),sequence(3),pair(33)])
    const repeatedPair=scoreGroups([pung(1),pung(3),pung(31),pung(33),pair(31)])
    const threeDragonPungGroups=scoreGroups([pung(31),pung(31),pung(32),sequence(0),pair(33)])
    expect(detectedIds(valid).has('xiao_san_yuan')).toBe(true)
    expect(detectedIds(repeatedPair).has('xiao_san_yuan')).toBe(false)
    expect(detectedIds(threeDragonPungGroups).has('xiao_san_yuan')).toBe(false)
  })

  it('小四喜要求三种不同风刻和第四种风牌作将', () => {
    const valid=scoreGroups([pung(27),pung(28),pung(29),sequence(0),pair(30)])
    const repeatedPair=scoreGroups([pung(27),pung(28),pung(29),sequence(0),pair(27)])
    const fourWindPungGroups=scoreGroups([pung(27),pung(27),pung(28),pung(29),pair(30)])
    expect(detectedIds(valid).has('xiao_si_xi')).toBe(true)
    expect(detectedIds(repeatedPair).has('xiao_si_xi')).toBe(false)
    expect(detectedIds(fourWindPungGroups).has('xiao_si_xi')).toBe(false)
  })

  it.each([
    ['四杠子',18,'si_gang_zi',['san_gang_zi']],
    ['二十二天王',22,'er_shi_er_tian_wang',['san_gang_zi','si_gang_zi']],
    ['二十六金佛',26,'er_shi_liu_jin_fo',['san_gang_zi','si_gang_zi']]
  ])('%s不会重复计算低级杠番', (_label,total,source,suppressedIds) => {
    const groups=[kong(0),kong(1),kong(2),kong(3),pair(27)]
    const score=scoreGroups(groups,{
      kongs:[{tile:0},{tile:1},{tile:2},{tile:3}],
      physicalCounts:physicalCountsWithTotal(total)
    })
    expect(score.multipliers.map(rule=>rule.id)).toContain(source)
    for(const id of suppressedIds) {
      expect(score.multipliers.map(rule=>rule.id)).not.toContain(id)
      expect(score.suppressed.map(rule=>rule.id)).toContain(id)
    }
  })

  it('断红胡不再错误排除混一色等可叠加番型', () => {
    expect(EXCLUSION_RELATIONS.duan_hong).toBeUndefined()
    const score=scoreGroups([pung(19),pung(20),pung(21),pung(27),pair(28)])
    expect(score.additive.map(rule=>rule.id)).toEqual(expect.arrayContaining(['duan_hong','hun_yi_se']))
    expect(score.suppressed.map(rule=>rule.id)).not.toContain('hun_yi_se')
  })
})

describe('八种混番型', () => {
  const positiveCases=[
    ['混双龙会','hun_shuang_long',[sequence(0),sequence(0),sequence(6),sequence(6),pair(27)]],
    ['混百万石','hun_bai_wan_shi',[pung(8),pung(8),pung(8),pung(8),pair(27)]],
    ['混将胡','hun_jiang_hu',[pung(1),pung(13),pung(25),pung(27),pair(1)]],
    ['混中','hun_zhong',[pung(3),pung(13),pung(23),pung(27),pair(13)]],
    ['混小','hun_xiao',[pung(0),pung(10),pung(20),pung(27),pair(0)]],
    ['混大','hun_da',[pung(6),pung(16),pung(26),pung(27),pair(6)]],
    ['混双','hun_shuang',[pung(1),pung(12),pung(23),pung(27),pair(25)]],
    ['混单','hun_dan',[pung(0),pung(11),pung(22),pung(27),pair(6)]]
  ]

  it.each(positiveCases)('%s满足数牌结构且恰好只有一个字牌牌组时成立', (_label,id,groups) => {
    expect(detectedIds(scoreGroups(groups)).has(id)).toBe(true)
  })

  it.each([
    ['混将胡','hun_jiang_hu',[2,5,8]],
    ['混中','hun_zhong',[4,5,6]],
    ['混小','hun_xiao',[1,2,3]],
    ['混大','hun_da',[7,8,9]],
    ['混双','hun_shuang',[2,4,6]],
    ['混单','hun_dan',[1,3,5]]
  ])('%s出现两组字牌刻，或字牌刻加字牌将时不成立', (_label,id,ranks) => {
    const twoHonorPungs=[pung(ranks[0]-1),pung(9+ranks[1]-1),pung(27),pung(28),pair(18+ranks[2]-1)]
    const honorPungAndPair=[pung(ranks[0]-1),pung(9+ranks[1]-1),pung(18+ranks[2]-1),pung(27),pair(28)]
    expect(detectedIds(scoreGroups(twoHonorPungs)).has(id)).toBe(false)
    expect(detectedIds(scoreGroups(honorPungAndPair)).has(id)).toBe(false)
  })

  it('混百万石出现两个字牌牌组时不成立', () => {
    const groups=[kong(8),kong(8),kong(8),pung(27),pair(28)]
    expect(detectedIds(scoreGroups(groups)).has('hun_bai_wan_shi')).toBe(false)
  })

  it('混双龙会只接受唯一的字牌将', () => {
    const groups=[sequence(0),sequence(0),sequence(6),sequence(6),pair(27),pung(28)]
    expect(detectedIds(scoreGroups(groups)).has('hun_shuang_long')).toBe(false)
  })

  it('浏览器反馈牌例不会误中混小或小三风', () => {
    const score=scoreGroups([pung(0),pung(9),pung(27),pung(30),pair(27)])
    expect(detectedIds(score).has('hun_xiao')).toBe(false)
    expect(detectedIds(score).has('xiao_san_feng')).toBe(false)
  })

  it.each([
    ['混将胡','hun_jiang_hu',[2,5,8]],
    ['混中','hun_zhong',[4,5,6]],
    ['混小','hun_xiao',[1,2,3]],
    ['混大','hun_da',[7,8,9]],
    ['混双','hun_shuang',[2,4,6,8]],
    ['混单','hun_dan',[1,3,5,7,9]]
  ])('%s不能由全不靠中的孤立字牌触发', (_label,id,ranks) => {
    const numbered=[]
    for(let suit=0;suit<3;suit++) for(const rank of ranks) numbered.push(suit*9+rank-1)
    const tiles=[...numbered.slice(0,12),27,31].slice(0,14)
    const score=scoreGroups([special(tiles)],{kind:'allUnrelated'})
    expect(detectedIds(score).has(id)).toBe(false)
  })

  it('混双龙会要求两组老少副同一花色且由字牌作将', () => {
    const crossSuit=scoreGroups([sequence(0),sequence(0),sequence(15),sequence(15),pair(27)])
    const numberedPair=scoreGroups([sequence(0),sequence(0),sequence(6),sequence(6),pair(4)])
    expect(detectedIds(crossSuit).has('hun_shuang_long')).toBe(false)
    expect(detectedIds(numberedPair).has('hun_shuang_long')).toBe(false)
  })

  it('字牌将的混双龙会不会同时误中一色双龙会', () => {
    const score=scoreGroups([sequence(0),sequence(0),sequence(6),sequence(6),pair(31)])
    expect(detectedIds(score).has('hun_shuang_long')).toBe(true)
    expect(detectedIds(score).has('yi_se_shuang_long')).toBe(false)
  })

  it('混百万石要求万字合计至少100且有字牌刻或将', () => {
    const belowHundred=scoreGroups([pung(8),pung(8),pung(8),pung(27),pair(8)])
    const noHonor=scoreGroups([pung(8),pung(8),pung(8),pung(8),pair(7)])
    expect(detectedIds(belowHundred).has('hun_bai_wan_shi')).toBe(false)
    expect(detectedIds(noHonor).has('hun_bai_wan_shi')).toBe(false)
  })

  it('纯字一色不会误中混将胡等混合数牌番型', () => {
    const score=scoreGroups([pung(27),pung(28),pung(29),pung(31),pair(32)])
    for(const id of ['hun_jiang_hu','hun_zhong','hun_xiao','hun_da','hun_shuang','hun_dan']) {
      expect(detectedIds(score).has(id)).toBe(false)
    }
  })

  it('癞子替代后的字牌将参与混番型判定', () => {
    const groups=[pung(0),pung(10),pung(20),sequence(0),pair(27)]
    const finalCounts=countsForGroups(groups)
    const physicalCounts=[...finalCounts]
    physicalCounts[27]--
    const score=scoreGroups(groups,{
      finalCounts,physicalCounts,activeWildCount:1,
      assignments:[{laizi:'lz',as:27}]
    })
    expect(detectedIds(score).has('hun_xiao')).toBe(true)
    expect(score.multipliers.map(rule=>rule.id)).not.toContain('ying_hu')
  })
})

describe('超级硬胡资格', () => {
  const pureDoubleDragon=[sequence(0),sequence(0),sequence(6),sequence(6),pair(4)]

  it('一色双龙会无癞子时可以晋级超级硬胡', () => {
    const score=scoreGroups(pureDoubleDragon)
    expect(score.additive.map(rule=>rule.id)).toContain('yi_se_shuang_long')
    expect(score.category).toBe('super')
    expect(score.cap).toBe(10000)
  })

  it('使用癞子替代的一色双龙会不能晋级超级硬胡', () => {
    const finalCounts=countsForGroups(pureDoubleDragon)
    const physicalCounts=[...finalCounts]
    physicalCounts[4]--
    const score=scoreGroups(pureDoubleDragon,{
      finalCounts,physicalCounts,activeWildCount:1,
      assignments:[{laizi:'lm',as:4}]
    })
    expect(score.additive.map(rule=>rule.id)).toContain('yi_se_shuang_long')
    expect(score.category).toBe('top')
    expect(score.categoryName).toBe('顶胡')
    expect(score.cap).toBe(6000)
    expect(score.multipliers.map(rule=>rule.id)).not.toContain('ying_hu')
  })

  it('浏览器反馈中的红中将加万能癞子只能按混双龙会大胡计算', () => {
    const groups=[sequence(18),sequence(18),sequence(24),sequence(24),pair(31)]
    const finalCounts=countsForGroups(groups)
    const physicalCounts=[...finalCounts]
    physicalCounts[31]--
    const score=scoreGroups(groups,{
      finalCounts,physicalCounts,activeWildCount:1,
      assignments:[{laizi:'la',as:31}]
    })
    expect(score.additive.map(rule=>rule.id)).toContain('hun_shuang_long')
    expect(score.additive.map(rule=>rule.id)).not.toContain('yi_se_shuang_long')
    expect(score.category).toBe('big')
    expect(score.categoryName).toBe('大胡')
    expect(score.multipliers.map(rule=>rule.id)).not.toContain('ying_hu')
  })
})

describe('胡癞子的硬胡资格', () => {
  const baseHand=[0,0,0,1,2,3,12,13,14,24,25,26,31]

  it.each(['lz','la'])('暗手无癞子时胡%s仍计硬胡', candidate => {
    const result=calculateWaits({hand:baseHand,discards:[],kongs:[],laiziKongs:[],flags})
    const wait=result.waits.find(item=>item.id===candidate)
    expect(wait).toBeTruthy()
    expect(wait.solution.assignments).toContainEqual({laizi:candidate,as:31})
    expect(wait.score.multipliers.map(rule=>rule.id)).toContain('ying_hu')
    expect(wait.score.categoryName).toBe('硬胡')
  })

  it('暗手原本已有癞子时仍不计硬胡', () => {
    const hand=[...baseHand.slice(0,-1),'lz']
    const result=calculateWaits({hand,discards:[],kongs:[],laiziKongs:[],flags})
    const wait=result.waits.find(item=>item.id===31)
    expect(wait).toBeTruthy()
    expect(wait.solution.assignments).toContainEqual({laizi:'lz',as:31})
    expect(wait.score.multipliers.map(rule=>rule.id)).not.toContain('ying_hu')
  })
})

describe('中原一点红与红孔雀的允许牌集合', () => {
  it('中原一点红不强制出现红中，并按规则不计丹青流彩', () => {
    const score=scoreGroups([pung(9),pung(11),pung(13),pung(15),pair(17)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('zhong_yuan_yi_dian_hong')
    expect(score.additive.map(rule=>rule.id)).not.toContain('dan_qing_liu_cai')
    expect(score.suppressed.find(rule=>rule.id==='dan_qing_liu_cai')?.suppressedBy.map(rule=>rule.id)).toContain('zhong_yuan_yi_dian_hong')
    expect(score.categoryName).toBe('顶胡')
  })

  it('中原一点红仍允许红中，但不能混入集合外的筒牌', () => {
    const withRedDragon=scoreGroups([pung(9),pung(11),pung(13),pung(31),pair(15)],{activeWildCount:1})
    const withTwoDots=scoreGroups([pung(9),pung(10),pung(13),pung(15),pair(17)],{activeWildCount:1})
    expect(detectedIds(withRedDragon).has('zhong_yuan_yi_dian_hong')).toBe(true)
    expect(detectedIds(withTwoDots).has('zhong_yuan_yi_dian_hong')).toBe(false)
  })

  it('截图牌例111333555777p加万能赖听3筒按中原一点红计算', () => {
    const result=calculateWaits({hand:parseTileCode('111333555777p la'),kongs:[],laiziKongs:[],flags})
    const wait=result.waits.find(item=>item.id===11)
    expect(wait).toBeTruthy()
    expect(wait.score.additive.map(rule=>rule.id)).toContain('zhong_yuan_yi_dian_hong')
    expect(wait.score.additive.map(rule=>rule.id)).not.toContain('dan_qing_liu_cai')
    expect(wait.score.suppressed.map(rule=>rule.id)).toContain('dan_qing_liu_cai')
    expect(wait.score.categoryName).toBe('顶胡')
  })

  it('红孔雀不强制出现红中，但不能混入集合外的条牌', () => {
    const withoutRedDragon=scoreGroups([pung(18),pung(22),pung(24),pung(26),pair(18)],{activeWildCount:1})
    const withRedDragon=scoreGroups([pung(18),pung(22),pung(24),pung(31),pair(26)],{activeWildCount:1})
    const withThreeBamboo=scoreGroups([pung(18),pung(20),pung(24),pung(26),pair(18)],{activeWildCount:1})
    expect(detectedIds(withoutRedDragon).has('hong_kong_que')).toBe(true)
    expect(withoutRedDragon.additive.map(rule=>rule.id)).not.toContain('dan_qing_liu_cai')
    expect(withoutRedDragon.suppressed.find(rule=>rule.id==='dan_qing_liu_cai')?.suppressedBy.map(rule=>rule.id)).toContain('hong_kong_que')
    expect(detectedIds(withRedDragon).has('hong_kong_que')).toBe(true)
    expect(detectedIds(withThreeBamboo).has('hong_kong_que')).toBe(false)
  })
})

describe('推不倒允许牌集合', () => {
  it('仅允许1至5、8、9筒，2、4、5、6、8、9条及白板', () => {
    const valid=scoreGroups([pung(9),pung(16),pung(19),pung(26),pair(33)],{activeWildCount:1})
    const withThreeBamboo=scoreGroups([pung(9),pung(16),pung(20),pung(26),pair(33)],{activeWildCount:1})
    const withSevenBamboo=scoreGroups([pung(9),pung(16),pung(24),pung(26),pair(33)],{activeWildCount:1})
    expect(detectedIds(valid).has('tui_bu_dao')).toBe(true)
    expect(detectedIds(withThreeBamboo).has('tui_bu_dao')).toBe(false)
    expect(detectedIds(withSevenBamboo).has('tui_bu_dao')).toBe(false)
  })

  it('牌例222333444s555p加万能赖听4条不计推不倒', () => {
    const result=calculateWaits({hand:parseTileCode('222333444s555p la'),kongs:[],laiziKongs:[],flags})
    const wait=result.waits.find(item=>item.id===21)
    expect(wait).toBeTruthy()
    expect(wait.score.additive.map(rule=>rule.id)).not.toContain('tui_bu_dao')
    expect(wait.score.suppressed.map(rule=>rule.id)).not.toContain('tui_bu_dao')
  })
})

describe('大四喜与大三元复合封顶等级', () => {
  const fourWinds=[pung(27),pung(28),pung(29),pung(30)]
  const threeDragons=[pung(31),pung(32),pung(33)]

  it('软胡基础大四喜仍为大胡', () => {
    const score=scoreGroups([...fourWinds,pair(3)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('da_si_xi')
    expect(score.category).toBe('big')
    expect(score.cap).toBe(4000)
  })

  it.each([
    ['字一色',[...fourWinds,pair(31)],'zi_yi_se'],
    ['黑一色',[...fourWinds,pair(10)],'hei_yi_se'],
    ['混幺九',[...fourWinds,pair(0)],'hun_yao_jiu'],
    ['断红胡',[...fourWinds,pair(19)],'duan_hong']
  ])('软胡大四喜与%s复合时提升为顶胡', (_label,groups,companionId) => {
    const score=scoreGroups(groups,{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toEqual(expect.arrayContaining(['da_si_xi',companionId]))
    expect(score.category).toBe('top')
    expect(score.cap).toBe(6000)
  })

  it('无癞子的基础大四喜进阶超级硬胡并封顶10000', () => {
    const score=scoreGroups([...fourWinds,pair(3)])
    expect(score.category).toBe('super')
    expect(score.cap).toBe(10000)
  })

  it.each([
    ['字一色',[...fourWinds,pair(31)]],
    ['黑一色',[...fourWinds,pair(10)]],
    ['混幺九',[...fourWinds,pair(0)]],
    ['断红胡',[...fourWinds,pair(19)]]
  ])('无癞子大四喜与%s复合时超级硬胡封顶12000', (_label,groups) => {
    const score=scoreGroups(groups)
    expect(score.category).toBe('super')
    expect(score.cap).toBe(12000)
  })

  it('软胡基础大三元为大胡，与字一色或混幺九复合时提升顶胡', () => {
    const base=scoreGroups([...threeDragons,pung(3),pair(4)],{activeWildCount:1})
    const allHonors=scoreGroups([...threeDragons,pung(27),pair(28)],{activeWildCount:1})
    const mixedTerminals=scoreGroups([...threeDragons,pung(0),pair(8)],{activeWildCount:1})
    expect(base.category).toBe('big')
    expect(base.cap).toBe(4000)
    expect(allHonors.additive.map(rule=>rule.id)).toEqual(expect.arrayContaining(['da_san_yuan','zi_yi_se']))
    expect(allHonors.category).toBe('top')
    expect(allHonors.cap).toBe(6000)
    expect(mixedTerminals.additive.map(rule=>rule.id)).toEqual(expect.arrayContaining(['da_san_yuan','hun_yao_jiu']))
    expect(mixedTerminals.category).toBe('top')
    expect(mixedTerminals.cap).toBe(6000)
  })
})

describe('七星与四喜、三元七对的字牌种类判定', () => {
  const resultFor = code => calculateWaits({ hand: parseTileCode(code), kongs: [], laiziKongs: [], flags })
  const additiveIds = wait => wait.score.additive.map(rule => rule.id)

  it('重复四风对子只计四喜七对，不会误判大小七星', () => {
    const result = resultFor('111122223344zla')
    const windWait = result.waits.find(item => item.id === 27)
    const numberedWait = result.waits.find(item => item.id === 0)
    expect(windWait).toBeTruthy()
    expect(numberedWait).toBeTruthy()
    expect(additiveIds(windWait)).toContain('si_xi_qi_dui')
    expect(additiveIds(windWait)).not.toEqual(expect.arrayContaining(['da_qi_xing', 'xiao_qi_xing']))
    expect(additiveIds(numberedWait)).toContain('si_xi_qi_dui')
    expect(additiveIds(numberedWait)).not.toEqual(expect.arrayContaining(['da_qi_xing', 'xiao_qi_xing']))
  })

  it('重复三元对子只计三元七对，不会误判大小七星', () => {
    const result = resultFor('555566667777zla')
    const dragonWait = result.waits.find(item => item.id === 31)
    const numberedWait = result.waits.find(item => item.id === 0)
    expect(dragonWait).toBeTruthy()
    expect(numberedWait).toBeTruthy()
    expect(additiveIds(dragonWait)).toContain('san_yuan_qi_dui')
    expect(additiveIds(dragonWait)).not.toEqual(expect.arrayContaining(['da_qi_xing', 'xiao_qi_xing']))
    expect(additiveIds(numberedWait)).toContain('san_yuan_qi_dui')
    expect(additiveIds(numberedWait)).not.toEqual(expect.arrayContaining(['da_qi_xing', 'xiao_qi_xing']))
  })

  it.each([
    ['113344556677zla', 28],
    ['112233445566zla', 33],
  ])('六种不同字牌对子：%s 补缺失字牌为大七星，补重复字牌为小七星', (code, missingHonorId) => {
    const result = resultFor(code)
    const missingHonorWait = result.waits.find(item => item.id === missingHonorId)
    const repeatedHonorWait = result.waits.find(item => item.id === 27)
    const numberedWait = result.waits.find(item => item.id === 0)
    expect(missingHonorWait).toBeTruthy()
    expect(repeatedHonorWait).toBeTruthy()
    expect(numberedWait).toBeTruthy()
    expect(additiveIds(missingHonorWait)).toContain('da_qi_xing')
    expect(additiveIds(missingHonorWait)).not.toContain('xiao_qi_xing')
    expect(additiveIds(repeatedHonorWait)).toContain('xiao_qi_xing')
    expect(additiveIds(repeatedHonorWait)).not.toContain('da_qi_xing')
    expect(additiveIds(numberedWait)).not.toEqual(expect.arrayContaining(['da_qi_xing', 'xiao_qi_xing']))
  })
})
describe('连六对封顶等级', () => {
  const consecutiveSix=[pair(0),pair(1),pair(2),pair(3),pair(4),pair(5)]

  it.each([
    ['清一色组合为顶胡',[...consecutiveSix,pair(0)],'qing_yi_se','top','顶胡',6000],
    ['混一色组合为大胡',[...consecutiveSix,pair(27)],'hun_yi_se','big','大胡',4000],
    ['其他组合为小胡',[...consecutiveSix,pair(17)],null,'small','小胡',3000]
  ])('%s', (_label,groups,companionId,category,categoryName,cap) => {
    const score=scoreGroups(groups,{kind:'sevenPairs',activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('lian_liu_dui')
    if(companionId) expect(score.additive.map(rule=>rule.id)).toContain(companionId)
    expect(score.category).toBe(category)
    expect(score.categoryName).toBe(categoryName)
    expect(score.cap).toBe(cap)
  })
})

describe('四同顺复合封顶等级', () => {
  const fourIdenticalSequences=[sequence(6),sequence(6),sequence(6),sequence(6)]

  it('基础四同顺为大胡', () => {
    const score=scoreGroups([...fourIdenticalSequences,pair(27)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('si_tong_shun')
    expect(score.additive.map(rule=>rule.id)).not.toContain('qing_yi_se')
    expect(score.category).toBe('big')
    expect(score.cap).toBe(4000)
  })

  it('四同顺与清一色复合时提升为顶胡', () => {
    const score=scoreGroups([...fourIdenticalSequences,pair(0)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toEqual(expect.arrayContaining(['si_tong_shun','qing_yi_se']))
    expect(score.category).toBe('top')
    expect(score.categoryName).toBe('顶胡')
    expect(score.cap).toBe(6000)
  })

  it('无癞子的清四同顺进阶超级硬胡', () => {
    const score=scoreGroups([...fourIdenticalSequences,pair(0)])
    expect(score.category).toBe('super')
    expect(score.categoryName).toBe('超级硬胡')
    expect(score.cap).toBe(10000)
  })

  it('牌例777788889999mla听1万按顶胡计算并保留详情方案', () => {
    const result=calculateWaits({hand:parseTileCode('777788889999mla'),kongs:[],laiziKongs:[],flags})
    const wait=result.waits.find(item=>item.id===0)
    expect(wait).toBeTruthy()
    expect(wait.score.additive.map(rule=>rule.id)).toEqual(expect.arrayContaining(['si_tong_shun','qing_yi_se']))
    expect(wait.score.categoryName).toBe('顶胡')
    expect(wait.score.actual).toBe(6000)
    expect(wait.solution.groups.filter(group=>group.type==='sequence')).toHaveLength(4)
    expect(wait.solution.assignments).toContainEqual({laizi:'la',as:0})
  })
})

describe('十八罗汉复合封顶等级', () => {
  const fourKongs = groups => ({
    groups,
    options:{
      kongs:groups.filter(group=>group.type==='kong').map(group=>({tile:group.tiles[0]})),
      activeWildCount:1
    }
  })

  it.each([
    ['与清一色复合为顶胡',fourKongs([kong(0),kong(1),kong(2),kong(3),pair(4)]),'qing_yi_se','top','顶胡',6000],
    ['与字一色复合为顶胡',fourKongs([kong(27),kong(28),kong(29),kong(30),pair(31)]),'zi_yi_se','top','顶胡',6000],
    ['与混一色复合仍为小胡',fourKongs([kong(0),kong(3),kong(6),kong(27),pair(4)]),'hun_yi_se','small','小胡',3000]
  ])('%s', (_label,testCase,companionId,category,categoryName,cap) => {
    const score=scoreGroups(testCase.groups,testCase.options)
    expect(score.multipliers.map(rule=>rule.id)).toContain('si_gang_zi')
    expect(score.additive.map(rule=>rule.id)).toContain(companionId)
    expect(score.category).toBe(category)
    expect(score.categoryName).toBe(categoryName)
    expect(score.cap).toBe(cap)
  })

  it('无癞子且满足超级条件时超级硬胡优先于硬胡', () => {
    const groups=[kong(0),kong(1),kong(2),kong(3),pair(4)]
    const score=scoreGroups(groups,{
      kongs:groups.filter(group=>group.type==='kong').map(group=>({tile:group.tiles[0]}))
    })
    expect(score.category).toBe('super')
    expect(score.categoryName).toBe('超级硬胡')
    expect(score.cap).toBe(10000)
  })

  it('无癞子但不满足超级条件时硬胡优先于复合顶胡', () => {
    const groups=[kong(0),kong(2),kong(5),kong(8),pair(4)]
    const score=scoreGroups(groups,{
      kongs:groups.filter(group=>group.type==='kong').map(group=>({tile:group.tiles[0]}))
    })
    expect(score.category).toBe('hard')
    expect(score.categoryName).toBe('硬胡')
    expect(score.cap).toBe(9000)
  })
})

describe('二十二天王与二十六金佛封顶等级', () => {
  const scoreSpecialKongs = (groups, physicalTileTotal) => scoreGroups(groups,{
    kongs:groups.filter(group=>group.type==='kong').map(group=>({tile:group.tiles[0]})),
    activeWildCount:1,
    physicalTileTotal
  })

  it.each([
    ['基础二十二天王为大胡',[kong(0),kong(9),kong(18),kong(31),pair(27)],null,'big',4000],
    ['二十二天王与混一色复合为顶胡',[kong(0),kong(3),kong(6),kong(27),pair(4)],'hun_yi_se','top',6000],
    ['二十二天王与清一色复合为顶胡',[kong(0),kong(1),kong(2),kong(3),pair(4)],'qing_yi_se','top',6000],
    ['二十二天王与字一色复合为顶胡',[kong(27),kong(28),kong(29),kong(30),pair(31)],'zi_yi_se','top',6000]
  ])('%s', (_label,groups,companionId,category,cap) => {
    const score=scoreSpecialKongs(groups,22)
    expect(score.multipliers.map(rule=>rule.id)).toContain('er_shi_er_tian_wang')
    if(companionId) expect(score.additive.map(rule=>rule.id)).toContain(companionId)
    expect(score.category).toBe(category)
    expect(score.cap).toBe(cap)
  })

  it('二十六金佛为顶胡并排除二十二天王和十八罗汉', () => {
    const groups=[kong(0),kong(9),kong(18),kong(31),pair(27)]
    const score=scoreSpecialKongs(groups,26)
    expect(score.multipliers.map(rule=>rule.id)).toContain('er_shi_liu_jin_fo')
    expect(score.multipliers.map(rule=>rule.id)).not.toContain('er_shi_er_tian_wang')
    expect(score.multipliers.map(rule=>rule.id)).not.toContain('si_gang_zi')
    expect(score.category).toBe('top')
    expect(score.cap).toBe(6000)
  })
})

describe('五门齐封顶等级', () => {
  it('五门齐自身按小胡3000封顶', () => {
    const groups=[sequence(0),sequence(9),sequence(18),pung(27),pair(31)]
    const score=scoreGroups(groups,{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('wu_men_qi')
    expect(score.category).toBe('small')
    expect(score.cap).toBe(3000)
  })
})

describe('四连刻封顶等级', () => {
  it('有癞子且不与清一色复合时为小胡', () => {
    const score=scoreGroups([pung(0),pung(1),pung(2),pung(3),pair(13)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('si_lian_ke')
    expect(score.additive.map(rule=>rule.id)).not.toContain('qing_yi_se')
    expect(score.category).toBe('small')
    expect(score.cap).toBe(3000)
  })

  it('有癞子且与清一色复合时提升为顶胡', () => {
    const score=scoreGroups([pung(0),pung(1),pung(2),pung(3),pair(4)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toEqual(expect.arrayContaining(['si_lian_ke','qing_yi_se']))
    expect(score.category).toBe('top')
    expect(score.categoryName).toBe('顶胡')
    expect(score.cap).toBe(6000)
  })

  it('无癞子的清一色四连刻仍按超级硬胡优先', () => {
    const score=scoreGroups([pung(0),pung(1),pung(2),pung(3),pair(4)])
    expect(score.category).toBe('super')
    expect(score.categoryName).toBe('超级硬胡')
    expect(score.cap).toBe(10000)
  })
})

describe('十全十美判定', () => {
  const twoComplementaryPairs=[pung(0),pung(8),pung(19),pung(25)]

  it('纯正十全十美要求任意两组同花色互补刻子对且5点数作将', () => {
    const valid=scoreGroups([...twoComplementaryPairs,pair(13)])
    const wrongPair=scoreGroups([...twoComplementaryPairs,pair(1)])
    const onlyOnePair=scoreGroups([pung(0),pung(8),pung(2),pung(3),pair(4)])
    expect(detectedIds(valid).has('chun_zheng_shi_quan')).toBe(true)
    expect(detectedIds(wrongPair).has('chun_zheng_shi_quan')).toBe(false)
    expect(detectedIds(onlyOnePair).has('chun_zheng_shi_quan')).toBe(false)
  })

  it('十全十美要求任意两组同花色互补刻子对且字牌作将', () => {
    const valid=scoreGroups([...twoComplementaryPairs,pair(27)])
    const numberedPair=scoreGroups([...twoComplementaryPairs,pair(4)])
    const onlyOnePair=scoreGroups([pung(0),pung(8),pung(2),pung(3),pair(27)])
    expect(detectedIds(valid).has('shi_quan_shi_mei')).toBe(true)
    expect(detectedIds(numberedPair).has('shi_quan_shi_mei')).toBe(false)
    expect(detectedIds(onlyOnePair).has('shi_quan_shi_mei')).toBe(false)
  })

  it('浏览器反馈中的单组1、9刻子加数牌将不会误中十全十美', () => {
    const score=scoreGroups([pung(0),pung(8),sequence(2),sequence(5),pair(1)])
    expect(detectedIds(score).has('shi_quan_shi_mei')).toBe(false)
    expect(detectedIds(score).has('chun_zheng_shi_quan')).toBe(false)
  })
})

describe('九五至尊判定', () => {
  it('纯正九五至尊只允许数牌5、9且两种点数都出现', () => {
    const valid=scoreGroups([pung(4),pung(8),pung(13),pung(26),pair(22)])
    const onlyFives=scoreGroups([pung(4),pung(4),pung(13),pung(22),pair(4)])
    const withHonor=scoreGroups([pung(4),pung(8),pung(13),pung(27),pair(22)])
    expect(detectedIds(valid).has('chun_zheng_jiu_wu')).toBe(true)
    expect(detectedIds(onlyFives).has('chun_zheng_jiu_wu')).toBe(false)
    expect(detectedIds(withHonor).has('chun_zheng_jiu_wu')).toBe(false)
  })

  it('九五至尊允许唯一字牌将或唯一字牌刻', () => {
    const honorPair=scoreGroups([pung(4),pung(8),pung(13),pung(26),pair(27)])
    const honorPung=scoreGroups([pung(4),pung(8),pung(13),pung(27),pair(26)])
    expect(detectedIds(honorPair).has('jiu_wu_zhi_zun')).toBe(true)
    expect(detectedIds(honorPung).has('jiu_wu_zhi_zun')).toBe(true)
    expect(honorPair.category).toBe('hard')
    const softScore=scoreGroups([pung(4),pung(8),pung(13),pung(26),pair(27)],{activeWildCount:1})
    expect(softScore.category).toBe('top')
    expect(softScore.categoryName).toBe('顶胡')
    expect(softScore.cap).toBe(6000)
  })

  it('九五至尊出现两组字牌刻或字牌刻加字牌将时不成立', () => {
    const twoHonorPungs=scoreGroups([pung(4),pung(8),pung(27),pung(28),pair(13)])
    const honorPungAndPair=scoreGroups([pung(4),pung(8),pung(13),pung(27),pair(28)])
    expect(detectedIds(twoHonorPungs).has('jiu_wu_zhi_zun')).toBe(false)
    expect(detectedIds(honorPungAndPair).has('jiu_wu_zhi_zun')).toBe(false)
  })

  it('九五至尊不能混入5、9之外的数牌或孤立字牌', () => {
    const otherRank=scoreGroups([pung(4),pung(8),pung(13),pung(27),pair(1)])
    const isolatedHonor=scoreGroups([special([4,8,13,17,22,26,27,0,1,2,3,5,6,7])],{kind:'allUnrelated'})
    expect(detectedIds(otherRank).has('jiu_wu_zhi_zun')).toBe(false)
    expect(detectedIds(isolatedHonor).has('jiu_wu_zhi_zun')).toBe(false)
  })
})

describe('九莲宝灯不计关系', () => {
  it('九莲宝灯成立时不计老少副', () => {
    const score=scoreGroups([pung(0),sequence(0),sequence(3),sequence(6),pair(8)])
    expect(score.additive.map(rule=>rule.id)).toContain('jiu_lian_bao_deng')
    expect(score.additive.map(rule=>rule.id)).not.toContain('lao_shao_fu')
    expect(score.suppressed.find(rule=>rule.id==='lao_shao_fu')?.suppressedBy.map(rule=>rule.id)).toContain('jiu_lian_bao_deng')
  })
})

describe('清龙与一色四步高不计老少副', () => {
  it('清龙成立时不计老少副', () => {
    const score=scoreGroups([sequence(0),sequence(3),sequence(6),pung(27),pair(28)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('qing_long')
    expect(score.additive.map(rule=>rule.id)).not.toContain('lao_shao_fu')
    expect(score.suppressed.find(rule=>rule.id==='lao_shao_fu')?.suppressedBy.map(rule=>rule.id)).toContain('qing_long')
  })

  it('一色四步高成立时不计老少副', () => {
    const score=scoreGroups([sequence(0),sequence(2),sequence(4),sequence(6),pair(8)],{activeWildCount:1})
    expect(score.additive.map(rule=>rule.id)).toContain('si_bu_gao')
    expect(score.additive.map(rule=>rule.id)).not.toContain('lao_shao_fu')
    expect(score.suppressed.find(rule=>rule.id==='lao_shao_fu')?.suppressedBy.map(rule=>rule.id)).toContain('si_bu_gao')
  })
})

describe('十三幺不计关系', () => {
  it('十三幺／国士无双不计五门齐和混幺九', () => {
    const tiles=[0,8,9,17,18,26,27,28,29,30,31,32,33,0]
    const score=scoreGroups([special(tiles)],{kind:'thirteenOrphans'})
    expect(score.additive.map(rule=>rule.id)).toContain('shi_san_yao')
    for(const id of ['wu_men_qi','hun_yao_jiu']) {
      expect(score.additive.map(rule=>rule.id)).not.toContain(id)
      expect(score.suppressed.find(rule=>rule.id===id)?.suppressedBy.map(rule=>rule.id)).toContain('shi_san_yao')
    }
  })
})

describe('倒转昆仑特殊胡牌', () => {
  it('13种互异中心对称牌同时听规则中的全部14种牌', () => {
    const state={
      hand:INVERTED_KUNLUN_TILES.filter(id=>id!==33),
      discards:[],kongs:[],laiziKongs:[],flags
    }
    const result=calculateWaits(state)
    expect(result.error).toBe('')
    const numberedWaits=result.waits.filter(wait=>typeof wait.id==='number')
    expect(numberedWaits.map(wait=>wait.id).sort((a,b)=>a-b)).toEqual([...INVERTED_KUNLUN_TILES].sort((a,b)=>a-b))
    expect(numberedWaits).toHaveLength(14)
    for(const wait of numberedWaits) {
      expect(wait.solution.kind).toBe('invertedKunlun')
      expect(wait.score.additive.map(rule=>rule.id)).toContain('dao_zhuan_kun_lun')
    }
  })

  it('倒转昆仑完成牌必须只使用中心对称牌且至少有13种不同牌', () => {
    const validTiles=[...INVERTED_KUNLUN_TILES.slice(0,13),INVERTED_KUNLUN_TILES[0]]
    const invalidTiles=[...INVERTED_KUNLUN_TILES.slice(0,12),INVERTED_KUNLUN_TILES[0],INVERTED_KUNLUN_TILES[1]]
    expect(detectedIds(scoreGroups([special(validTiles)],{kind:'invertedKunlun'})).has('dao_zhuan_kun_lun')).toBe(true)
    expect(detectedIds(scoreGroups([special(invalidTiles)],{kind:'invertedKunlun'})).has('dao_zhuan_kun_lun')).toBe(false)
  })
})

describe('龙御四方特殊胡牌', () => {
  const cases=[
    ['清龙','imperialPureDragon','long_yu_si_fang_qing',[0,1,2,3,4,5,6,7,8,27,28,29,30]],
    ['花龙','imperialFlowerDragon','long_yu_si_fang_hua',[0,1,2,21,22,23,15,16,17,27,28,29,30]],
    ['组合龙','imperialCombinationDragon','long_yu_si_fang_zuhe',[0,3,6,19,22,25,11,14,17,27,28,29,30]]
  ]

  it.each(cases)('龙御四方（%s）的13张基础牌听牌型中的全部13种牌', (_label,kind,ruleId,hand) => {
    const result=calculateWaits({hand,discards:[],kongs:[],laiziKongs:[],flags})
    expect(result.error).toBe('')
    const imperialWaits=result.waits.filter(wait=>typeof wait.id==='number' && wait.solution.kind===kind)
    expect(imperialWaits.map(wait=>wait.id).sort((a,b)=>a-b)).toEqual([...hand].sort((a,b)=>a-b))
    expect(imperialWaits).toHaveLength(13)
    for(const wait of imperialWaits) {
      expect(wait.solution.kind).toBe(kind)
      expect(wait.score.additive.map(rule=>rule.id)).toContain(ruleId)
    }
  })

  it('龙御四方不能混入对应13种固定牌以外的牌', () => {
    const invalidHand=[0,1,2,3,4,5,6,7,8,27,28,29,31]
    const result=calculateWaits({hand:invalidHand,discards:[],kongs:[],laiziKongs:[],flags})
    expect(result.waits.some(wait=>wait.solution.kind.startsWith('imperial'))).toBe(false)
  })

  it('龙御四方（组合龙）成立时不计组合龙', () => {
    const hand=[0,3,6,19,22,25,11,14,17,27,28,29,30]
    const result=calculateWaits({hand,discards:[],kongs:[],laiziKongs:[],flags})
    const wait=result.waits.find(item=>item.id===0 && item.solution.kind==='imperialCombinationDragon')
    expect(wait).toBeTruthy()
    expect(wait.score.additive.map(rule=>rule.id)).toContain('long_yu_si_fang_zuhe')
    expect(wait.score.additive.map(rule=>rule.id)).not.toContain('zu_he_long')
    expect(wait.score.suppressed.find(rule=>rule.id==='zu_he_long')?.suppressedBy.map(rule=>rule.id)).toContain('long_yu_si_fang_zuhe')
  })

  it('龙御四方（花龙）成立时不计花龙', () => {
    const hand=[0,1,2,21,22,23,15,16,17,27,28,29,30]
    const result=calculateWaits({hand,discards:[],kongs:[],laiziKongs:[],flags})
    const wait=result.waits.find(item=>item.id===0 && item.solution.kind==='imperialFlowerDragon')
    expect(wait).toBeTruthy()
    expect(wait.score.additive.map(rule=>rule.id)).toContain('long_yu_si_fang_hua')
    expect(wait.score.additive.map(rule=>rule.id)).not.toContain('hua_long')
    expect(wait.score.suppressed.find(rule=>rule.id==='hua_long')?.suppressedBy.map(rule=>rule.id)).toContain('long_yu_si_fang_hua')
  })
})
