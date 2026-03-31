const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'agents.db');

let db = null;
let SQL = null;

async function getDb() {
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

async function initDb() {
  const database = await getDb();
  database.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id              TEXT PRIMARY KEY,
      identity_name   TEXT,
      identity_emoji TEXT DEFAULT '🤖',
      identity_source TEXT DEFAULT 'identity',
      workspace       TEXT,
      agent_dir       TEXT,
      parent_id       TEXT,
      session_key     TEXT,
      is_persistent   INTEGER DEFAULT 0,
      is_deleted      INTEGER DEFAULT 0,
      created_at      INTEGER,
      updated_at      INTEGER
    )
  `);
  database.run(`CREATE INDEX IF NOT EXISTS idx_agents_persistent ON agents(is_persistent)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_agents_not_deleted ON agents(is_deleted)`);
  saveDb();
  console.log('✅ SQLite schema ready');
}

function rowsToObjects(results) {
  if (!results || !results.length || !results[0].values.length) return [];
  const cols = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    return obj;
  });
}

async function createAgent(id, identityName, identityEmoji, workspace, agentDir, parentId = null) {
  const database = await getDb();
  const now = Date.now();
  database.run(`
    INSERT INTO agents (id, identity_name, identity_emoji, workspace, agent_dir, parent_id, is_persistent, is_deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      identity_name = excluded.identity_name,
      identity_emoji = excluded.identity_emoji,
      workspace = excluded.workspace,
      agent_dir = excluded.agent_dir,
      is_deleted = 0,
      updated_at = excluded.updated_at
  `, [id, identityName, identityEmoji || '🤖', workspace, agentDir, parentId, parentId ? 0 : 1, now, now]);
  saveDb();
  return { id, identityName, identityEmoji: identityEmoji || '🤖' };
}

async function deleteAgent(id) {
  const database = await getDb();
  database.run(`UPDATE agents SET is_deleted = 1, updated_at = ? WHERE id = ?`, [Date.now(), id]);
  saveDb();
}

async function updateAgent(id, fields) {
  const database = await getDb();
  const now = Date.now();
  const allowed = ['identity_name', 'identity_emoji', 'workspace', 'session_key'];
  const sets = [], values = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); values.push(v); }
  }
  if (!sets.length) return;
  sets.push('updated_at = ?');
  values.push(now, id);
  database.run(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
}

async function getAllAgents(includeDeleted = false) {
  const database = await getDb();
  const sql = includeDeleted
    ? `SELECT * FROM agents ORDER BY is_persistent DESC, created_at DESC`
    : `SELECT * FROM agents WHERE is_deleted = 0 ORDER BY is_persistent DESC, created_at DESC`;
  const results = database.exec(sql);
  return rowsToObjects(results);
}

async function getAgentById(id) {
  const database = await getDb();
  const stmt = database.prepare(`SELECT * FROM agents WHERE id = ? AND is_deleted = 0`);
  stmt.bind([id]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows[0] || null;
}

// 同步 OpenClaw agents list → SQLite
async function syncFromOpenClaw() {
  const { execSync } = require('child_process');
  try {
    const output = execSync(`node /opt/openclaw/openclaw.mjs agents list --json`, {
      encoding: 'utf-8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
    let agents = [];
    try { agents = JSON.parse(output); } catch {}

    const database = await getDb();
    const now = Date.now();
    for (const agent of agents) {
      database.run(`
        INSERT INTO agents (id, identity_name, identity_emoji, identity_source, workspace, agent_dir, is_persistent, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          identity_name = excluded.identity_name,
          identity_emoji = excluded.identity_emoji,
          workspace = excluded.workspace,
          agent_dir = excluded.agent_dir,
          is_persistent = 1,
          is_deleted = 0,
          updated_at = excluded.updated_at
      `, [
        agent.id,
        agent.identityName || agent.id,
        agent.identityEmoji || '🤖',
        agent.identitySource || 'identity',
        agent.workspace || '',
        agent.agentDir || '',
        now, now
      ]);
    }
    saveDb();
    console.log(`🔄 Synced ${agents.length} persistent agents from OpenClaw`);
  } catch (err) {
    console.error('Sync error:', err.message);
  }
}

module.exports = { getDb, initDb, syncFromOpenClaw, createAgent, deleteAgent, updateAgent, getAllAgents, getAgentById };
