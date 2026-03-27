<template>
  <div id="app" :class="{ dark: isDark, 'sidebar-collapsed': !sidebarOpen }">
    <!-- 全文搜索弹窗 -->
    <div v-if="showFullTextSearch" class="modal-overlay" @click="showFullTextSearch = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>全文搜索</h3>
          <button class="close-btn" @click="showFullTextSearch = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="fulltext-search-box">
            <input
              v-model="fullTextQuery"
              @keyup.enter="doFullTextSearch"
              class="search-input"
              placeholder="输入关键词搜索全文..."
            />
            <button @click="doFullTextSearch" :disabled="fullTextSearching">
              {{ fullTextSearching ? '搜索中...' : '搜索' }}
            </button>
          </div>
          <div v-if="fullTextResults.length" class="fulltext-results">
            <div class="results-count">找到 {{ fullTextResults.length }} 条结果</div>
            <div
              v-for="result in fullTextResults"
              :key="result.chapter + '-' + result.index"
              class="fulltext-result-item"
              @click="goToChapter(result.chapter)"
            >
              <div class="result-chapter">第{{ result.chapter }}章 {{ result.title }}</div>
              <div class="result-text" v-html="result.highlight"></div>
            </div>
          </div>
          <div v-else-if="fullTextSearched" class="no-results">未找到匹配结果</div>
        </div>
      </div>
    </div>

    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>📚 程序员修仙传说</h1>
        <input
          v-model="chapterFilter"
          class="search-box"
          placeholder="过滤章节..."
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
        <button @click="showFullTextSearch = true">🔍 全文搜索</button>
      </div>
      
      <!-- 章节列表 - 虚拟滚动 -->
      <div class="chapter-list-container">
        <div v-if="filteredChapters.length === 0" class="chapter-loading">
          {{ chapters.length === 0 ? '加载章节列表...' : '无匹配章节' }}
        </div>
        <VirtualList
          v-else
          :items="filteredChapters"
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
const chapterFilter = ref('')  // 章节过滤
const chapters = ref([])

// 全文搜索状态
const showFullTextSearch = ref(false)
const fullTextQuery = ref('')
const fullTextResults = ref([])
const fullTextSearching = ref(false)
const fullTextSearched = ref(false)

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
  showFullTextSearch.value = false  // 关闭全文搜索弹窗
  if (isMobile.value) {
    sidebarOpen.value = false
  }
}

// 切换主题
function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// 全文搜索功能
async function doFullTextSearch() {
  const query = fullTextQuery.value.trim()
  if (!query) return
  
  fullTextSearching.value = true
  fullTextSearched.value = false
  fullTextResults.value = []
  
  const results = []
  const lowerQuery = query.toLowerCase()
  
  // 搜索所有章节
  for (let i = 1; i <= totalChapters; i++) {
    try {
      const response = await fetch(`程序员修仙传说/正文/第${String(i).padStart(4, '0')}章.md`)
      if (response.ok) {
        const text = await response.text()
        const lines = text.split('\n')
        const chapterTitle = chapters.value.find(c => c.num === i)?.title || ''
        
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(lowerQuery)) {
            const highlighted = line.replace(
              new RegExp(query, 'gi'),
              match => `<span class="highlight">${match}</span>`
            )
            results.push({
              chapter: i,
              title: chapterTitle,
              index,
              highlight: highlighted
            })
          }
        })
      }
    } catch (e) {}
  }
  
  fullTextResults.value = results
  fullTextSearching.value = false
  fullTextSearched.value = true
}

// 计算属性 - 过滤并排序章节列表
const filteredChapters = computed(() => {
  const query = chapterFilter.value.trim().toLowerCase()
  let list = chapters.value
  
  // 如果有过滤条件，按章节号或标题过滤
  if (query) {
    list = chapters.value.filter(chapter => {
      const numMatch = chapter.num.toString().includes(query)
      const titleMatch = chapter.title && chapter.title.toLowerCase().includes(query)
      return numMatch || titleMatch
    })
  }
  
  return sortOrder.value === 'desc' ? [...list].reverse() : list
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

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: var(--bg-color);
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--text-color);
}

.close-btn:hover {
  background: var(--border-color);
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

/* 全文搜索 */
.fulltext-search-box {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.fulltext-search-box .search-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--sidebar-bg);
  color: var(--text-color);
  font-size: 15px;
}

.fulltext-search-box button {
  padding: 12px 24px;
  background: var(--accent-color, #4a90d9);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
}

.fulltext-search-box button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.results-count {
  color: var(--text-secondary);
  margin-bottom: 16px;
  font-size: 14px;
}

.fulltext-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fulltext-result-item {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.fulltext-result-item:hover {
  background: var(--sidebar-bg);
}

.result-chapter {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--accent-color, #4a90d9);
}

.result-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.result-text .highlight {
  background: rgba(255, 200, 0, 0.3);
  padding: 2px 4px;
  border-radius: 3px;
}

.no-results {
  text-align: center;
  color: var(--text-secondary);
  padding: 40px;
}

/* 章节列表容器 */
.chapter-list-container {
  flex: 1;
  overflow: hidden;
}
</style>
