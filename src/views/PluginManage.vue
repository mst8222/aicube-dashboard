<template>
  <div class="plugin-manage-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1>📦 插件管理</h1>
        <p class="header-sub">共 {{ totalCount }} 个插件，已加载 {{ loadedCount }} 个</p>
      </div>
      <button class="btn-refresh" @click="fetchPlugins">
        <span :class="{ spinning: loading }">🔄</span> 刷新
      </button>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-pill" :class="{ active: filter === 'all' }" @click="filter = 'all'">
        <span class="pill-label">全部</span>
        <span class="pill-num">{{ totalCount }}</span>
      </div>
      <div class="stat-pill loaded" :class="{ active: filter === 'loaded' }" @click="filter = 'loaded'">
        <span class="pill-dot"></span>
        <span class="pill-label">已加载</span>
        <span class="pill-num">{{ loadedCount }}</span>
      </div>
      <div class="stat-pill disabled" :class="{ active: filter === 'disabled' }" @click="filter = 'disabled'">
        <span class="pill-dot"></span>
        <span class="pill-label">已禁用</span>
        <span class="pill-num">{{ disabledCount }}</span>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索插件名称或描述..."
        class="search-input"
      />
      <span v-if="searchQuery" class="search-clear" @click="searchQuery = ''">×</span>
    </div>

    <!-- Meta Bar -->
    <div class="meta-bar" v-if="meta">
      <span class="meta-item">📁 {{ meta.workspaceDir }}</span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="state-box loading-state">
      <span class="state-icon">⏳</span>
      <p>正在加载插件...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMsg" class="state-box error-state">
      <span class="state-icon">⚠️</span>
      <p>{{ errorMsg }}</p>
      <button class="btn-retry" @click="fetchPlugins">重试</button>
    </div>

    <!-- Plugins Grid -->
    <div v-else class="plugins-grid">
      <div
        v-for="plugin in paginatedPlugins"
        :key="plugin.id"
        class="plugin-card"
        :class="plugin.status"
      >
        <!-- Card Header -->
        <div class="card-header" @click="toggleExpand(plugin.id)">
          <div class="plugin-icon">{{ getPluginEmoji(plugin) }}</div>
          <div class="plugin-title-group">
            <span class="plugin-name">{{ plugin.name }}</span>
            <span class="plugin-version" v-if="plugin.version">v{{ plugin.version }}</span>
            <span class="plugin-version bundled" v-else-if="plugin.origin === 'bundled'">bundled</span>
          </div>
          <div class="card-header-right">
            <span class="plugin-badge" :class="plugin.status">
              {{ plugin.status === 'loaded' ? '已加载' : '已禁用' }}
            </span>
            <span class="expand-icon" :class="{ rotated: expandedIds.has(plugin.id) }">▶</span>
          </div>
        </div>

        <!-- Description -->
        <p class="plugin-desc">{{ plugin.description || '暂无描述' }}</p>

        <!-- Error notice for disabled -->
        <div v-if="plugin.error" class="error-notice">
          <span>⚠️</span> {{ plugin.error }}
        </div>

        <!-- Footer: origin + channels -->
        <div class="card-footer">
          <span class="origin-badge" :class="plugin.origin">{{ formatOrigin(plugin.origin) }}</span>
          <span v-if="plugin.channelIds && plugin.channelIds.length" class="channel-tag">
            📢 {{ plugin.channelIds.join(', ') }}
          </span>
          <span v-if="plugin.commands && plugin.commands.length" class="cmd-tag">
            Terminal: {{ plugin.commands.join(', ') }}
          </span>
          <span v-if="plugin.services && plugin.services.length" class="svc-tag">
            ⚙️ {{ plugin.services.join(', ') }}
          </span>
        </div>

        <!-- Expanded: tool names -->
        <div v-if="expandedIds.has(plugin.id)" class="expand-panel">
          <div class="expand-title">提供的工具 ({{ getUniqueTools(plugin).length }}个)</div>
          <div class="tool-list" v-if="getUniqueTools(plugin).length">
            <span
              v-for="tool in getUniqueTools(plugin)"
              :key="tool"
              class="tool-tag"
            >{{ tool }}</span>
          </div>
          <div v-else class="no-tools">无</div>

          <div class="expand-title" v-if="plugin.hookNames && plugin.hookNames.length">Hooks ({{ plugin.hookNames.length }}个)</div>
          <div class="tool-list" v-if="plugin.hookNames && plugin.hookNames.length">
            <span
              v-for="hook in plugin.hookNames"
              :key="hook"
              class="tool-tag hook"
            >{{ hook }}</span>
          </div>

          <div class="source-path" v-if="plugin.source">来源: {{ plugin.source }}</div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && !errorMsg && filteredPlugins.length === 0" class="state-box empty-state">
      <span class="state-icon">🔍</span>
      <p>没有找到匹配的插件</p>
      <button v-if="searchQuery || filter !== 'all'" class="btn-retry" @click="clearFilters">清除筛选</button>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && !errorMsg && totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">‹ 上一页</button>
      <div class="page-info">
        第 <span class="page-current">{{ currentPage }}</span> / {{ totalPages }} 页
        <span class="page-total">（共 {{ filteredPlugins.length }} 个）</span>
      </div>
      <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页 ›</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const plugins = ref([])
