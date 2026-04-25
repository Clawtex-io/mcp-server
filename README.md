# @clawtex/mcp-server

Structured memory for AI agents. Gives your agent persistent state, event history, and AI-extracted lessons across sessions.

## Setup

### 1. Get an API key

Sign up at [clawtex.io](https://clawtex.io/signup) and create an agent. Your API key starts with `tkr_`.

### 2. Add to your Claude config

**Claude Code** — edit `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "clawtex": {
      "command": "npx",
      "args": ["-y", "@clawtex/mcp-server"],
      "env": {
        "CLAWTEX_API_KEY": "tkr_your_key_here"
      }
    }
  }
}
```

**Claude Desktop** — edit the config file at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add the same `clawtex` block inside `mcpServers`.

### 3. Restart Claude

Start a new session. Clawtex loads your state and lessons automatically.

### 4. Verify it works

Ask Claude: "What Clawtex tools do you have?"

It should list 15 tools including `clawtex_bootstrap`, `clawtex_log_event`, and `clawtex_update_state`. Your dashboard at [clawtex.io](https://clawtex.io) will show the agent as "Active".

## Tools

| Tool | Description |
|------|-------------|
| `clawtex_bootstrap` | Load full context (state + lessons + events + rules) |
| `clawtex_get_state` | Read state entities |
| `clawtex_update_state` | Create or update a state entity |
| `clawtex_log_event` | Log a decision, milestone, blocker, task, or deployment |
| `clawtex_get_events` | Query event history |
| `clawtex_get_lessons` | Get active lessons |
| `clawtex_extract_lessons` | Trigger AI lesson extraction from events |
| `clawtex_create_lesson` | Manually create a lesson |
| `clawtex_approve_lesson` | Approve a pending lesson |
| `clawtex_reject_lesson` | Reject a pending lesson |
| `clawtex_signal_lesson` | Track lesson effectiveness |
| `clawtex_start_session` | Start a tracked work session |
| `clawtex_end_session` | End a session with summary |
| `clawtex_get_sessions` | View recent sessions |
| `clawtex_search` | Search across all memory |

## Documentation

Full docs at [clawtex.io/docs](https://clawtex.io/docs)

## License

[Business Source License 1.1](LICENSE)
