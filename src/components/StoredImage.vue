<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ sourceKey: string; load: () => Promise<Blob>; alt: string }>()
const root = ref<HTMLElement | null>(null)
const url = ref('')
const failed = ref(false)
let observer: IntersectionObserver | null = null
let visible = false
let generation = 0

/** 离开预加载区域或数据变化时释放地址，并使尚未完成的读取失效。 */
function release() {
  generation++
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  failed.value = false
}

/** 只为可见记录取图，晚到结果不创建地址，不影响替换后的记录。 */
async function load() {
  const run = ++generation
  try {
    const blob = await props.load()
    if (run !== generation || !visible) return
    url.value = URL.createObjectURL(blob)
  } catch {
    if (run === generation && visible) failed.value = true
  }
}

watch(
  () => props.sourceKey,
  () => {
    release()
    if (visible) void load()
  }
)
onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    visible = true
    void load()
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      const next = entries.some((entry) => entry.isIntersecting)
      if (next === visible) return
      visible = next
      if (visible) void load()
      else release()
    },
    { rootMargin: '240px 0px' }
  )
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => {
  visible = false
  observer?.disconnect()
  release()
})
</script>

<template>
  <div ref="root" class="stored-image">
    <img v-if="url && !failed" :src="url" :alt="alt" @error="failed = true" />
    <span v-else-if="failed" role="img" :aria-label="alt">×</span>
  </div>
</template>

<style scoped>
.stored-image {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: inherit;
  background: var(--surface-soft);
  color: var(--muted);
}
.stored-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
