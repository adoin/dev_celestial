<template>
  <div id="app" :class="{ dark: isDark }">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <h1>📚 程序员修仙传说</h1>
        <input
          v-model="searchQuery"
          @input="handleSearch"
          class="search-box"
          placeholder="搜索全文..."
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
          :key="result.chapter + result.index"
          class="search-result-item"
          @click="goToChapter(result.chapter)"
        >
          <span>第{{ result.chapter }}章</span>: 
          <span v-html="result.highlight"></span>
        </div>
      </div>
      
      <!-- 章节列表 -->
      <div class="chapter-list" v-show="!searchResults.length">
        <div
          v-for="chapter in sortedChapters"
          :key="chapter.num"
          class="chapter-item"
          :class="{ active: currentChapter === chapter.num }"
          @click="goToChapter(chapter.num)"
        >
          <span class="chapter-num">第{{ chapter.num }}章</span>
          {{ chapter.title }}
        </div>
      </div>
    </aside>
    
    <!-- 主阅读区 -->
    <main class="main-content">
      <div class="top-bar">
        <button class="icon-btn" @click="sidebarOpen = !sidebarOpen">
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
        <div v-if="loading" class="loading">加载中...</div>
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
        
        <span>第 {{ currentChapter || '-' }} / {{ chapters.length }} 章</span>
        
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

// 状态
const isDark = ref(localStorage.getItem('theme') === 'dark')
const sidebarOpen = ref(window.innerWidth > 768)
const currentChapter = ref(parseInt(localStorage.getItem('lastChapter')) || 1)
const currentContent = ref('')
const loading = ref(false)
const sortOrder = ref('asc')
const searchQuery = ref('')
const searchResults = ref([])
const chapters = ref([])
const allContents = ref({}) // 缓存所有章节内容用于搜索

// 章节配置（自动扫描）
const totalChapters = 20 // 已写章节数

// 初始化章节列表
onMounted(async () => {
  // 动态加载章节标题
  await loadChapterTitles()
  
  // 预加载所有章节用于搜索
  await preloadAllChapters()
  
  // 加载当前章节
  if (currentChapter.value) {
    await loadChapter(currentChapter.value)
  }
})

// 从 Markdown 内容提取标题
function extractTitle(content, num) {
  const match = content.match(/^#\s*(.+)$/m)
  return match ? match[1].trim() : `第${num}章`
}

// 动态加载章节标题
async function loadChapterTitles() {
  const loadedChapters = []
  for (let i = 1; i <= totalChapters; i++) {
    try {
      const response = await fetch(`程序员修仙传说/正文/第${String(i).padStart(4, '0')}章.md`)
      if (response.ok) {
        const text = await response.text()
        loadedChapters.push({
          num: i,
          title: extractTitle(text, i)
        })
      }
    } catch (e) {
      loadedChapters.push({ num: i, title: `第${i}章` })
    }
  }
  chapters.value = loadedChapters
}

// 预加载所有章节
async function preloadAllChapters() {
  for (let i = 1; i <= totalChapters; i++) {
    try {
      const response = await fetch(`程序员修仙传说/正文/第${String(i).padStart(4, '0')}章.md`)
      if (response.ok) {
        const text = await response.text()
        allContents.value[i] = text
      }
    } catch (e) {
      console.error(`预加载第${i}章失败`, e)
    }
  }
}

// 加载指定章节
async function loadChapter(num) {
  if (num < 1 || num > totalChapters) return
  
  loading.value = true
  currentChapter.value = num
  localStorage.setItem('lastChapter', num)
  
  try {
    // 优先从缓存读取
    if (allContents.value[num]) {
      currentContent.value = marked(allContents.value[num])
    } else {
      const response = await fetch(`程序员修仙传说/正文/第${String(num).padStart(4, '0')}章.md`)
      if (response.ok) {
        const text = await response.text()
        currentContent.value = marked(text)
        allContents.value[num] = text
      } else {
        currentContent.value = `<h1>第${num}章</h1><p>章节内容加载失败</p>`
      }
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
  if (window.innerWidth <= 768) {
    sidebarOpen.value = false
  }
}

// 切换主题
function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// 搜索功能
function handleSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }
  
  const results = []
  for (let i = 1; i <= totalChapters; i++) {
    const content = allContents.value[i]
    if (content) {
      const lines = content.split('\n')
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          const highlighted = line.replace(
            new RegExp(query, 'gi'),
            match => `<span class="highlight">${match}</span>`
          )
          results.push({
            chapter: i,
            index,
            text: line,
            highlight: highlighted
          })
        }
      })
    }
  }
  
  searchResults.value = results.slice(0, 20) // 最多显示20条
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