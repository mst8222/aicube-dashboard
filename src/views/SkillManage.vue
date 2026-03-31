<template>
  <div class="skill-manage-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1>🛠️ Skill 管理</h1>
        <p class="header-sub">共 {{ totalCount }} 个 Skills，已对接 OpenClaw 实时数据</p>
      </div>
      <button class="btn-refresh" @click="fetchSkills">
        <span :class="{ spinning: loading }">🔄</span> 刷新
      </button>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-pill" :class="{ active: filter === 'all' }" @click="filter = 'all'">
        <span class="pill-label">全部</span>
        <span class="pill-num">{{ totalCount }}</span>
      </div>
      <div class="stat-pill available" :class="{ active: filter === 'available' }" @click="filter = 'available'">
        <span class="pill-dot"></span>
        <span class="pill-label">可用</span>
        <span class="pill-num">{{ availableCount }}</span>
      </div>
      <div class="stat-pill missing" :class="{ active: filter === 'missing' }" @click="filter = 'missing'">
        <span class="pill-dot"></span>
        <span class="pill-label">缺失条件</span>
        <span class="pill-num">{{ missingCount }}</span>
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
        placeholder="搜索 Skill 名称或描述..."
        class="search-input"
      />
      <span v-if="searchQuery" class="search-clear" @click="searchQuery = ''">×</span>
    </div>

    <!-- Meta Info -->
    <div class="meta-bar" v-if="meta">
      <span class="meta-item">📁 {{ meta.workspaceDir }}</span>
      <span class="meta-sep">|</span>
      <span class="meta-item">⚙️ {{ meta.managedSkillsDir }}</span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="state-box loading-state">
      <span class="state-icon">⏳</span>
      <p>正在加载 Skills...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMsg" class="state-box error-state">
      <span class="state-icon">⚠️</span>
      <p>{{ errorMsg }}</p>
      <button class="btn-retry" @click="fetchSkills">重试</button>
    </div>

    <!-- Skills Grid -->
    <div v-else class="skills-grid">
      <div
        v-for="skill in paginatedSkills"
        :key="skill.name"
        class="skill-card"
        :class="getSkillStatus(skill)"
      >
        <div class="card-header">
          <span class="skill-emoji">{{ skill.emoji || '📦' }}</span>
          <div class="skill-title-group">
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-source">{{ formatSource(skill.source) }}</span>
          </div>
          <span class="skill-badge" :class="getSkillStatus(skill)">
            {{ getStatusLabel(skill) }}
          </span>
        </div>

        <p class="skill-desc">{{ skill.description || '暂无描述' }}</p>

        <!-- Missing Reasons -->
        <div v-if="!skill.eligible && getMissingReasons(skill).length" class="missing-reasons">
          <span
            v-for="reason in getMissingReasons(skill)"
            :key="reason"
            class="missing-tag"
          >{{ reason }}</span>
        </div>

        <!-- Bundled badge -->
        <div class="card-footer">
          <span v-if="skill.bundled" class="bundled-badge">内置</span>
          <span v-if="skill.blockedByAllowlist" class="allowlist-badge">白名单限制</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && !errorMsg && filteredSkills.length === 0" class="state-box empty-state">
      <span class="state-icon">🔍</span>
      <p>没有找到匹配的 Skills</p>
      <button v-if="searchQuery || filter !== 'all'" class="btn-retry" @click="clearFilters">清除筛选</button>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && !errorMsg && totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">
        ‹ 上一页
      </button>
      <div class="page-info">
        第 <span class="page-current">{{ currentPage }}</span> / {{ totalPages }} 页
        <span class="page-total">（共 {{ filteredSkills.length }} 个）</span>
      </div>
      <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">
        下一页 ›
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const skills = ref([])
const loading = ref(true)
const errorMsg = ref('')
const searchQuery = ref('')
const filter = ref('all')
const currentPage = ref(1)
const meta = ref(null)
const PAGE_SIZE = 24

const totalCount = computed(() => skills.value.length)
const availableCount = computed(() => skills.value.filter(s => s.eligible && !s.disabled).length)
const missingCount = computed(() => skills.value.filter(s => !s.eligible && !s.disabled).length)
const disabledCount = computed(() => skills.value.filter(s => s.disabled).length)

const filteredSkills = computed(() => {
  let list = skills.value

  // Status filter
  if (filter.value === 'available') {
    list = list.filter(s => s.eligible && !s.disabled)
  } else if (filter.value === 'missing') {
    list = list.filter(s => !s.eligible && !s.disabled)
  } else if (filter.value === 'disabled') {
    list = list.filter(s => s.disabled)
  }

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    )
  }

  return list
})

const totalPages = computed(() => Math.ceil(filteredSkills.value.length / PAGE_SIZE))

const paginatedSkills = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredSkills.value.slice(start, start + PAGE_SIZE)
})

// Reset page when filter or search changes
watch([filter, searchQuery], () => {
  currentPage.value = 1
})

async function fetchSkills() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/skills')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.success) {
      skills.value = json.data || []
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

function getSkillStatus(skill) {
  if (skill.disabled) return 'disabled'
  if (!skill.eligible) return 'missing'
  return 'available'
}

function getStatusLabel(skill) {
  if (skill.disabled) return '已禁用'
  if (!skill.eligible) return '缺失条件'
  return '可用'
}

