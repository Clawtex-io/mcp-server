# @clawtex/mcp-server

Structured memory for AI agents. Gives your agent persistent state, event history, and AI-extracted lessons across sessions.

## Setup

1. Create an account at [clawtex.io](https://clawtex.io) and get your API key
2. Add to your Claude config:

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "clawtex": {
      "command": "npx",
      "args": ["@clawtex/mcp-server"],
      "env": {
        "CLAWTEX_API_KEY": "tkr_your_key_here"
      }
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "clawtex": {
      "command": "npx",
      "args": ["@clawtex/mcp-server"],
      "env": {
        "CLAWTEX_API_KEY": "tkr_your_key_here"
      }
    }
  }
}
```

3. Restart Claude. State and lessons auto-load at session start.

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
