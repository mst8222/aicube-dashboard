const express = require('express');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// 配置：支持 config.json 和环境变量
// ============================================================
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  // 默认配置不包含任何密码——首次部署时从 config.example.json 复制并自行设置
  const defaultConfig = {
    server: { port: 3000, frontendPort: 5173, host: '0.0.0.0' },
    openclaw: { home: '~/.openclaw', cli: 'node', path: '' },
    cors: { origins: ['localhost', '127.0.0.1'] },
    data: { dir: './server/data' },
    auth: { users: {} }
  };
  
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const userConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      // 深度合并
      return {
        server: { ...defaultConfig.server, ...userConfig.server },
        openclaw: { ...defaultConfig.openclaw, ...userConfig.openclaw },
        cors: { ...defaultConfig.cors, ...userConfig.cors },
        data: { ...defaultConfig.data, ...userConfig.data },
        auth: { users: { ...defaultConfig.auth.users, ...(userConfig.auth?.users || {}) } }
      };
    }
  } catch (e) {
    console.warn('⚠️ 配置文件读取失败，使用默认配置:', e.message);
  }
  return defaultConfig;
}

const config = loadConfig();

// 环境变量覆盖配置
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || config.openclaw.home.replace(/^~/, os.homedir());
const OPENCLAW_CLI = process.env.OPENCLAW_CLI || config.openclaw.cli;
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', config.data.dir);
const API_PORT = parseInt(process.env.API_PORT || config.server.port, 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || config.cors.origins.join(',')).split(',');

