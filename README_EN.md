# AICube Dashboard

A web-based control panel for OpenClaw, providing visual management of Agents, Channels, Plugins, and Skills.

## Features

- 🤖 **Agent Management**: View, create, delete Agents, set identity
- 📊 **Real-time Status**: Monitor Agent runtime status and last activity
- 🔌 **Plugin Management**: View all OpenClaw plugin statuses
- 🛠️ **Skill Management**: View available Skills
- 💬 **Channel Management**: Manage messaging channels (Feishu, Telegram, etc.)
- 💬 **Session Management**: View and manage Agent conversation sessions
- 📈 **Model Management**: View configured language models

## Requirements

- Node.js 18+
- OpenClaw installed and configured
- npm or pnpm

## Quick Start

### 1. Install Dependencies

```bash
cd aicube-dashboard
npm install
```

### 2. Configuration File

Copy `config.example.json` to `config.json` and modify:

```bash
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "server": {
    "port": 3000,
    "frontendPort": 5173
  },
  "openclaw": {
    "home": "~/.openclaw",
    "cli": "node",
    "path": ""
  },
  "cors": {
    "origins": ["localhost", "127.0.0.1", "your-domain.com"]
  },
  "auth": {
    "users": {
      "admin": {
        "password": "your-secure-password",
        "name": "Admin"
      }
    }
  }
}
```

### 3. Environment Variables (Optional, overrides config file)

```bash
export OPENCLAW_HOME=~/.openclaw
export OPENCLAW_CLI=node
export OPENCLAW_PATH=/opt/openclaw/openclaw.mjs
export API_PORT=3000
export CORS_ORIGINS=localhost,127.0.0.1,your-domain.com
export VITE_ALLOWED_HOSTS=your-domain.com   # for Vite HTTPS dev server
```

### 4. Start Services

```bash
# Start all (API + Frontend)
bash start.sh

# Or start separately
node server/index.cjs &    # API server (3000)
npm run dev:vite           # Frontend dev server (5173)
```

### 4. Access

- Frontend: http://localhost:5173 (or your domain)
- API: http://localhost:3000/api
- API Docs: http://localhost:3000/

## Project Structure

```
aicube-dashboard/
├── server/              # Express API server
│   ├── index.cjs       # API main file
│   ├── db/             # SQLite database
│   └── data/           # User data (API Key, user config)
├── src/                # Vue 3 frontend source
├── public/             # Static assets
├── dist/               # Build output
├── start.sh            # Auto-restart script
├── vite.config.js      # Vite configuration
└── package.json
```

## Default Account

**No built-in default.** On first startup:
- If `config.json` exists with an `auth.users` entry → use that password
- If no user is configured → a random password is auto-generated and printed to console

⚠️ **Set up your `auth.users` in `config.json` before first use.**

## Port Reference

| Service | Port | Description |
|---------|------|-------------|
| API Server | 3000 | Backend API, internal use |
| Frontend | 5173 | Vite dev server |

## API Endpoints

All endpoints accessible via `http://localhost:3000/api`:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/agents | List agents |
| GET | /api/agents/status | Agent real-time status |
| POST | /api/agents | Create agent |
| DELETE | /api/agents/:id | Delete agent |
| GET | /api/sessions | All sessions |
| GET | /api/sessions/:agentId | Sessions for specific agent |
| GET | /api/models | List models |
| GET | /api/channels | List channels |
| GET | /api/channels/status | Channel status |
| GET | /api/skills | List skills |
| GET | /api/plugins | List plugins |

## Authentication

Most endpoints require Bearer Token authentication:

```
Authorization: Bearer your-api-key
```

API Key can be found in `server/data/api_key.txt` after first start, or via `/api/key` endpoint.

## Auto-Restart

The `start.sh` script will automatically restart on crash. You can also enable startup on boot:

```bash
# Add to crontab for boot start
(crontab -l 2>/dev/null; echo "@reboot cd /path/to/aicube-dashboard && bash start.sh > /tmp/aicube.log 2>&1 &") | crontab -
```

## Production Deployment

1. Build frontend: `npm run build`
2. Use Nginx to proxy to port 5173
3. Configure HTTPS
4. Use systemd or PM2 to manage processes

## License

MIT License
