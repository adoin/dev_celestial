<template>
  <div ref="container" class="virtual-list" @scroll="handleScroll">
    <div class="virtual-list-phantom" :style="{ height: totalHeight + 'px' }"></div>
    <div class="virtual-list-content" :style="{ transform: `translateY(${offset}px)` }">
      <div
        v-for="item in visibleItems"
        :key="item.index"
        class="virtual-list-item"
        :style="{ height: itemHeight + 'px' }"
      >
        <slot :item="item.data" :index="item.index"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  itemHeight: {
    type: Number,
    default: 44
  },
  buffer: {
    type: Number,
    default: 5
  }
})

const container = ref(null)
const scrollTop = ref(0)
const containerHeight = ref(0)

// 总高度
const totalHeight = computed(() => props.items.length * props.itemHeight)

// 可见区域的起始索引
const startIndex = computed(() => {
  let index = Math.floor(scrollTop.value / props.itemHeight)
  index = Math.max(0, index - props.buffer)
  return index
})

// 可见区域的结束索引
const endIndex = computed(() => {
  let index = Math.ceil((scrollTop.value + containerHeight.value) / props.itemHeight)
  index = Math.min(props.items.length, index + props.buffer)
  return index
})

// 可见项
const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value).map((data, i) => ({
    data,
    index: startIndex.value + i
  }))
})

// 偏移量
const offset = computed(() => startIndex.value * props.itemHeight)

// 处理滚动
function handleScroll(e) {
  scrollTop.value = e.target.scrollTop
}

// 更新容器高度
function updateContainerHeight() {
  if (container.value) {
    containerHeight.value = container.value.clientHeight
  }
}

onMounted(() => {
  updateContainerHeight()
  window.addEventListener('resize', updateContainerHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerHeight)
})
</script>

<style scoped>
.virtual-list {
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.virtual-list-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
}

.virtual-list-content {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
}

.virtual-list-item {
  box-sizing: border-box;
}
</style>
