<template>
  <div id="app" :class="{ dark: isDark, 'sidebar-collapsed': !sidebarOpen }">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>📚 程序员修仙传说</h1>
        <input
          v-model="searchQuery"
          @input="handleSearch"
          class="search-box"
          placeholder="搜索章节..."
        />
      </div>
      
      <div class="toolbar">
        <button 
          :class="{ active: sortOrder === 'asc' }"
          @click="sortOrder = 'asc'"
        >
          正序
        </button>
        <button 
          :class="{ active: sortOrder === 'desc' }"
          @click="sortOrder = 'desc'"
        >
          倒序
        </button>
      </div>
      
      <!-- 搜索结果 -->
      <div v-if="searchResults.length" class="search-results">
        <div
          v-for="result in searchResults"
          :key="result.chapter"
          class="search-result-item"
          @click="goToChapter(result.chapter)"
        >
          <span>第{{ result.chapter }}章</span>: 
          <span v-html="result.highlight || result.title"></span>
        </div>
      </div>
      
      <!-- 章节列表 - 虚拟滚动 -->
      <div v-show="!searchResults.length" class="chapter-list-container">
        <div v-if="sortedChapters.length === 0" class="chapter-loading">
          加载章节列表...
        </div>
        <VirtualList
          v-else
          :items="sortedChapters"
          :item-height="44"
          :buffer="5"
          v-slot="{ item, index }"
        >
          <div
            class="chapter-item"
            :class="{ active: currentChapter === item.num }"
            @click="goToChapter(item.num)"
          >
            <span class="chapter-num">第{{ item.num }}章</span>
            <span class="chapter-title-text">{{ item.title || '加载中...' }}</span>
          </div>
        </VirtualList>
      </div>
    </aside>
    
    <!-- 遮罩层 - 移动端 -->
    <div 
      v-if="sidebarOpen && isMobile" 
      class="sidebar-overlay"
      @click="sidebarOpen = false"
    ></div>
    
    <!-- 主阅读区 -->
    <main class="main-content">
      <div class="top-bar">
        <button class="icon-btn menu-btn" @click="sidebarOpen = !sidebarOpen">
          ☰
        </button>
        <div class="chapter-title" v-if="currentChapterData">
          第{{ currentChapter }}章 {{ currentChapterData.title }}
        </div>
        <div class="top-actions">
          <button class="icon-btn" @click="toggleTheme" :title="isDark ? '切换日间' : '切换夜间'">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
        </div>
      </div>
      
      <div class="reader-container" ref="readerContainer">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <p>加载中...</p>
        </div>
        <div v-else-if="currentContent" class="reader-content" v-html="currentContent"></div>
        
        <div v-else class="empty-state">
          <p>选择章节开始阅读</p>
        </div>
      </div>
      
      <div class="nav-bar">
        <button 
          class="nav-btn" 
          :disabled="!hasPrev"
          @click="goToChapter(currentChapter - 1)"
        >
          ← 上一章
        </button>
        
        <span class="chapter-progress">第 {{ currentChapter || '-' }} / {{ totalChapters }} 章</span>
        
        <button 
          class="nav-btn" 
          :disabled="!hasNext"
          @click="goToChapter(currentChapter + 1)"
        >
          下一章 →
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { marked } from 'marked'
import VirtualList from './components/VirtualList.vue'

// 状态
const isDark = ref(localStorage.getItem('theme') === 'dark')
const sidebarOpen = ref(false)
const isMobile = ref(false)
const currentChapter = ref(parseInt(localStorage.getItem('lastChapter')) || 1)
const currentContent = ref('')
const loading = ref(false)
const sortOrder = ref('asc')
const searchQuery = ref('')
const searchResults = ref([])
const chapters = ref([])

// 章节配置
const totalChapters = 100 // 总章节数

// 检测移动端
function checkMobile() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) {
    sidebarOpen.value = true
  }
}

// 初始化
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // 只加载章节标题，不加载内容
  loadChapterTitles()
  
  // 加载当前章节
  if (currentChapter.value) {
    loadChapter(currentChapter.value)
  }
})

// 生成章节列表（不需要fetch）
function loadChapterTitles() {
  // 直接生成章节列表，标题从单独的配置文件或首次加载时获取
  chapters.value = Array.from({ length: totalChapters }, (_, i) => ({
    num: i + 1,
    title: '' // 首次加载时为空，点击时动态获取
  }))
  
  // 异步加载标题
  loadTitlesBatch()
}

