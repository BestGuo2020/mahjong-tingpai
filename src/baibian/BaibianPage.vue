<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
const messageType = ref('status')
const result = ref({ waits:[], error:'', structural:0 })
const dirty = ref(false)
const pickerExpanded = ref(true)
const resultsSection = ref(null)
const openWaitId = ref(null)
const waitDetailPanel = ref(null)
const waitDetailPositioned = ref(false)
const waitDetailPlacement = ref('bottom')
const waitDetailStyle = ref({})
const history = ref([])
const HISTORY_LIMIT = 50
let waitDetailAnchor = null
let waitDetailCloseTimer = null
let waitDetailPinned = false

const known = computed(() => knownPhysicalCounts(state))
const physicalTotal = computed(() => known.value.reduce((a,b)=>a+b,0))
const structural = computed(() => state.hand.length + state.kongs.length * 3)
const canUndo = computed(() => history.value.length > 0)
const hasEditableState = computed(() => state.hand.length > 0 || state.kongs.length > 0 || state.laiziKongs.length > 0 || code.value || Object.values(state.flags).some(Boolean))
const inputFeedback = computed(() => dirty.value && result.value.waits.length
  ? `${message.value ? `${message.value}；` : ''}牌局已修改，请重新计算`
  : message.value)
const inputFeedbackIsError = computed(() => messageType.value === 'error' || Boolean(result.value.error))
const activeWait = computed(() => result.value.waits.find(wait=>wait.id===openWaitId.value) || null)
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
function takeSnapshot() {
  return {
    hand:[...state.hand],
    kongs:state.kongs.map(kong=>({...kong})),
    laiziKongs:[...state.laiziKongs],
    flags:{...state.flags},
    code:code.value
  }
}
function pushHistory() {
  history.value.push(takeSnapshot())
  if(history.value.length>HISTORY_LIMIT) history.value.shift()
}
function setMessage(text,type='status') { message.value=text; messageType.value=type }
function markEdited(text) {
  closeWaitDetails()
  dirty.value=true
  if(result.value.error) result.value={...result.value,error:''}
  setMessage(text)
}
function undoLastEdit() {
  const snapshot=history.value.pop()
  if(!snapshot) return
  closeWaitDetails()
  state.hand.splice(0,state.hand.length,...snapshot.hand)
  state.kongs.splice(0,state.kongs.length,...snapshot.kongs.map(kong=>({...kong})))
  state.laiziKongs.splice(0,state.laiziKongs.length,...snapshot.laiziKongs)
  Object.assign(state.flags,snapshot.flags)
  code.value=snapshot.code
  result.value={waits:[],error:'',structural:0}
  dirty.value=true
  setMessage('已撤销上一步操作')
}
function addTile(id) {
  if (typeof id === 'number' && known.value[id] >= 12) return setMessage(`${tileName(id)}总数已达到12张`,'error')
  pushHistory()
  state.hand.push(id); sortTiles(state.hand)
  markEdited(`已添加${tileName(id)}，暗手共${state.hand.length}张`)
}
function removeTile(index) {
  const id=state.hand[index]
  if(id===undefined) return
  pushHistory(); state.hand.splice(index,1); markEdited(`已移除${tileName(id)}，暗手共${state.hand.length}张`)
}
function parseCodeInput() {
  try {
    const parsed=parseTileCode(code.value)
    const nextPhysical=Array(34).fill(0)
    parsed.forEach(id=>{ if(typeof id==='number') nextPhysical[id]++ })
    state.kongs.forEach(k=>nextPhysical[k.tile]+=kongSize(k))
    const over=nextPhysical.findIndex(n=>n>12)
    if(over>=0) throw new Error(`${tileName(over)}在暗手牌和杠组中合计超过12张`)
    pushHistory()
    state.hand.splice(0,state.hand.length,...parsed); sortTiles(state.hand); markEdited(`手牌代码已解析，共${state.hand.length}张`)
  } catch(error) { setMessage(error.message,'error') }
}
function clearAll() {
  if(!hasEditableState.value) return
  closeWaitDetails()
  pushHistory()
  state.hand.splice(0); state.kongs.splice(0); state.laiziKongs.splice(0)
  Object.keys(state.flags).forEach(key=>{ state.flags[key]=false })
  code.value=''; result.value={waits:[],error:'',structural:0}; dirty.value=false; setMessage('已清空牌局，可撤销恢复')
}
function removeCopies(list,id,n) {
  for(let i=0;i<n;i++){ const index=list.indexOf(id); if(index<0)return false; list.splice(index,1) }
  return true
}
function makeKongs(tile, sizes) {
  const key=Array.isArray(sizes) ? sizes.join(',') : ''
  const option=availableKongOptions(state.hand,tile,state.kongs.length).find(item=>item.sizes.join(',')===key)
  if(!option) return setMessage('可建立的杠组方案已变化，请重新选择','error')
  pushHistory()
  removeCopies(state.hand,tile,option.total)
  option.sizes.forEach(size=>state.kongs.push({tile,size}))
  markEdited(`已用${option.total}张${tileName(tile)}建立${option.sizes.length}组杠（${option.sizes.join('+')}张）`)
}
function removeKong(index) {
  if(!state.kongs[index]) return
  pushHistory()
  const [kong]=state.kongs.splice(index,1)
  const size=kongSize(kong)
  state.hand.push(...Array(size).fill(kong.tile)); sortTiles(state.hand)
  markEdited(`已撤回1组${tileName(kong.tile)}杠，返还${size}张`)
}
function makeLaiziKong(id) {
  const index=state.hand.indexOf(id); if(index<0)return
  pushHistory(); state.hand.splice(index,1); state.laiziKongs.push(id); markEdited(`已建立${tileName(id)}杠`)
}
function removeLaiziKong(index) {
  if(!state.laiziKongs[index]) return
  pushHistory(); const [id]=state.laiziKongs.splice(index,1); state.hand.push(id); sortTiles(state.hand); markEdited(`已撤回${tileName(id)}杠`)
}
function toggleFlag(key,event) {
  pushHistory(); state.flags[key]=event.target.checked; markEdited(`${event.target.checked?'已启用':'已关闭'}${event.target.parentElement?.textContent?.trim() || '场景条件'}`)
}
async function runCalculation() {
  closeWaitDetails()
  result.value=calculateWaits(state)
  dirty.value=false
  setMessage(result.value.error || `找到${result.value.waits.length}种可胡牌`,result.value.error?'error':'status')
  if(result.value.error) return
  await nextTick()
  resultsSection.value?.scrollIntoView({behavior:'smooth',block:'start'})
}
function clearWaitDetailCloseTimer() {
  if(waitDetailCloseTimer!==null) { window.clearTimeout(waitDetailCloseTimer); waitDetailCloseTimer=null }
}
function showWaitDetails(id,event) {
  clearWaitDetailCloseTimer()
  openWaitId.value=id
  waitDetailAnchor=event.currentTarget
  waitDetailPositioned.value=false
  nextTick(updateWaitDetailPosition)
}
function scheduleWaitDetailClose() {
  if(waitDetailPinned) return
  clearWaitDetailCloseTimer()
  waitDetailCloseTimer=window.setTimeout(closeWaitDetails,120)
}
function closeWaitDetails() {
  clearWaitDetailCloseTimer()
  openWaitId.value=null
  waitDetailAnchor=null
  waitDetailPinned=false
  waitDetailPositioned.value=false
}
function toggleWaitDetails(id,event) {
  if(waitDetailPinned && openWaitId.value===id) return closeWaitDetails()
  waitDetailPinned=true
  showWaitDetails(id,event)
}
function updateWaitDetailPosition() {
  if(openWaitId.value===null || !waitDetailAnchor || !waitDetailPanel.value) return
  const anchor=waitDetailAnchor.getBoundingClientRect()
  const panel=waitDetailPanel.value.getBoundingClientRect()
  const margin=16
  const gap=10
  const viewportWidth=window.innerWidth
  const viewportHeight=window.innerHeight
  const spaceAbove=anchor.top-margin-gap
  const spaceBelow=viewportHeight-anchor.bottom-margin-gap
  const placement=spaceBelow>=panel.height || spaceBelow>=spaceAbove ? 'bottom' : 'top'
  let top=placement==='bottom' ? anchor.bottom+gap : anchor.top-panel.height-gap
  top=Math.max(margin,Math.min(top,viewportHeight-panel.height-margin))
  let left=anchor.left+anchor.width/2-panel.width/2
  left=Math.max(margin,Math.min(left,viewportWidth-panel.width-margin))
  const arrowX=Math.max(18,Math.min(anchor.left+anchor.width/2-left,panel.width-18))
  waitDetailPlacement.value=placement
  waitDetailStyle.value={top:`${Math.round(top)}px`,left:`${Math.round(left)}px`,'--wait-detail-arrow-x':`${Math.round(arrowX)}px`}
  waitDetailPositioned.value=true
}
function handleWaitDetailViewportChange() {
  if(openWaitId.value!==null) updateWaitDetailPosition()
}
onMounted(() => {
  window.addEventListener('resize',handleWaitDetailViewportChange)
  window.addEventListener('scroll',handleWaitDetailViewportChange,true)
})
onBeforeUnmount(() => {
  clearWaitDetailCloseTimer()
  window.removeEventListener('resize',handleWaitDetailViewportChange)
  window.removeEventListener('scroll',handleWaitDetailViewportChange,true)
})
function formatNumber(n) { return Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString() }
function leftText(n) { return n===Infinity ? '无限' : `${n}张` }
</script>

