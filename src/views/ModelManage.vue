<template>
  <div class="page">
    <h1>🤖 模型管理</h1>

    <!-- 统计 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-num">{{ models.length }}</div>
        <div class="stat-label">全部模型</div>
      </div>
      <div class="stat-card">
        <div class="stat-num text-green">{{ providers.length }}</div>
        <div class="stat-label">供应商</div>
      </div>
      <div class="stat-card">
        <div class="stat-num text-blue">{{ textModels }}</div>
        <div class="stat-label">文本模型</div>
      </div>
      <div class="stat-card">
        <div class="stat-num text-purple">{{ visionModels }}</div>
        <div class="stat-label">多模态模型</div>
      </div>
    </div>

    <!-- 搜索 -->
    <div class="search-bar">
      <input v-model="search" type="text" placeholder="搜索模型名称或供应商..." class="search-input" />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">加载中...</div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-msg">{{ error }}</div>

    <!-- 模型列表 -->
    <div v-else class="models-grid">
      <div v-for="model in filteredModels" :key="model.key" class="model-card">
        <div class="model-header">
          <span class="model-icon">{{ getModelIcon(model) }}</span>
          <div class="model-title">
            <div class="model-name">{{ model.name || model.id }}</div>
            <div class="model-id">{{ model.id }}</div>
          </div>
          <span class="status-badge" :class="getStatusClass(model)">{{ getStatusText(model) }}</span>
        </div>

        <div class="model-info">
          <div class="info-row">
            <span class="info-label">供应商</span>
            <span class="info-value">{{ formatProvider(model.provider) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">上下文窗口</span>
            <span class="info-value">{{ formatContext(model.contextWindow) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">输入类型</span>
            <span class="info-value">
              <span v-for="(t, i) in model.input" :key="t" class="tag" :class="'tag-'+t">{{ t }}</span>
            </span>
          </div>
          <div v-if="model.maxTokens" class="info-row">
            <span class="info-label">最大输出</span>
            <span class="info-value">{{ formatContext(model.maxTokens) }}</span>
          </div>
          <div v-if="model.reasoning" class="info-row">
            <span class="info-label">推理能力</span>
            <span class="info-value"><span class="tag tag-reasoning">✓ 支持</span></span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && filteredModels.length === 0" class="empty-state">
      <p>没有找到匹配的模型</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const models = ref([])
const loading = ref(true)
const error = ref('')
const search = ref('')

const providers = computed(() => [...new Set(models.value.map(m => m.provider))])
const textModels = computed(() => models.value.filter(m => m.input?.includes('text') && !m.input?.includes('image')).length)
const visionModels = computed(() => models.value.filter(m => m.input?.includes('image')).length)

const filteredModels = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return models.value
  return models.value.filter(m =>
    (m.name || '').toLowerCase().includes(q) ||
    (m.id || '').toLowerCase().includes(q) ||
    (m.provider || '').toLowerCase().includes(q)
  )
})

function getModelIcon(model) {
  if (model.input?.includes('image')) return '🖼️'
  if (model.reasoning) return '🧠'
  return '📝'
}

function getStatusClass(model) {
  return 'status-ok'
}

function getStatusText(model) {
  return '已配置'
}

function formatProvider(p) {
  if (!p) return '未知'
  const map = {
    'minimax': 'MiniMax',
    'custom-coding-dashscope-aliyuncs-com': '阿里云 DashScope',
  }
  return map[p] || p
}

function formatContext(n) {
  if (!n) return '未知'
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return n
}

onMounted(async () => {
  try {
    const res = await fetch('/api/models')
    const json = await res.json()
    if (json.success) {
      models.value = json.data || []
    } else {
      error.value = json.error || '加载失败'
    }
  } catch (e) {
    error.value = '网络错误: ' + e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page { max-width: 1200px; }
.page h1 { font-size: 24px; margin-bottom: 20px; color: #f8fafc; }

.stats-row { display: flex; gap: 16px; margin-bottom: 20px; }
.stat-card { background: #1A2234; border-radius: 10px; padding: 16px 20px; border: 1px solid #2a3444; min-width: 100px; }
.stat-num { font-size: 28px; font-weight: bold; color: #f8fafc; }
.stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
.text-green { color: #22c55e; }
.text-blue { color: #60a5fa; }
.text-purple { color: #a78bfa; }

.search-bar { margin-bottom: 20px; }
.search-input { width: 100%; padding: 10px 14px; background: #0f1520; border: 1px solid #2a3444; border-radius: 8px; color: #f8fafc; font-size: 14px; }
.search-input:focus { outline: none; border-color: #00D9C4; }

.loading, .error-msg, .empty-state { text-align: center; padding: 40px; color: #64748b; }
.error-msg { color: #ef4444; }

.models-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }

.model-card { background: #1A2234; border-radius: 10px; padding: 16px; border: 1px solid #2a3444; }
.model-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.model-icon { font-size: 28px; }
.model-title { flex: 1; }
.model-name { font-size: 15px; font-weight: bold; color: #f8fafc; }
.model-id { font-size: 11px; color: #64748b; font-family: monospace; margin-top: 2px; }
.status-badge { font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
.status-ok { background: rgba(34,197,94,0.2); color: #22c55e; }
.status-warn { background: rgba(234,179,8,0.2); color: #eab308; }

.model-info { display: flex; flex-direction: column; gap: 8px; }
.info-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.info-label { color: #64748b; width: 80px; flex-shrink: 0; }
.info-value { color: #e2e8f0; }

.tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; }
.tag-text { background: rgba(96,165,250,0.2); color: #60a5fa; }
.tag-image { background: rgba(167,139,250,0.2); color: #a78bfa; }
.tag-reasoning { background: rgba(0,217,196,0.2); color: #00D9C4; }
</style>