// 分批加载标题，优先加载前面的章节
async function loadTitlesBatch() {
  const batchSize = 20
  for (let start = 1; start <= totalChapters; start += batchSize) {
    const end = Math.min(start + batchSize - 1, totalChapters)
    await loadTitlesRange(start, end)
  }
}

async function loadTitlesRange(start, end) {
  const promises = []
  for (let i = start; i <= end; i++) {
    promises.push(
      fetch(`程序员修仙传说/正文/第${String(i).padStart(4, '0')}章.md`)
        .then(r => r.ok ? r.text() : '')
        .then(text => {
          const match = text.match(/^#\s*(.+)$/m)
          const chapter = chapters.value.find(c => c.num === i)
          if (chapter && match) {
            chapter.title = match[1].trim().replace(/^第\d+章\s*/, '')
          }
        })
        .catch(() => {})
    )
  }
  await Promise.all(promises)
}

// 加载指定章节 - 按需加载
async function loadChapter(num) {
  if (num < 1 || num > totalChapters) return
  
  loading.value = true
  currentChapter.value = num
  localStorage.setItem('lastChapter', num)
  
  try {
    const response = await fetch(`程序员修仙传说/正文/第${String(num).padStart(4, '0')}章.md`)
    if (response.ok) {
      const text = await response.text()
      currentContent.value = marked(text)
      
      // 更新章节标题
      const match = text.match(/^#\s*(.+)$/m)
      const chapter = chapters.value.find(c => c.num === num)
      if (chapter && match) {
        chapter.title = match[1].trim().replace(/^第\d+章\s*/, '')
      }
    } else {
      currentContent.value = `<h1>第${num}章</h1><p>章节内容加载失败</p>`
    }
    
    // 滚动到顶部
    document.querySelector('.reader-container')?.scrollTo(0, 0)
  } catch (error) {
    console.error('加载章节失败:', error)
    currentContent.value = `<h1>第${num}章</h1><p>章节内容加载失败: ${error.message}</p>`
  } finally {
    loading.value = false
  }
}

// 跳转到指定章节
function goToChapter(num) {
  loadChapter(num)
  if (isMobile.value) {
    sidebarOpen.value = false
  }
}

// 切换主题
function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// 搜索功能 - 只搜索章节名
function handleSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }
  
  const results = []
  const lowerQuery = query.toLowerCase()
  
  // 在章节列表中搜索章节号或章节标题
  chapters.value.forEach(chapter => {
    const numMatch = chapter.num.toString().includes(query)
    const titleMatch = chapter.title && chapter.title.toLowerCase().includes(lowerQuery)
    
    if (numMatch || titleMatch) {
      results.push({
        chapter: chapter.num,
        title: chapter.title,
        highlight: titleMatch 
          ? chapter.title.replace(
              new RegExp(query, 'gi'),
              match => `<span class="highlight">${match}</span>`
            )
          : chapter.title
      })
    }
  })
  
  searchResults.value = results
}

// 计算属性
const sortedChapters = computed(() => {
  const list = [...chapters.value]
  return sortOrder.value === 'desc' ? list.reverse() : list
})

const currentChapterData = computed(() => 
  chapters.value.find(c => c.num === currentChapter.value)
)

const hasPrev = computed(() => currentChapter.value > 1)
const hasNext = computed(() => currentChapter.value < totalChapters)

// 监听主题变化
watch(isDark, (val) => {
  document.documentElement.classList.toggle('dark', val)
}, { immediate: true })
</script>

<style>
/* 基础布局 */
#app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* 侧边栏 */
.sidebar {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  overflow: hidden;
}

/* 主内容区 - 占满剩余空间 */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-color);
}

/* PC端侧边栏折叠 */
@media (min-width: 769px) {
  .sidebar-collapsed .sidebar {
    width: 0;
    min-width: 0;
    max-width: 0;
    border-right: none;
  }
}

/* 移动端 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    width: 280px;
    min-width: 280px;
    max-width: 280px;
  }
  
  #app:not(.sidebar-collapsed) .sidebar {
    transform: translateX(0);
  }
  
  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99;
  }
}

/* 章节列表容器 */
.chapter-list-container {
  flex: 1;
  overflow: hidden;
}
</style>