<template>
  <main class="bb-page" @click="closeWaitDetails">
    <header class="bb-topbar">
      <RouterLink class="brand" to="/"><span class="brand-mark">变</span><span>百变斗牌<small>听牌与番数计算器</small></span></RouterLink>
      <nav class="page-nav"><RouterLink to="/">标准听牌</RouterLink><RouterLink class="active" to="/baibian/">百变斗牌</RouterLink></nav>
      <span class="bb-rule">每种实体牌12张 · 癞子不限 · 自动择取最高番</span>
    </header>

    <section class="bb-hero">
      <div><span class="eyebrow">VARIABLE MAHJONG LAB</span><h1>每一张听牌，<em>算清每一番</em></h1><p>输入暗手与杠组，计算每张可胡牌的最佳癞子替代、理论番数和封顶结果。</p></div>
      <div class="bb-cap-grid"><div><b>3000</b><span>小胡</span></div><div><b>4000</b><span>大胡</span></div><div><b>6000</b><span>顶胡</span></div><div><b>9000</b><span>硬胡</span></div><div class="super"><b>牌型决定上限</b><span>超级硬胡</span></div></div>
    </section>

    <section class="bb-summary">
      <div><span>实体牌</span><strong>{{ physicalTotal }}</strong></div><div><span>有效结构</span><strong>{{ structural }}</strong></div><div><span>普通杠</span><strong>{{ state.kongs.length }}</strong></div><div><span>赖子杠</span><strong>{{ state.laiziKongs.length }}</strong></div>
      <button class="primary" aria-label="计算当前牌局的听牌与番数" @click="runCalculation">{{ dirty ? '重新计算听牌' : '计算听牌与番数' }}</button><button class="ghost" :disabled="!hasEditableState" aria-label="清空当前牌局" @click="clearAll">清空</button>
    </section>

    <section v-if="result.waits.length" class="bb-best">
      <div><span>最高理论番数</span><strong>{{ formatNumber(result.theoreticalBest.score.theoretical) }}</strong><small>{{ tileName(result.theoreticalBest.id) }} · {{ result.theoreticalBest.score.categoryName }}</small></div>
      <div><span>最高封顶后番数</span><strong>{{ formatNumber(result.actualBest.score.actual) }}</strong><small>{{ tileName(result.actualBest.id) }} · 封顶{{ result.actualBest.score.cap }}</small></div>
      <p v-if="result.theoreticalBest.score.theoretical>result.theoreticalBest.score.cap">理论番数已超过对应胡牌等级的封顶，实战结算以封顶后数值为准。</p>
    </section>

    <section class="bb-panel">
      <div class="bb-panel-head"><div><span class="step">01</span><h2>牌局输入</h2></div><p>点击下方牌面加入暗手</p></div>
      <details class="bb-input-guide">
        <summary>输入说明</summary>
        <div class="bb-input-guide-content">
          <p><strong>牌面录入：</strong>点击牌库中的牌加入暗手，点击暗手中的牌即可移除；系统会自动理牌并标注已选数量。</p>
          <p><strong>代码录入：</strong>数字后接 <code>m / p / s / z</code>，分别表示万、筒、条、字牌，例如 <code>123m456p789s1112z</code>。</p>
          <p><strong>癞子代码：</strong><code>lm / lp / ls / lz / la</code> 分别表示万赖、筒赖、条赖、字赖和万能赖。</p>
          <p><strong>计算条件：</strong>暗手与杠组折算后的有效结构须满足 <code>3n+1</code>；普通实体牌每种最多录入12张。</p>
        </div>
      </details>
      <div class="bb-code"><label for="bb-hand-code">暗手代码</label><div><input id="bb-hand-code" v-model="code" @keyup.enter="parseCodeInput" placeholder="234s666s222z la（癞子：lm/lp/ls/lz/la）"><button aria-label="解析暗手代码" @click="parseCodeInput">解析</button></div></div>

      <div class="bb-state-zone"><div class="zone-title"><h3>暗手牌</h3><span>{{ state.hand.length }}张；点击移除</span></div><div class="bb-hand" :class="{empty:!state.hand.length}"><button v-for="(id,index) in state.hand" :key="`h-${id}-${index}`" class="tile selected" :aria-label="`移除${tileName(id)}`" @click="removeTile(index)"><TileFace :id="id"><!-- --></TileFace><i>×</i></button><p v-if="!state.hand.length">从下方选择暗手牌</p></div></div>

      <div class="bb-input-toolbar">
        <p class="bb-input-feedback" :class="{error:inputFeedbackIsError}" aria-live="polite">{{ inputFeedback || '可点击牌面录入，或粘贴代码快速解析' }}</p>
        <div class="bb-input-actions">
          <button class="bb-tool-button" :disabled="!canUndo" aria-label="撤销上一步牌局编辑" @click="undoLastEdit">撤销上一步</button>
          <button class="bb-tool-button" :disabled="!hasEditableState" aria-label="清空当前牌局" @click="clearAll">清空牌局</button>
          <button class="bb-tool-button" type="button" :aria-expanded="pickerExpanded" aria-controls="bb-tile-picker" @click="pickerExpanded=!pickerExpanded">{{ pickerExpanded ? '收起牌库' : '展开牌库' }}</button>
          <button class="primary" aria-label="计算当前牌局的听牌与番数" @click="runCalculation">{{ dirty ? '重新计算听牌' : '计算听牌与番数' }}</button>
        </div>
      </div>

      <Transition name="bb-picker-collapse">
        <div v-show="pickerExpanded" id="bb-tile-picker" class="bb-picker">
          <div v-for="suit in SUITS" :key="suit.key" class="bb-suit"><h3>{{ suit.name }}牌</h3><div><button v-for="id in suit.tiles" :key="id" class="tile" :disabled="known[id]>=12" :aria-label="`添加${tileName(id)}，剩余${12-known[id]}张`" @click="addTile(id)"><TileFace :id="id"/><b v-if="countZone(id)">{{ countZone(id) }}</b><small>{{ 12-known[id] }}</small></button></div></div>
          <div class="bb-suit laizi-row"><h3>万能癞子</h3><div><button v-for="item in LAIZI_META" :key="item.id" class="tile" :aria-label="`添加${item.name}`" @click="addTile(item.id)"><TileFace :id="item.id"/><b v-if="countZone(item.id)">{{ countZone(item.id) }}</b><small>∞</small></button></div></div>
        </div>
      </Transition>
    </section>

    <section class="bb-panel">
      <div class="bb-panel-head"><div><span class="step">02</span><h2>杠牌与场景</h2></div><p>每组普通杠至少4张，同牌可建立多组</p></div>
      <div class="bb-kong-layout">
        <div><h3>可建立普通杠</h3><div class="kong-options"><article v-for="item in eligibleKongs" :key="item.tile"><div class="kong-option-head"><span class="mini-tile"><TileFace :id="item.tile"/></span><div class="kong-option-copy"><b>{{ tileName(item.tile) }}</b><small>暗手{{ item.copies }}张 · 选择每组实际张数</small></div></div><div class="kong-choice-groups"><div v-for="group in item.optionGroups" :key="group.groupCount" class="kong-choice-row"><strong>开{{ group.groupCount }}组</strong><div><button v-for="option in group.options" :key="option.sizes.join('-')" @click="makeKongs(item.tile,option.sizes)">{{ option.sizes.join('+') }}张</button></div></div></div></article><p v-if="!eligibleKongs.length">{{ state.kongs.length>=4 ? '普通杠已达到4组上限' : '暗手中尚无4张同牌' }}</p></div></div>
        <div><h3>已建立的杠组</h3><div class="made-kongs"><button v-for="(kong,index) in state.kongs" :key="index" @click="removeKong(index)"><span v-for="n in kongSize(kong)" :key="n" class="mini-tile"><TileFace :id="kong.tile"/></span><small>{{ kongSize(kong) }}张暗手牌 · 点击撤回</small></button><p v-if="!state.kongs.length">暂无普通杠</p></div>
          <div class="laizi-kong-actions"><button v-for="item in LAIZI_META" :key="item.id" :disabled="!state.hand.includes(item.id)" @click="makeLaiziKong(item.id)">将{{ item.name }}设为赖子杠</button></div><div class="laizi-kongs"><button v-for="(id,index) in state.laiziKongs" :key="index" @click="removeLaiziKong(index)">{{ tileName(id) }} ×1.5 · 点击撤回</button></div>
        </div>
      </div>
      <div class="bb-flags"><label><input :checked="state.flags.tianHu" type="checkbox" @change="toggleFlag('tianHu',$event)"> 天胡 ×20</label><label><input :checked="state.flags.gangShangKaiHua" type="checkbox" @change="toggleFlag('gangShangKaiHua',$event)"> 杠上开花 ×2</label><label><input :checked="state.flags.tianHuBonus" type="checkbox" @change="toggleFlag('tianHuBonus',$event)"> 天胡加成 ×2</label></div>
    </section>

    <section ref="resultsSection" class="bb-panel bb-results">
      <div class="bb-panel-head"><div><span class="step">03</span><h2>逐张听牌番数</h2></div><p>{{ inputFeedback }}</p></div>
      <div v-if="!result.waits.length" class="bb-empty"><span>听</span><p>{{ result.error || '录入满足3n+1的牌局后点击“计算听牌与番数”' }}</p></div>
      <div v-if="result.waits.length" class="bb-wait-grid">
        <article v-for="wait in result.waits" :key="wait.id" class="wait-card">
          <div class="wait-main">
            <button class="tile hero-wait wait-detail-trigger" type="button" :aria-label="`查看${tileName(wait.id)}的番型、倍率与最佳拆分`" :aria-expanded="openWaitId===wait.id" aria-controls="wait-detail-tooltip" @mouseenter="showWaitDetails(wait.id,$event)" @mouseleave="scheduleWaitDetailClose" @focus="showWaitDetails(wait.id,$event)" @blur="scheduleWaitDetailClose" @keydown.esc.stop="closeWaitDetails" @click.stop="toggleWaitDetails(wait.id,$event)"><TileFace :id="wait.id"/></button>
            <div class="wait-identity"><h3>{{ tileName(wait.id) }}</h3><span>剩余 {{ leftText(wait.left) }}</span></div><div class="score"><small>理论</small><strong>{{ formatNumber(wait.score.theoretical) }}</strong></div><div class="score actual"><small>封顶后</small><strong>{{ formatNumber(wait.score.actual) }}</strong></div><div class="rank" :class="wait.score.category">{{ wait.score.categoryName }}<small>封顶 {{ wait.score.cap }}</small></div>
          </div>
          <div v-if="wait.score.theoretical>wait.score.cap" class="cap-warning">理论{{ formatNumber(wait.score.theoretical) }}番超过封顶，实际按{{ wait.score.cap }}番计算。</div>
        </article>
      </div>
      <Teleport to="body">
        <div v-if="activeWait" id="wait-detail-tooltip" ref="waitDetailPanel" class="wait-detail-panel wait-detail-floating" :class="[`is-${waitDetailPlacement}`,{positioned:waitDetailPositioned}]" :style="waitDetailStyle" role="tooltip" @mouseenter="clearWaitDetailCloseTimer" @mouseleave="scheduleWaitDetailClose" @click.stop>
          <div class="wait-detail-heading"><strong>{{ tileName(activeWait.id) }} · 番型详情</strong><span>悬停或点击牌面查看</span></div>
          <div class="detail-grid"><div><h4>加法番（{{ formatNumber(activeWait.score.additiveTotal) }}）</h4><ul><li v-for="fan in activeWait.score.additive" :key="fan.id"><span>{{ fan.name }}</span><b>+{{ fan.value }}</b></li></ul></div><div><h4>乘法番（×{{ formatNumber(activeWait.score.multiplier) }}）</h4><ul><li v-for="fan in activeWait.score.multipliers" :key="fan.id"><span>{{ fan.name }}</span><b>×{{ fan.value }}</b></li><li v-if="!activeWait.score.multipliers.length">无乘法番</li></ul></div><div><h4>最佳拆分</h4><ul><li v-for="(group,index) in describeSolution(activeWait.solution)" :key="index"><span>{{ group.type }}</span><b>{{ group.tiles }}</b></li></ul></div><div><h4>癞子替代</h4><ul><li v-for="(text,index) in describeAssignments(activeWait.solution)" :key="index">{{ text }}</li><li v-if="!activeWait.solution.assignments.length">无癞子替代，满足硬胡条件</li></ul></div></div><div v-if="activeWait.alternatives?.length" class="alternate-solutions"><h4>其他合法方案（不与最佳方案叠加）</h4><article v-for="(alternative,index) in activeWait.alternatives" :key="index"><div><strong>{{ alternative.score.additive.map(fan=>fan.name).join('＋') }}</strong><span>{{ alternative.score.categoryName }} · 实际{{ formatNumber(alternative.score.actual) }}番</span></div><small>{{ describeAssignments(alternative.solution).join('、') || '无癞子替代' }}</small></article></div>
        </div>
      </Teleport>
    </section>

    <section class="bb-panel bb-about" aria-labelledby="bb-about-title">
      <div class="bb-panel-head"><div><span class="step">说明</span><h2 id="bb-about-title">关于本工具</h2></div><p>使用介绍与注意事项</p></div>
      <div class="bb-about-grid">
        <article>
          <h3>页面介绍</h3>
          <ul>
            <li>本工具用于分析百变斗牌的逐张听牌结果。录入暗手、普通杠、癞子杠和场景条件后，可查看每张可胡牌的理论番数、封顶后番数、番型构成、最佳拆分及癞子替代方案。</li>
            <li>本工具适合研究清一色多面听（俗称假高手）的最佳多面听。</li>
            <li>由于百变斗牌最大的根数可以到12根，实际设计的时候用到3副麻将牌。</li>
          </ul>
        </article>
        <article>
          <h3>使用提示</h3>
          <ul>
            <li>桌面端悬停或点击听牌牌面查看详情；触屏设备请点击牌面。</li>
            <li>“理论番数”展示完整计算值，“封顶后番数”才是按对应牌型上限处理后的结果。</li>
            <li>页面显示的理论剩余张数仅扣除当前已知牌，不扣除未知的对手手牌。</li>
            <li>规则与番型依据《百变斗牌规则》和本人实战游玩经验整理，实战番型与规则描述会有不一致的地方，结果仅供学习研究与规则讨论参考。</li>
          </ul>
        </article>
      </div>
    </section>

    <footer class="bb-footer">
      <span>© 2026 BestGuo2020 · 百变斗牌听牌与番数计算器</span>
      <strong>本程序仅供学习与研究使用，禁止任何形式的商业化运作。</strong>
    </footer>
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
