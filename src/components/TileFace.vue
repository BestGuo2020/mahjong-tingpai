<script setup>
import { computed } from 'vue'

const props = defineProps({ id: { type: [Number, String], required: true } })
const laiziNames = { lm: '万赖', lp: '筒赖', ls: '条赖', lz: '字赖', la: '万能赖' }
const isLaizi = computed(() => typeof props.id === 'string')
const tileImage = computed(() => {
  if (isLaizi.value) return ''
  if (props.id < 9) return `/tiles/${props.id + 1}m.png`
  if (props.id < 18) return `/tiles/${props.id - 8}p.png`
  if (props.id < 27) return `/tiles/${props.id - 17}s.png`
  return `/tiles/${props.id - 26}z.png`
})
</script>

<template>
  <div v-if="isLaizi" class="tile-face laizi-face" :class="`laizi-${id}`">
    <span>赖</span><small>{{ laiziNames[id] }}</small>
  </div>
  <div v-else class="tile-face image-face">
    <img :src="tileImage" alt="" draggable="false" />
  </div>
</template>
