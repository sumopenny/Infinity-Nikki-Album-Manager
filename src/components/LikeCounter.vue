<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Heart } from 'lucide-vue-next'

const props = defineProps<{
  messages: { like: string; likeTooltip: string }
}>()

const count = ref<number | null>(null)
const available = ref(true)
const justLiked = ref(false)
let likeQueue: Promise<void> = Promise.resolve()
let pendingLikes = 0

const formattedCount = computed(() => (count.value === null ? '…' : count.value.toLocaleString()))

/** 拉取当前点赞总数；接口不可用时（如纯静态环境）隐藏计数器。参数：无。 */
async function loadCount() {
  try {
    const response = await fetch('/api/like', { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as { count?: unknown }
    if (typeof data.count !== 'number') throw new Error('bad payload')
    count.value = data.count
  } catch {
    available.value = false
  }
}

/** 点赞请求串行发送，避免服务端响应乱序覆盖较新的计数。 */
async function like() {
  if (count.value === null) return
  const currentCount = count.value
  pendingLikes += 1
  count.value = currentCount + 1
  justLiked.value = true
  window.setTimeout(() => { justLiked.value = false }, 400)

  likeQueue = likeQueue.catch(() => undefined).then(async () => {
    const confirmedCount = count.value ?? currentCount
    try {
      const response = await fetch('/api/like', { method: 'POST', headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { count?: unknown }
      if (typeof data.count === 'number') count.value = data.count + pendingLikes - 1
      else count.value = Math.max(0, (count.value ?? confirmedCount) - 1)
    } catch {
      count.value = Math.max(0, (count.value ?? confirmedCount) - 1)
    } finally {
      pendingLikes -= 1
    }
  })
  await likeQueue
}

onMounted(loadCount)
</script>

<template>
  <button
    v-if="available"
    class="like-counter"
    :class="{ liked: justLiked }"
    type="button"
    :title="props.messages.likeTooltip"
    :aria-label="`${props.messages.like} ${formattedCount}`"
    @click="like"
  >
    <Heart :size="16" aria-hidden="true" />
    <span class="like-counter-number">{{ formattedCount }}</span>
  </button>
</template>