// 动态查找 openclaw.mjs 路径
function findOpenClawPath() {
  if (process.env.OPENCLAW_PATH) return process.env.OPENCLAW_PATH;
  // 尝试常见路径
  const candidates = [
    '/opt/openclaw/openclaw.mjs',
    path.join(OPENCLAW_HOME, 'openclaw.mjs'),
    '/usr/local/bin/openclaw.mjs',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // 尝试 which
  try {
    const result = execSync('which openclaw 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (result && fs.existsSync(result)) return result;
  } catch {}
  return candidates[0]; // 默认值
}
const OPENCLAW_PATH = findOpenClawPath();

// 辅助路径
const agentsBasePath = path.join(OPENCLAW_HOME, 'agents');
const openclawConfigPath = path.join(OPENCLAW_HOME, 'openclaw.json');

const app = express();
const PORT = API_PORT;

// ============================================================
// Middleware
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - 支持本地和指定域名
app.use((req, res, next) => {
  const origin = req.headers['origin'];
  if (!origin || CORS_ORIGINS.some(o => origin.includes(o.trim()))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ---- SQLite DB Init ----
const db = require('./db/init-db.cjs');
let dbReady = false;
(async () => {
  await db.initDb();
  await db.syncFromOpenClaw();
  dbReady = true;
  console.log('✅ Agent DB ready');
})();

// ============================================================
// API Key Auth
// ============================================================
const API_KEY_FILE = path.join(DATA_DIR, 'api_key.txt');
function getApiKey() {
  try {
    if (fs.existsSync(API_KEY_FILE)) return fs.readFileSync(API_KEY_FILE, 'utf-8').trim();
  } catch {}
  return null;
}
function ensureApiKey() {
  if (!getApiKey()) {
    const crypto = require('crypto');
    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(API_KEY_FILE, key, 'utf-8');
    console.log(`New API Key: ${key}`);
    return key;
  }
  return getApiKey();
}
const API_KEY = ensureApiKey();

const authMiddleware = (req, res, next) => {
  if (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1') {
    return next();
  }
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    if (token === API_KEY) return next();
  }
  res.status(401).json({ success: false, error: 'Unauthorized' });
};

// 公开路径（无需认证）
const PUBLIC_PATHS = ['/agents', '/channels', '/health', '/sessions', '/plugins'];
app.use('/api', (req, res, next) => {
  if (req.path === '/login') return next();
  if (req.path === '/key') return next();
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) return next();
  return authMiddleware(req, res, next);
});

// ============================================================
// POST /api/login
// ============================================================
const USERS_FILE = path.join(DATA_DIR, 'users.json');
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {}
  return {}; // 无默认用户，首次使用须在 config.json 中配置
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}
// 首次启动时如无用户配置，生成随机密码并写入 users.json，同时打印警告
if (!fs.existsSync(USERS_FILE)) {
  const randomPass = crypto.randomBytes(8).toString('hex');
  const defaultUsers = { admin: { password: randomPass, name: '管理员' } };
  saveUsers(defaultUsers);
  console.warn('⚠️ 未检测到用户配置，已自动生成随机密码（请尽快修改 config.json）：');
  console.warn(`   用户名: admin  密码: ${randomPass}`);
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  const users = loadUsers();
  const user = users[username];
  if (!user || user.password !== password) return res.status(401).json({ success: false, error: '用户名或密码错误' });
  const crypto = require('crypto');
  const token = crypto.createHmac('sha256', API_KEY).update(`${username}:${Date.now()}`).digest('hex');
  res.json({ success: true, token, user: { username, name: user.name } });
});

// ============================================================
// GET /api/key
// ============================================================
app.get('/api/key', (req, res) => {
  res.json({ key: API_KEY });
});

// ============================================================
// GET /api/agents
// ============================================================
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    const nowMs = Date.now();
    const BUSY_THRESHOLD_MS = 120000;

    const withStatus = await Promise.all(agents.map(async agent => {
      const sessionsPath = path.join(agentsBasePath, agent.id, 'sessions', 'sessions.json');
      let status = 'idle', lastActivity = null;
      try {
        if (fs.existsSync(sessionsPath)) {
          const sessionsObj = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
          const keys = Object.keys(sessionsObj);
          if (keys.length > 0) {
            let latest = null;
            for (const k of keys) {
              const s = sessionsObj[k];
              if (!latest || (s.updatedAt && s.updatedAt > latest.updatedAt)) latest = s;
            }
            if (latest && latest.updatedAt) {
              const ageMs = nowMs - latest.updatedAt;
              lastActivity = new Date(latest.updatedAt).toISOString();
              if (!latest.abortedLastRun && ageMs < BUSY_THRESHOLD_MS) status = 'busy';
            }
          }
        }
      } catch {}
      return {
        id: agent.id,
        identityName: agent.identity_name,
        identityEmoji: agent.identity_emoji,
        identitySource: agent.identity_source,
        model: agent.model || null,
        specialties: agent.specialties || '',
        vibe: agent.vibe || '',
        workspace: agent.workspace,
        agentDir: agent.agent_dir,
        parentId: agent.parent_id,
        isPersistent: !!agent.is_persistent,
        sessionKey: agent.session_key,
        runtimeStatus: status,
        lastActivity,
      };
    }));
    res.json({ success: true, data: withStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/agents
// ============================================================
app.post('/api/agents', authMiddleware, async (req, res) => {
  const { identityName, identityEmoji, workspace, agentDir } = req.body || {};
  if (!identityName) return res.status(400).json({ success: false, error: 'identityName required' });

  const safeId = `temp_${Date.now()}`;
  const workspacePath = workspace || path.join(OPENCLAW_HOME, 'workspace', 'agents', safeId);
  const agentDirPath = agentDir || path.join(agentsBasePath, safeId, 'agent');
  const emoji = identityEmoji || '🤖';

  try {
    try {
      execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" agents add --json --non-interactive "${safeId}" --workspace "${workspacePath}" --agent-dir "${agentDirPath}" 2>&1`, { encoding: 'utf-8', timeout: 15000 });
      execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" agents set-identity --agent "${safeId}" --name "${identityName}" --emoji "${emoji}" 2>&1`, { encoding: 'utf-8', timeout: 10000 });
    } catch (e) {}

    await db.createAgent(safeId, identityName, emoji, workspacePath, agentDirPath, null);
    res.json({ success: true, id: safeId, identityName, identityEmoji: emoji, message: 'Agent 创建成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/agents/:id
// ============================================================
app.delete('/api/agents/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'id required' });
  const AGENT_CORE = ['main', 'frontend', 'backend', 'tester', 'devops', 'analyst', 'godot'];
  if (AGENT_CORE.includes(id)) {
    return res.status(403).json({ success: false, error: `禁止删除核心 Agent: ${id}` });
  }
  try {
    const agent = await db.getAgentById(id);
    if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
    
    if (agent.is_persistent) {
      try {
        execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" agents delete --force "${id}" 2>&1`, { encoding: 'utf-8', timeout: 15000 });
      } catch (e) {}
    }
    
    await db.deleteAgent(id);
    res.json({ success: true, message: `Agent ${id} 已删除` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/agents/status
// ============================================================
app.get('/api/agents/status', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    const nowMs = Date.now();
    const BUSY_THRESHOLD_MS = 120000;
    const statuses = await Promise.all(agents.map(async agent => {
      const sessionsPath = path.join(agentsBasePath, agent.id, 'sessions', 'sessions.json');
      let status = 'idle', lastActivity = null;
      try {
        if (fs.existsSync(sessionsPath)) {
          const sessionsObj = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
          const keys = Object.keys(sessionsObj);
          let latest = null;
          for (const k of keys) {
            const s = sessionsObj[k];
            if (!latest || (s.updatedAt && s.updatedAt > latest.updatedAt)) latest = s;
          }
          if (latest && latest.updatedAt) {
            const ageMs = nowMs - latest.updatedAt;
            lastActivity = new Date(latest.updatedAt).toISOString();
            if (!latest.abortedLastRun && ageMs < BUSY_THRESHOLD_MS) status = 'busy';
          }
        }
      } catch {}
      return { id: agent.id, name: agent.identity_name || agent.id, emoji: agent.identity_emoji || '🤖', status, lastActivity };
    }));
    res.json({ success: true, data: statuses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/sessions
// ============================================================
app.get('/api/sessions', (req, res) => {
  try {
    const agentsOutput = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" agents list --json`, {
      encoding: 'utf-8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
    let agents = [];
    try { const d = JSON.parse(agentsOutput); agents = Array.isArray(d) ? d : []; } catch {}

    const result = [];
    for (const agent of agents) {
      const sessionsPath = path.join(agentsBasePath, agent.id, 'sessions', 'sessions.json');
      try {
        if (fs.existsSync(sessionsPath)) {
          const sessionsObj = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
          const keys = Object.keys(sessionsObj);
          const sessions = keys.map(k => {
            const s = sessionsObj[k];
            return {
              sessionKey: k,
              updatedAt: s.updatedAt,
              totalTokens: s.totalTokens || 0,
              model: s.model || null,
              abortedLastRun: s.abortedLastRun || false,
            };
          }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          result.push({
            agentId: agent.id,
            agentName: agent.identityName || agent.id,
            agentEmoji: agent.identityEmoji || '🤖',
            sessionCount: sessions.length,
            sessions,
          });
        }
      } catch {}
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/sessions/:agentId
// ============================================================
app.get('/api/sessions/:agentId', (req, res) => {
  const { agentId } = req.params;
  const sessionsPath = path.join(agentsBasePath, agentId, 'sessions', 'sessions.json');
  try {
    if (!fs.existsSync(sessionsPath)) {
      return res.json({ success: true, data: [], agentId });
    }
    const sessionsObj = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
    const sessions = Object.entries(sessionsObj).map(([k, s]) => ({
      sessionKey: k,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      totalTokens: s.totalTokens || 0,
      model: s.model || null,
      abortedLastRun: s.abortedLastRun || false,
    })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ success: true, data: sessions, agentId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/sessions
// ============================================================
app.post('/api/sessions', (req, res) => {
  const { agentId, message } = req.body;
  if (!agentId || !message) return res.status(400).json({ success: false, error: 'agentId and message required' });
  exec(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" agent --agent ${agentId} --message "${message.replace(/"/g, '\\"')}" 2>&1`, {
    timeout: 300000,
    maxBuffer: 4 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[agent-api] session to ${agentId} failed:`, err.message);
    } else {
      console.log(`[agent-api] session to ${agentId} done`);
    }
  });
  res.json({ success: true, accepted: true, agentId, message: 'Message sent to agent' });
});

// ============================================================
// POST /api/agents/:agentId/sessions
// ============================================================
app.post('/api/agents/:agentId/sessions', (req, res) => {
  const { agentId } = req.params;
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'message required' });

  exec(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" agent --agent ${agentId} --message "${message.replace(/"/g, '\\"')}" 2>&1`, {
    timeout: 300000,
    maxBuffer: 4 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[agent-api] message to ${agentId} failed:`, err.message);
    } else {
      console.log(`[agent-api] message to ${agentId} sent`);
    }
  });

  res.json({ success: true, accepted: true, agentId, message: 'Message sent to agent' });
});

// ============================================================
// GET /api/sessions/:agentId/:sessionKey/messages
// ============================================================
app.get('/api/sessions/:agentId/:sessionKey/messages', (req, res) => {
  const { agentId, sessionKey } = req.params;
  const messagesPath = path.join(agentsBasePath, agentId, 'sessions', `${sessionKey}.jsonl`);
  try {
    if (!fs.existsSync(messagesPath)) {
      return res.json({ success: true, data: [], messages: [] });
    }
    const lines = fs.readFileSync(messagesPath, 'utf-8').split('\n').filter(l => l.trim());
    const messages = lines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    res.json({ success: true, data: messages, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/sessions/:agentId/:sessionKey
// ============================================================
app.delete('/api/sessions/:agentId/:sessionKey', (req, res) => {
  const { agentId, sessionKey } = req.params;
  try {
    const output = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" sessions delete ${agentId} ${sessionKey} 2>&1`, {
      encoding: 'utf-8', timeout: 10000,
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/models
// ============================================================
app.get('/api/models', (req, res) => {
  try {
    let models = [];
    try {
      const config = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf-8'));
      const providers = config.models?.providers || {};
      for (const [providerId, pdata] of Object.entries(providers)) {
        for (const m of (pdata.models || [])) {
          models.push({
            key: `${providerId}/${m.id}`,
            id: m.id, name: m.name || m.id,
            provider: providerId,
            input: m.input || [],
            contextWindow: m.contextWindow || 0,
          });
        }
      }
    } catch {}
    res.json({ success: true, data: models });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/channels
// ============================================================
app.get('/api/channels', (req, res) => {
  try {
    let output;
    try {
      output = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" channels list --json`, {
        encoding: 'utf-8', timeout: 5000, maxBuffer: 4 * 1024 * 1024,
      });
    } catch {
      output = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" channels list`, {
        encoding: 'utf-8', timeout: 5000, maxBuffer: 4 * 1024 * 1024,
      });
    }
    const lines = output.split('\n').filter(l => l.trim());
    const channels = [];
    for (const line of lines) {
      if (line.startsWith('- ')) {
        const s = line.slice(2).trim();
        const ci = s.indexOf(':');
        if (ci > 0) {
          const name = s.slice(0, ci).trim();
          const parts = name.split(/\s+/);
          channels.push({ id: name, name, provider: (parts[0] || 'unknown').toLowerCase(), status: s.slice(ci + 1).trim() });
        } else if (s.includes(':')) {
          const [n, ...st] = s.split(':');
          channels.push({ id: n.trim(), name: n.trim(), provider: n.trim().split(/\s+/)[0].toLowerCase(), status: st.join(':').trim() });
        }
      }
    }
    res.json({ success: true, data: channels, raw: output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/channels/status
// ============================================================
app.get('/api/channels/status', (req, res) => {
  try {
    const output = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" channels status`, {
      encoding: 'utf-8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
    res.json({ success: true, data: output, raw: output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/channels
// ============================================================
app.post('/api/channels', (req, res) => {
  const { channel, appId, appSecret, botToken } = req.body;
  if (!channel) return res.status(400).json({ success: false, error: 'channel is required' });
  try {
    const output = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" channels add --channel ${channel} 2>&1`, {
      encoding: 'utf-8', timeout: 15000,
    });
    res.json({ success: true, message: `Channel '${channel}' added`, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/channels/:name
// ============================================================
app.delete('/api/channels/:name', (req, res) => {
  const { name } = req.params;
  const parts = name.split(/\s+/);
  const channel = parts[0] || name;
  const account = parts.slice(1).join(' ') || undefined;
  try {
    let cmd = `${OPENCLAW_CLI} "${OPENCLAW_PATH}" channels remove --channel ${channel} --delete`;
    if (account) cmd += ` --account "${account}"`;
    const output = execSync(cmd + ' 2>&1', { encoding: 'utf-8', timeout: 10000 });
    res.json({ success: true, message: `Channel '${name}' removed`, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/skills
// ============================================================
app.get('/api/skills', (req, res) => {
  try {
    const output = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" skills list --json 2>&1`, {
      encoding: 'utf-8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
    let skills = [];
    try { const d = JSON.parse(output); skills = Array.isArray(d) ? d : (d.skills || []); } catch {}
    res.json({ success: true, data: skills });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/plugins
// ============================================================
app.get('/api/plugins', (req, res) => {
  try {
    const output = execSync(`${OPENCLAW_CLI} "${OPENCLAW_PATH}" plugins list --json 2>&1`, {
      encoding: 'utf-8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
    const jsonStart = output.indexOf('{');
    const jsonStr = jsonStart >= 0 ? output.substring(jsonStart) : output;
    let plugins = [];
    try { const d = JSON.parse(jsonStr); plugins = Array.isArray(d) ? d : (d.plugins || []); } catch (e) { console.error('Parse plugins error:', e.message); }
    res.json({ success: true, data: plugins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/health
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// HTML UI
// ============================================================
function buildHTML() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenClaw Agent API</title><style>
  body{font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:40px;margin:0}
  h1{color:#60a5fa}h2{color:#a78bfa;margin-top:30px}
  .endpoint{margin:8px 0;padding:10px;background:#1e293b;border-radius:8px}
  .method{background:#7c3aed;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px}
  .ok{color:#22c55e}.err{color:#ef4444}
  pre{background:#0f172a;padding:15px;border-radius:8px;overflow-x:auto}
  a{color:#60a5fa}
</style></head><body>
<h1>🦞 OpenClaw Agent API</h1>
<p>OpenClaw Home: <code>${OPENCLAW_HOME}</code></p>
<p>API Base: <code>http://localhost:${PORT}/api</code></p>
<h2>认证</h2>
<p>外部请求需要 <code>Authorization: Bearer &lt;API_KEY&gt;</code></p>
<p>当前 Key: <code>${API_KEY}</code></p>
<h2>接口列表</h2>
<div class="endpoint"><span class="method">GET</span> <a href="/api/health">/api/health</a> - 健康检查</div>
<div class="endpoint"><span class="method">GET</span> /api/agents - Agent列表</div>
<div class="endpoint"><span class="method">GET</span> /api/agents/status - Agent实时状态</div>
<div class="endpoint"><span class="method">GET</span> /api/models - 模型列表</div>
<div class="endpoint"><span class="method">GET</span> /api/channels - 频道列表</div>
<div class="endpoint"><span class="method">GET</span> /api/channels/status - 频道状态</div>
<div class="endpoint"><span class="method">GET</span> /api/skills - 技能列表</div>
<div class="endpoint"><span class="method">GET</span> /api/plugins - 插件列表</div>
<div class="endpoint"><span class="method">POST</span> /api/login - 用户登录</div>
<div class="endpoint"><span class="method">POST</span> /api/channels - 添加频道</div>
<div class="endpoint"><span class="method">DELETE</span> /api/channels/:name - 删除频道</div>
</body></html>`;
}

app.get('/', (req, res) => { res.send(buildHTML()); });

// Start
fs.mkdirSync(DATA_DIR, { recursive: true });
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🦞 OpenClaw Agent API running at http://0.0.0.0:${PORT}`);
  console.log(`   OpenClaw Home: ${OPENCLAW_HOME}`);
  console.log(`   OpenClaw CLI: ${OPENCLAW_CLI} ${OPENCLAW_PATH}`);
  console.log(`   Web UI: http://localhost:${PORT}/`);
  console.log(`   API base: http://0.0.0.0:${PORT}/api`);
});