function formatSource(source) {
  const map = {
    'openclaw-bundled': '内置',
    'openclaw-extra': '扩展',
    'openclaw-workspace': '工作区',
    'clawhub': 'ClawHub',
  }
  return map[source] || source || '未知'
}

function getMissingReasons(skill) {
  const reasons = []
  const m = skill.missing || {}
  if (m.bins && m.bins.length) reasons.push(`缺 CLI: ${m.bins.join(', ')}`)
  if (m.anyBins && m.anyBins.length) reasons.push(`缺任一 CLI: ${m.anyBins.join(', ')}`)
  if (m.env && m.env.length) reasons.push(`缺环境变量: ${m.env.join(', ')}`)
  if (m.config && m.config.length) reasons.push(`缺配置: ${m.config.join(', ')}`)
  if (m.os && m.os.length) reasons.push(`仅支持: ${m.os.join(', ')}`)
  return reasons
}

function clearFilters() {
  searchQuery.value = ''
  filter.value = 'all'
}

onMounted(() => {
  fetchSkills()
})
</script>

<style scoped>
.skill-manage-page {
  max-width: 1300px;
  padding: 0 0 40px;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.header-left h1 {
  font-size: 24px;
  color: #f8fafc;
  margin-bottom: 4px;
}
.header-sub {
  font-size: 13px;
  color: #64748b;
}
.btn-refresh {
  background: #1A2234;
  color: #e2e8f0;
  border: 1px solid #2a3444;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}
.btn-refresh:hover { background: #2a3444; }
.btn-refresh .spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.stat-pill {
  background: #1A2234;
  border: 1px solid #2a3444;
  border-radius: 20px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}
.stat-pill:hover { background: #2a3444; }
.stat-pill.active { border-color: #00D9C4; background: rgba(0, 217, 196, 0.1); }
.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: none;
}
.stat-pill.available .pill-dot { background: #22c55e; display: inline-block; }
.stat-pill.missing .pill-dot { background: #ef4444; display: inline-block; }
.stat-pill.disabled .pill-dot { background: #eab308; display: inline-block; }
.pill-label { color: #94a3b8; }
.pill-num { color: #f8fafc; font-weight: bold; }
.stat-pill.active .pill-label { color: #e2e8f0; }

/* Search Bar */
.search-bar {
  background: #1A2234;
  border: 1px solid #2a3444;
  border-radius: 8px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  transition: border-color 0.2s;
}
.search-bar:focus-within { border-color: #00D9C4; }
.search-icon { color: #64748b; font-size: 16px; }
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-size: 14px;
  padding: 12px 0;
}
.search-input::placeholder { color: #64748b; }
.search-clear {
  color: #64748b;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.search-clear:hover { color: #e2e8f0; }

/* Meta Bar */
.meta-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 11px;
  color: #475569;
  font-family: monospace;
  flex-wrap: wrap;
}
.meta-sep { color: #334155; }

/* State Boxes */
.state-box {
  text-align: center;
  padding: 60px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}
.loading-state {
  background: rgba(0, 217, 196, 0.05);
  border: 1px dashed #2a3444;
  color: #64748b;
}
.error-state {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
}
.empty-state {
  background: rgba(100, 116, 139, 0.08);
  border: 1px dashed #2a3444;
  color: #64748b;
}
.state-icon { font-size: 40px; display: block; margin-bottom: 16px; }
.btn-retry {
  margin-top: 12px;
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.loading-state .btn-retry { background: #64748b; }

/* Skills Grid */
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.skill-card {
  background: #0f1520;
  border: 1px solid #2a3444;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.skill-card:hover {
  border-color: #3a4a5a;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
.skill-card.available { border-left: 3px solid #22c55e; }
.skill-card.missing { border-left: 3px solid #ef4444; }
.skill-card.disabled { border-left: 3px solid #eab308; opacity: 0.7; }

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.skill-emoji { font-size: 24px; flex-shrink: 0; }
.skill-title-group {
  flex: 1;
  min-width: 0;
}
.skill-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.skill-source {
  font-size: 11px;
  color: #475569;
}
.skill-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}
.skill-badge.available { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.skill-badge.missing { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.skill-badge.disabled { background: rgba(234, 179, 8, 0.15); color: #eab308; }

.skill-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.missing-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.missing-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.card-footer {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.bundled-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(0, 217, 196, 0.1);
  color: #00D9C4;
}
.allowlist-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(234, 179, 8, 0.1);
  color: #eab308;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 20px 0;
}
.page-btn {
  background: #1A2234;
  color: #e2e8f0;
  border: 1px solid #2a3444;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}
.page-btn:hover:not(:disabled) { background: #2a3444; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info {
  font-size: 13px;
  color: #64748b;
}
.page-current { color: #00D9C4; font-weight: bold; }
.page-total { color: #475569; }

/* Responsive */
@media (max-width: 768px) {
  .skills-grid { grid-template-columns: 1fr; }
  .stats-bar { gap: 8px; }
  .stat-pill { padding: 6px 12px; font-size: 12px; }
  .page-header { flex-direction: column; gap: 12px; }
}
@media (max-width: 480px) {
  .skill-manage-page { padding: 0 0 30px; }
  .skills-grid { gap: 12px; }
}
</style>
