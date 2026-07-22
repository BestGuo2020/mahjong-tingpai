<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import TileFace from './components/TileFace.vue'
import BaibianPage from './baibian/BaibianPage.vue'

const route = useRoute()

const suits = [
  { key: 'm', name: '万', tiles: Array.from({length: 9}, (_, i) => i) },
  { key: 'p', name: '筒', tiles: Array.from({length: 9}, (_, i) => i + 9) },
  { key: 's', name: '条', tiles: Array.from({length: 9}, (_, i) => i + 18) },
  { key: 'z', name: '字', tiles: Array.from({length: 7}, (_, i) => i + 27) }
]
const honorNames = ['东', '南', '西', '北', '中', '发', '白']
const glyphs = Array.from({length: 34}, (_, i) => {
  if (i < 9) return String.fromCodePoint(0x1F007 + i)
  if (i < 18) return String.fromCodePoint(0x1F019 + (i - 9))
  if (i < 27) return String.fromCodePoint(0x1F010 + (i - 18))
  return String.fromCodePoint([0x1F000,0x1F001,0x1F002,0x1F003,0x1F004,0x1F005,0x1F006][i - 27])
})
const tiles = ref([])
const code = ref('')
const error = ref('')

function tileCode(i) { return i < 27 ? `${i % 9 + 1}${['m','p','s'][Math.floor(i / 9)]}` : `${i - 26}z` }
function tileName(i) { return i < 9 ? `${i + 1}万` : i < 18 ? `${i - 8}筒` : i < 27 ? `${i - 17}条` : honorNames[i - 27] }
function countOf(i) { return tiles.value.filter(x => x === i).length }
function addTile(i) {
  error.value = ''
  if (tiles.value.length >= 14) return error.value = '手牌最多只能有 14 张'
  if (countOf(i) >= 4) return error.value = '同一种牌最多只能有 4 张'
  tiles.value.push(i); tiles.value.sort((a,b) => a-b)
}
function removeAt(index) { tiles.value.splice(index, 1); error.value = '' }
function undo() { tiles.value.pop(); error.value = '' }
function clearAll() { tiles.value = []; code.value = ''; error.value = '' }

function parseCode() {
  const input = code.value.trim().toLowerCase().replace(/\s+/g, '')
  if (!input) return error.value = '请先输入手牌代码'
  const result = []; let digits = ''
  for (const ch of input) {
    if (/[1-9]/.test(ch)) { digits += ch; continue }
    if (!/[mpsz]/.test(ch) || !digits) return error.value = '格式不正确，请参考：123m456p789s12344z'
    const base = {m:0,p:9,s:18,z:27}[ch]
    for (const d of digits) {
      const n = Number(d)
      if (ch === 'z' && n > 7) return error.value = '字牌编号只能是 1–7'
      result.push(base + n - 1)
    }
    digits = ''
  }
  if (digits) return error.value = '数字后需要标注花色 m / p / s / z'
  if (result.length > 14) return error.value = '手牌最多只能有 14 张'
  const counts = Array(34).fill(0); result.forEach(i => counts[i]++)
  if (counts.some(n => n > 4)) return error.value = '同一种牌最多只能有 4 张'
  tiles.value = result.sort((a,b) => a-b); error.value = ''
}

function standardWin(counts) {
  function meldable(c) {
    const i = c.findIndex(n => n > 0)
    if (i < 0) return true
    if (c[i] >= 3) { c[i] -= 3; if (meldable(c)) return true; c[i] += 3 }
    if (i < 27 && i % 9 <= 6 && c[i+1] && c[i+2]) {
      c[i]--; c[i+1]--; c[i+2]--; if (meldable(c)) return true
      c[i]++; c[i+1]++; c[i+2]++
    }
    return false
  }
  for (let i=0; i<34; i++) if (counts[i] >= 2) {
    const c = [...counts]; c[i] -= 2
    if (meldable(c)) return true
  }
  return false
}
function isAllUnrelated(counts) {
  if (counts.reduce((a,b) => a+b, 0) !== 14 || counts.some(n => n > 1)) return false
  const groups = [[0,3,6], [1,4,7], [2,5,8]]
  const permutations = [
    [0,1,2], [0,2,1], [1,0,2],
    [1,2,0], [2,0,1], [2,1,0]
  ]
  return permutations.some(order => {
    const allowed = new Set(Array.from({length: 7}, (_, i) => i + 27))
    order.forEach((groupIndex, suitIndex) => {
      groups[groupIndex].forEach(rankIndex => allowed.add(suitIndex * 9 + rankIndex))
    })
    return counts.every((n, i) => n === 0 || allowed.has(i))
  })
}
function isWin(counts) {
  const total = counts.reduce((a,b) => a+b, 0)
  if (total % 3 !== 2) return false
  if (isAllUnrelated(counts)) return true
  if (total === 14 && counts.filter(n => n === 2).length === 7) return true
  if (total === 14) {
    const yaochu = [0,8,9,17,18,26,27,28,29,30,31,32,33]
    if (yaochu.every(i => counts[i] > 0) && yaochu.some(i => counts[i] > 1)) return true
  }
  return standardWin(counts)
}
const waits = computed(() => {
  if (tiles.value.length % 3 !== 1) return []
  const counts = Array(34).fill(0); tiles.value.forEach(i => counts[i]++)
  const out = []
  for (let i=0; i<34; i++) if (counts[i] < 4) { counts[i]++; if (isWin(counts)) out.push({ id:i, left:4-counts[i]+1 }); counts[i]-- }
  return out
})
const statusText = computed(() => {
  const n = tiles.value.length
  if (!n) return '请粘贴代码或点击下方牌面开始'
  if (n % 3 !== 1) return `当前 ${n} 张；需要 3n+1 张手牌才能计算听牌`
  return waits.value.length ? `好牌！共听 ${waits.value.length} 种牌` : '当前牌型没有听牌'
})
</script>

