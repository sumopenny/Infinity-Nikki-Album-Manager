<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ sourceKey: string; load: () => Promise<Blob>; alt: string }>()
const root = ref<HTMLElement | null>(null)
const url = ref('')
const failed = ref(false)
let observer: IntersectionObserver | null = null
let visible = false
let generation = 0
let frame = 0
let fallbackTimer: ReturnType<typeof setTimeout> | undefined

/** 不依赖观察器首次通知：挂载、页面返回和滚动后核对实际占位，仍只加载附近封面。 */
function checkVisibility() {
  frame = 0
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const next =
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= -240 &&
    rect.top <= window.innerHeight + 240 &&
    rect.right >= 0 &&
    rect.left <= window.innerWidth
  setVisible(next)
}

function scheduleCheck() {
  if (!frame) frame = requestAnimationFrame(checkVisibility)
}

function setVisible(next: boolean) {
  if (next === visible) return
  visible = next
  if (visible) void load()
  else release()
}

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
    if (run === generation && visible) {
      failed.value = true
    }
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
  window.addEventListener('scroll', scheduleCheck, true)
  window.addEventListener('resize', scheduleCheck)
  window.addEventListener('focus', scheduleCheck)
  scheduleCheck()
  fallbackTimer = setTimeout(() => {
    checkVisibility()
  }, 1000)
  if (typeof window.IntersectionObserver !== 'function') {
    setVisible(true)
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      const next = entries.some((entry) => entry.isIntersecting)
      setVisible(next)
    },
    { rootMargin: '240px 0px' }
  )
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(fallbackTimer)
  window.removeEventListener('scroll', scheduleCheck, true)
  window.removeEventListener('resize', scheduleCheck)
  window.removeEventListener('focus', scheduleCheck)
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
  /* 图片直接铺满封面框，避免固有尺寸参与 Grid 轨道计算后被居中偏移、裁切。 */
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: cover;
  object-position: center;
}
</style>
