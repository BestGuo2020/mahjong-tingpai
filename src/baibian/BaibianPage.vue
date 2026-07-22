<script setup>
import { computed, reactive, ref, watch } from 'vue'
import TileFace from '../components/TileFace.vue'
import { BASE_TILES, LAIZI_META, SUITS, parseTileCode, tileName } from './tiles'
import { availableKongOptions, calculateWaits, describeAssignments, describeSolution, kongSize, knownPhysicalCounts } from './calculator'
import './baibian.css'

const state = reactive({
  hand: [],
  kongs: [],
  laiziKongs: [],
  flags: { tianHu:false, gangShangKaiHua:false, tianHuBonus:false }
})
const code = ref('')
const message = ref('')
const result = ref({ waits:[], error:'', structural:0 })
const dirty = ref(false)

watch(state, () => { dirty.value = true }, { deep:true })

const known = computed(() => knownPhysicalCounts(state))
const physicalTotal = computed(() => known.value.reduce((a,b)=>a+b,0))
const structural = computed(() => state.hand.length + state.kongs.length * 3)
const eligibleKongs = computed(() => BASE_TILES
  .map(tile => {
    const options=availableKongOptions(state.hand,tile,state.kongs.length)
    return { tile, copies:countIn(state.hand,tile), optionGroups:groupKongOptions(options) }
  })
  .filter(item => item.optionGroups.length > 0))

function groupKongOptions(options) {
  const grouped=[]
  for(const option of options) {
    const groupCount=option.sizes.length
    let group=grouped.find(item=>item.groupCount===groupCount)
    if(!group) { group={groupCount,options:[]}; grouped.push(group) }
    group.options.push(option)
  }
  return grouped
}

function sortTiles(list) {
  list.sort((a,b) => typeof a === 'number' && typeof b === 'number' ? a-b : typeof a === 'number' ? -1 : typeof b === 'number' ? 1 : String(a).localeCompare(String(b)))
}
function countIn(list,id) { return list.filter(x=>x===id).length }
function countZone(id) { return countIn(state.hand,id) }
function addTile(id) {
  message.value=''
  if (typeof id === 'number' && known.value[id] >= 12) return message.value=`${tileName(id)}总数已达到12张`
  state.hand.push(id); sortTiles(state.hand)
}
function removeTile(index) { state.hand.splice(index,1); message.value='' }
function parseCodeInput() {
  try {
    const parsed=parseTileCode(code.value)
    const nextPhysical=Array(34).fill(0)
    parsed.forEach(id=>{ if(typeof id==='number') nextPhysical[id]++ })
    state.kongs.forEach(k=>nextPhysical[k.tile]+=kongSize(k))
    const over=nextPhysical.findIndex(n=>n>12)
    if(over>=0) throw new Error(`${tileName(over)}在暗手牌和杠组中合计超过12张`)
    state.hand.splice(0,state.hand.length,...parsed); sortTiles(state.hand); message.value='手牌代码已解析'
  } catch(error) { message.value=error.message }
}
function clearAll() {
  state.hand.splice(0); state.kongs.splice(0); state.laiziKongs.splice(0)
  code.value=''; result.value={waits:[],error:'',structural:0}; message.value='已清空牌局'
}
function removeCopies(list,id,n) {
  for(let i=0;i<n;i++){ const index=list.indexOf(id); if(index<0)return false; list.splice(index,1) }
  return true
}
function makeKongs(tile, sizes) {
  const key=Array.isArray(sizes) ? sizes.join(',') : ''
  const option=availableKongOptions(state.hand,tile,state.kongs.length).find(item=>item.sizes.join(',')===key)
  if(!option) return message.value='可建立的杠组方案已变化，请重新选择'
  removeCopies(state.hand,tile,option.total)
  option.sizes.forEach(size=>state.kongs.push({tile,size}))
  message.value=`已用${option.total}张${tileName(tile)}建立${option.sizes.length}组杠（${option.sizes.join('+')}张）`
}
function removeKong(index) {
  const [kong]=state.kongs.splice(index,1)
  const size=kongSize(kong)
  state.hand.push(...Array(size).fill(kong.tile)); sortTiles(state.hand)
  message.value=`已撤回1组${tileName(kong.tile)}杠，返还${size}张`
}
function makeLaiziKong(id) {
  const index=state.hand.indexOf(id); if(index<0)return
  state.hand.splice(index,1); state.laiziKongs.push(id); message.value=`已建立${tileName(id)}杠`
}
function removeLaiziKong(index) { const [id]=state.laiziKongs.splice(index,1); state.hand.push(id); sortTiles(state.hand) }
function runCalculation() { result.value=calculateWaits(state); dirty.value=false; message.value=result.value.error || `找到${result.value.waits.length}种可胡牌` }
function formatNumber(n) { return Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString() }
function leftText(n) { return n===Infinity ? '无限' : `${n}张` }
</script>