<template>
  <BaibianPage v-if="route.name === 'baibian'" />
  <main v-else>
    <header class="topbar"><RouterLink class="brand" to="/"><span class="brand-mark">聴</span><span>听见<small>麻将听牌计算器</small></span></RouterLink><nav class="page-nav"><RouterLink to="/">标准听牌</RouterLink><RouterLink to="/baibian/">百变斗牌</RouterLink></nav><span class="rule">标准国标牌型 · 含七对 / 十三幺 / 全不靠</span></header>
    <section class="hero">
      <div><span class="eyebrow">MAHJONG READY HAND</span><h1>下一张，<em>听什么？</em></h1><p>输入你的手牌，即刻算出全部听牌。简单、准确，不错过每一次和牌。</p></div>
      <div class="hero-tile" aria-hidden="true">🀄</div>
    </section>

    <section class="workbench">
      <div class="code-row">
        <div class="field"><label for="code">粘贴手牌代码</label><div class="input-wrap"><input id="code" v-model="code" @keyup.enter="parseCode" placeholder="例如：123m456p789s1234z"/><button @click="parseCode">解析手牌</button></div><small>m = 万，p = 筒，s = 条，z = 字牌</small></div>
      </div>

      <div class="hand-head"><div><span class="step">01</span><h2>我的手牌</h2><span class="count">{{ tiles.length }} / 14 张</span></div><div class="actions"><button @click="undo" :disabled="!tiles.length">↶ 撤销</button><button @click="clearAll" :disabled="!tiles.length">清空</button></div></div>
      <div class="hand" :class="{empty: !tiles.length}">
        <button v-for="(tile, index) in tiles" :key="`${tile}-${index}`" class="tile selected" @click="removeAt(index)" :aria-label="`移除${tileName(tile)}`"><TileFace :id="tile"/><i>×</i></button>
        <div v-if="!tiles.length" class="placeholder"><b>+</b><span>从下方选择手牌</span></div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>

      <div class="result" :class="{active: waits.length}">
        <div class="result-title"><span class="step">02</span><div><h2>听牌结果</h2><p>{{ statusText }}</p></div></div>
        <div v-if="waits.length" class="waits"><div v-for="w in waits" :key="w.id" class="wait-item"><div class="tile"><TileFace :id="w.id"/></div><strong>{{ tileName(w.id) }}</strong><small>剩余 {{ w.left }} 张</small></div></div>
        <div v-else class="result-empty"><span>听</span><p>凑齐 3n+1 张手牌后<br/>听牌会显示在这里</p></div>
      </div>
    </section>

    <section class="picker"><div class="picker-head"><div><span class="step">03</span><h2>点击牌面输入</h2></div><p>再次点击上方手牌可移除</p></div>
      <div v-for="suit in suits" :key="suit.key" class="suit-row"><h3>{{ suit.name }}牌</h3><div class="tile-grid"><button v-for="tile in suit.tiles" :key="tile" class="tile" :disabled="countOf(tile)>=4 || tiles.length>=14" @click="addTile(tile)" :aria-label="`添加${tileName(tile)}`"><TileFace :id="tile"/><b v-if="countOf(tile)">{{ countOf(tile) }}</b></button></div></div>
    </section>
    <footer><span>听见 · 让每一手牌都更清晰</span><span>计算结果仅供娱乐参考</span></footer>
  </main>
</template>
