<script setup>
import { computed } from 'vue'

const props = defineProps({ id: { type: [Number, String], required: true } })
const isLaizi = computed(() => typeof props.id === 'string')
const tileImage = computed(() => {
  if (isLaizi.value) return `/tiles/${props.id}.png`
  if (props.id < 9) return `/tiles/${props.id + 1}m.png`
  if (props.id < 18) return `/tiles/${props.id - 8}p.png`
  if (props.id < 27) return `/tiles/${props.id - 17}s.png`
  return `/tiles/${props.id - 26}z.png`
})
</script>

<template>
  <div class="tile-face image-face" :class="isLaizi ? ['laizi-image-face', `laizi-image-${id}`] : ''">
    <img :src="tileImage" alt="" draggable="false" />
  </div>
</template>