<template>
  <main class="bb-page">
    <header class="bb-topbar">
      <RouterLink class="brand" to="/"><span class="brand-mark">变</span><span>百变斗牌<small>听牌与番数计算器</small></span></RouterLink>
      <nav class="page-nav"><RouterLink to="/">标准听牌</RouterLink><RouterLink class="active" to="/baibian">百变斗牌</RouterLink></nav>
      <span class="bb-rule">每种实体牌12张 · 癞子不限 · 自动择取最高番</span>
    </header>

    <section class="bb-hero">
      <div><span class="eyebrow">VARIABLE MAHJONG LAB</span><h1>每一张听牌，<em>算清每一番</em></h1><p>输入暗手与杠组，计算每张可胡牌的最佳癞子替代、理论番数和封顶结果。</p></div>
      <div class="bb-cap-grid"><div><b>3000</b><span>小胡</span></div><div><b>4000</b><span>大胡</span></div><div><b>6000</b><span>顶胡</span></div><div><b>9000</b><span>硬胡</span></div><div class="super"><b>指定</b><span>超级硬胡</span></div></div>
    </section>

    <section class="bb-summary">
      <div><span>实体牌</span><strong>{{ physicalTotal }}</strong></div><div><span>有效结构</span><strong>{{ structural }}</strong></div><div><span>普通杠</span><strong>{{ state.kongs.length }}</strong></div><div><span>赖子杠</span><strong>{{ state.laiziKongs.length }}</strong></div>
      <button class="primary" @click="runCalculation">{{ dirty ? '重新计算听牌' : '计算听牌与番数' }}</button><button class="ghost" @click="clearAll">清空</button>
    </section>

    <section v-if="result.waits.length" class="bb-best">
      <div><span>最高理论番数</span><strong>{{ formatNumber(result.theoreticalBest.score.theoretical) }}</strong><small>{{ tileName(result.theoreticalBest.id) }} · {{ result.theoreticalBest.score.categoryName }}</small></div>
      <div><span>最高封顶后番数</span><strong>{{ formatNumber(result.actualBest.score.actual) }}</strong><small>{{ tileName(result.actualBest.id) }} · 封顶{{ result.actualBest.score.cap }}</small></div>
      <p v-if="result.theoreticalBest.score.theoretical>result.theoreticalBest.score.cap">理论番数已超过对应胡牌等级的封顶，实战结算以封顶后数值为准。</p>
    </section>

    <section class="bb-panel">
      <div class="bb-panel-head"><div><span class="step">01</span><h2>牌局输入</h2></div><p>点击下方牌面加入暗手</p></div>
      <div class="bb-code"><label>暗手代码</label><div><input v-model="code" @keyup.enter="parseCodeInput" placeholder="234s666s222z la（癞子：lm/lp/ls/lz/la）"><button @click="parseCodeInput">解析</button></div></div>

      <div class="bb-state-zone"><div class="zone-title"><h3>暗手牌</h3><span>{{ state.hand.length }}张；点击移除</span></div><div class="bb-hand" :class="{empty:!state.hand.length}"><button v-for="(id,index) in state.hand" :key="`h-${id}-${index}`" class="tile selected" @click="removeTile(index)"><TileFace :id="id"><!-- --></TileFace><i>×</i></button><p v-if="!state.hand.length">从下方选择暗手牌</p></div></div>

      <div class="bb-picker">
        <div v-for="suit in SUITS" :key="suit.key" class="bb-suit"><h3>{{ suit.name }}牌</h3><div><button v-for="id in suit.tiles" :key="id" class="tile" :disabled="known[id]>=12" @click="addTile(id)"><TileFace :id="id"/><b v-if="countZone(id)">{{ countZone(id) }}</b><small>{{ 12-known[id] }}</small></button></div></div>
        <div class="bb-suit laizi-row"><h3>万能癞子</h3><div><button v-for="item in LAIZI_META" :key="item.id" class="tile" @click="addTile(item.id)"><TileFace :id="item.id"/><b v-if="countZone(item.id)">{{ countZone(item.id) }}</b><small>∞</small></button></div></div>
      </div>
    </section>

    <section class="bb-panel">
      <div class="bb-panel-head"><div><span class="step">02</span><h2>杠牌与场景</h2></div><p>每组普通杠至少4张，同牌可建立多组</p></div>
      <div class="bb-kong-layout">
        <div><h3>可建立普通杠</h3><div class="kong-options"><article v-for="item in eligibleKongs" :key="item.tile"><div class="kong-option-head"><span class="mini-tile"><TileFace :id="item.tile"/></span><div class="kong-option-copy"><b>{{ tileName(item.tile) }}</b><small>暗手{{ item.copies }}张 · 选择每组实际张数</small></div></div><div class="kong-choice-groups"><div v-for="group in item.optionGroups" :key="group.groupCount" class="kong-choice-row"><strong>开{{ group.groupCount }}组</strong><div><button v-for="option in group.options" :key="option.sizes.join('-')" @click="makeKongs(item.tile,option.sizes)">{{ option.sizes.join('+') }}张</button></div></div></div></article><p v-if="!eligibleKongs.length">{{ state.kongs.length>=4 ? '普通杠已达到4组上限' : '暗手中尚无4张同牌' }}</p></div></div>
        <div><h3>已建立的杠组</h3><div class="made-kongs"><button v-for="(kong,index) in state.kongs" :key="index" @click="removeKong(index)"><span v-for="n in kongSize(kong)" :key="n" class="mini-tile"><TileFace :id="kong.tile"/></span><small>{{ kongSize(kong) }}张暗手牌 · 点击撤回</small></button><p v-if="!state.kongs.length">暂无普通杠</p></div>
          <div class="laizi-kong-actions"><button v-for="item in LAIZI_META" :key="item.id" :disabled="!state.hand.includes(item.id)" @click="makeLaiziKong(item.id)">将{{ item.name }}设为赖子杠</button></div><div class="laizi-kongs"><button v-for="(id,index) in state.laiziKongs" :key="index" @click="removeLaiziKong(index)">{{ tileName(id) }} ×1.5 · 点击撤回</button></div>
        </div>
      </div>
      <div class="bb-flags"><label><input v-model="state.flags.tianHu" type="checkbox"> 天胡 ×20</label><label><input v-model="state.flags.gangShangKaiHua" type="checkbox"> 杠上开花 ×2</label><label><input v-model="state.flags.tianHuBonus" type="checkbox"> 天胡加成 ×2</label></div>
    </section>

    <section class="bb-panel bb-results">
      <div class="bb-panel-head"><div><span class="step">03</span><h2>逐张听牌番数</h2></div><p>{{ dirty && result.waits.length ? '牌局已修改，请重新计算' : message }}</p></div>
      <div v-if="!result.waits.length" class="bb-empty"><span>听</span><p>{{ result.error || '录入满足3n+1的牌局后点击“计算听牌与番数”' }}</p></div>
      <article v-for="wait in result.waits" :key="wait.id" class="wait-card">
        <div class="wait-main"><div class="tile hero-wait"><TileFace :id="wait.id"/></div><div><h3>{{ tileName(wait.id) }}</h3><span>理论剩余 {{ leftText(wait.left) }}</span></div><div class="score"><small>理论</small><strong>{{ formatNumber(wait.score.theoretical) }}</strong></div><div class="score actual"><small>封顶后</small><strong>{{ formatNumber(wait.score.actual) }}</strong></div><div class="rank" :class="wait.score.category">{{ wait.score.categoryName }}<small>封顶 {{ wait.score.cap }}</small></div></div>
        <div v-if="wait.score.theoretical>wait.score.cap" class="cap-warning">理论{{ formatNumber(wait.score.theoretical) }}番超过{{ wait.score.categoryName }}封顶，实际按{{ wait.score.cap }}番计算。</div>
        <details><summary>查看番型、倍率与最佳拆分</summary><div class="detail-grid"><div><h4>加法番（{{ formatNumber(wait.score.additiveTotal) }}）</h4><ul><li v-for="fan in wait.score.additive" :key="fan.id"><span>{{ fan.name }}</span><b>+{{ fan.value }}</b></li></ul></div><div><h4>乘法番（×{{ formatNumber(wait.score.multiplier) }}）</h4><ul><li v-for="fan in wait.score.multipliers" :key="fan.id"><span>{{ fan.name }}</span><b>×{{ fan.value }}</b></li><li v-if="!wait.score.multipliers.length">无乘法番</li></ul></div><div><h4>最佳拆分</h4><ul><li v-for="(group,index) in describeSolution(wait.solution)" :key="index"><span>{{ group.type }}</span><b>{{ group.tiles }}</b></li></ul></div><div><h4>癞子替代</h4><ul><li v-for="(text,index) in describeAssignments(wait.solution)" :key="index">{{ text }}</li><li v-if="!wait.solution.assignments.length">无癞子替代，满足硬胡条件</li></ul></div></div><div v-if="wait.alternatives?.length" class="alternate-solutions"><h4>其他合法方案（不与最佳方案叠加）</h4><article v-for="(alternative,index) in wait.alternatives" :key="index"><div><strong>{{ alternative.score.additive.map(fan=>fan.name).join('＋') }}</strong><span>{{ alternative.score.categoryName }} · 实际{{ formatNumber(alternative.score.actual) }}番</span></div><small>{{ describeAssignments(alternative.solution).join('、') || '无癞子替代' }}</small></article></div></details>
      </article>
    </section>
    <footer><span>百变斗牌规则来源：public/note</span><span>理论剩余不扣除未知对手手牌</span></footer>
  </main>
</template>

<style scoped>
.alternate-solutions { margin-top:14px; padding-top:12px; border-top:1px solid #e5e0d4; }
.alternate-solutions h4 { margin:0 0 8px; font-size:11px; }
.alternate-solutions article { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-top:1px dotted #ddd8cb; }
.alternate-solutions article:first-of-type { border-top:0; }
.alternate-solutions article div { display:flex; flex-direction:column; gap:2px; }
.alternate-solutions article strong { font-size:11px; }
.alternate-solutions article span, .alternate-solutions article small { font-size:9px; color:#788681; }
.alternate-solutions article small { text-align:right; max-width:48%; }
</style>