const loading = ref(true)
const errorMsg = ref('')
const searchQuery = ref('')
const filter = ref('all')
const currentPage = ref(1)
const expandedIds = ref(new Set())
const meta = ref(null)
const PAGE_SIZE = 24

const totalCount = computed(() => plugins.value.length)
const loadedCount = computed(() => plugins.value.filter(p => p.status === 'loaded').length)
const disabledCount = computed(() => plugins.value.filter(p => p.status === 'disabled').length)

const filteredPlugins = computed(() => {
  let list = plugins.value
  if (filter.value === 'loaded') {
    list = list.filter(p => p.status === 'loaded')
  } else if (filter.value === 'disabled') {
    list = list.filter(p => p.status === 'disabled')
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    )
  }
  return list
})

const totalPages = computed(() => Math.ceil(filteredPlugins.value.length / PAGE_SIZE))
const paginatedPlugins = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredPlugins.value.slice(start, start + PAGE_SIZE)
})

watch([filter, searchQuery], () => { currentPage.value = 1 })

async function fetchPlugins() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/plugins')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.success) {
      plugins.value = json.data || []
      meta.value = json.meta || null
    } else {
      throw new Error(json.error || '未知错误')
    }
  } catch (e) {
    errorMsg.value = '加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

function toggleExpand(id) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

function getUniqueTools(plugin) {
  if (!plugin.toolNames) return []
  return [...new Set(plugin.toolNames)]
}

function getPluginEmoji(plugin) {
  if (plugin.channelIds && plugin.channelIds.length) return '📢'
  if (plugin.kind === 'memory') return '🧠'
  if (plugin.commands && plugin.commands.length) return '⌨️'
  if (plugin.services && plugin.services.length) return '⚙️'
  return '📦'
}

function formatOrigin(origin) {
  const map = {
    'bundled': '内置',
    'config': '配置',
    'workspace': '工作区',
    'extension': '扩展',
  }
  return map[origin] || origin || '未知'
}

function clearFilters() {
  searchQuery.value = ''
  filter.value = 'all'
}

onMounted(() => { fetchPlugins() })
</script>

<style scoped>
.plugin-manage-page { max-width: 1300px; padding: 0 0 40px; }

/* Header */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.header-left h1 { font-size: 24px; color: #f8fafc; margin-bottom: 4px; }
.header-sub { font-size: 13px; color: #64748b; }
.btn-refresh { background: #1A2234; color: #e2e8f0; border: 1px solid #2a3444; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; transition: background 0.2s; }
.btn-refresh:hover { background: #2a3444; }
.btn-refresh .spinning { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Stats Bar */
.stats-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.stat-pill { background: #1A2234; border: 1px solid #2a3444; border-radius: 20px; padding: 8px 16px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; font-size: 13px; }
.stat-pill:hover { background: #2a3444; }
.stat-pill.active { border-color: #00D9C4; background: rgba(0, 217, 196, 0.1); }
.pill-dot { width: 8px; height: 8px; border-radius: 50%; display: none; }
.stat-pill.loaded .pill-dot { background: #22c55e; display: inline-block; }
.stat-pill.disabled .pill-dot { background: #64748b; display: inline-block; }
.pill-label { color: #94a3b8; }
.pill-num { color: #f8fafc; font-weight: bold; }
.stat-pill.active .pill-label { color: #e2e8f0; }

/* Search Bar */
.search-bar { background: #1A2234; border: 1px solid #2a3444; border-radius: 8px; padding: 0 16px; display: flex; align-items: center; gap: 10px; margin-bottom: 16px; transition: border-color 0.2s; }
.search-bar:focus-within { border-color: #00D9C4; }
.search-icon { color: #64748b; font-size: 16px; }
.search-input { flex: 1; background: transparent; border: none; outline: none; color: #f8fafc; font-size: 14px; padding: 12px 0; }
.search-input::placeholder { color: #64748b; }
.search-clear { color: #64748b; cursor: pointer; font-size: 18px; line-height: 1; }
.search-clear:hover { color: #e2e8f0; }

/* Meta Bar */
.meta-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; font-size: 11px; color: #475569; font-family: monospace; flex-wrap: wrap; }

/* State Boxes */
.state-box { text-align: center; padding: 60px 20px; border-radius: 12px; margin-bottom: 20px; }
.loading-state { background: rgba(0, 217, 196, 0.05); border: 1px dashed #2a3444; color: #64748b; }
.error-state { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; }
.empty-state { background: rgba(100, 116, 139, 0.08); border: 1px dashed #2a3444; color: #64748b; }
.state-icon { font-size: 40px; display: block; margin-bottom: 16px; }
.btn-retry { margin-top: 12px; background: #ef4444; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.loading-state .btn-retry { background: #64748b; }

/* Plugins Grid */
.plugins-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; margin-bottom: 24px; }

.plugin-card { background: #0f1520; border: 1px solid #2a3444; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.2s, box-shadow 0.2s; }
.plugin-card:hover { border-color: #3a4a5a; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); }
.plugin-card.loaded { border-left: 3px solid #22c55e; }
.plugin-card.disabled { border-left: 3px solid #64748b; opacity: 0.8; }

/* Card Header */
.card-header { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.plugin-icon { font-size: 22px; flex-shrink: 0; }
.plugin-title-group { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.plugin-name { font-size: 14px; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.plugin-version { font-size: 11px; color: #475569; }
.plugin-version.bundled { color: #00D9C4; }
.card-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.plugin-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
.plugin-badge.loaded { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.plugin-badge.disabled { background: rgba(100, 116, 139, 0.15); color: #64748b; }
.expand-icon { font-size: 10px; color: #475569; transition: transform 0.2s; display: inline-block; }
.expand-icon.rotated { transform: rotate(90deg); }

/* Description */
.plugin-desc { font-size: 12px; color: #64748b; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }

/* Error Notice */
.error-notice { font-size: 11px; padding: 6px 10px; border-radius: 6px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); color: #f87171; display: flex; align-items: center; gap: 6px; }

/* Footer */
.card-footer { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.origin-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; background: rgba(0, 217, 196, 0.1); color: #00D9C4; }
.origin-badge.bundled { background: rgba(139, 92, 246, 0.1); color: #a78bfa; }
.origin-badge.config { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.origin-badge.workspace { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }
.channel-tag, .cmd-tag, .svc-tag { font-size: 10px; padding: 1px 6px; border-radius: 3px; background: rgba(100, 116, 139, 0.15); color: #94a3b8; }

/* Expand Panel */
.expand-panel { border-top: 1px solid #2a3444; padding-top: 12px; margin-top: 4px; display: flex; flex-direction: column; gap: 8px; }
.expand-title { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.tool-list { display: flex; flex-wrap: wrap; gap: 5px; }
.tool-tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(0, 217, 196, 0.08); color: #00D9C4; border: 1px solid rgba(0, 217, 196, 0.15); font-family: monospace; }
.tool-tag.hook { background: rgba(139, 92, 246, 0.08); color: #a78bfa; border-color: rgba(139, 92, 246, 0.15); }
.no-tools { font-size: 12px; color: #475569; }
.source-path { font-size: 10px; color: #334155; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: center; gap: 20px; padding: 20px 0; }
.page-btn { background: #1A2234; color: #e2e8f0; border: 1px solid #2a3444; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background 0.2s; }
.page-btn:hover:not(:disabled) { background: #2a3444; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: #64748b; }
.page-current { color: #00D9C4; font-weight: bold; }
.page-total { color: #475569; }

/* Responsive */
@media (max-width: 768px) {
  .plugins-grid { grid-template-columns: 1fr; }
  .stats-bar { gap: 8px; }
  .stat-pill { padding: 6px 12px; font-size: 12px; }
  .page-header { flex-direction: column; gap: 12px; }
}
</style>
