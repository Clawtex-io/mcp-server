# @clawtex/mcp-server

Structured memory for AI agents. Gives your agent persistent state, event history, and AI-extracted lessons across sessions.

## Setup

### The one-command way (recommended)

```sh
npx -y @clawtex/mcp-server login
```

Your browser opens on clawtex.io — sign in (or create a free account), approve the code shown in your terminal, and the command receives your API key and wires Claude Code automatically. Nothing to copy, no files to edit. Restart Claude Code and you're done.

For tools embedding this flow: `login --json` prints a single JSON line (`{"api_key":"tkr_…"}` or `{"error":"…"}`) and skips the Claude wiring so the caller can do its own.

### Manual setup

#### 1. Get an API key

Sign up at [clawtex.io](https://clawtex.io/signup) and create an agent. Your API key starts with `tkr_`.

#### 2. Add to your Claude config

**Claude Code**, edit `~/.claude/settings.json`:
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

**Claude Desktop**, edit the config file at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add the same `clawtex` block inside `mcpServers`.

### 3. Restart Claude

Start a new session. Clawtex loads your state and lessons automatically.

### 4. Verify it works

Ask Claude: "What Clawtex tools do you have?"

It should list 17 tools including `clawtex_bootstrap`, `clawtex_log_event`, and `clawtex_update_state`. Your dashboard at [clawtex.io](https://clawtex.io) will show the agent as "Active".

## Usage

Once connected, you talk to your agent in plain language and it calls the right tool. The examples below show a realistic prompt, the tool that fires, and the parameters it sends. Every parameter name is taken from the tool schemas.

### Load context at the start of a session

Situation: you open a new session and want the agent working from what it already knows.

You say: "Bootstrap your Clawtex memory before we start."

What happens: the agent calls `clawtex_bootstrap` (no parameters) and receives your current state entities, active lessons, recent events, and operational rules in one response.

### Log a deployment

Situation: you just shipped a release and want it on the record.

You say: "Log that we deployed the website rebuild to production and it went out clean."

What happens: the agent calls `clawtex_log_event`.
```json
{
  "type": "deploy",
  "summary": "Deployed website rebuild to production",
  "entity": "project/website-rebuild",
  "outcome": "Shipped clean, no rollback"
}
```
`type` must be one of `decision`, `milestone`, `blocker`, `task`, `note`, `deploy`, `build`, or `contact`. Only `type` and `summary` are required.

### Create or update a state entity

Situation: you take on a new client and want their details tracked.

You say: "Track Acme Corp as an active client, main contact Jane Doe."

What happens: the agent calls `clawtex_update_state`. This is an upsert: if an entity with the same `id` and `type` exists it is updated, otherwise it is created.
```json
{
  "id": "acme-corp",
  "type": "clients",
  "data": {
    "name": "Acme Corp",
    "status": "active",
    "contact": "Jane Doe"
  }
}
```

### Search memory

Situation: you half-remember a past decision and want the details.

You say: "Search Clawtex for anything about the auth rewrite."

What happens: the agent calls `clawtex_search` with `query` set to your phrasing. The search spans events, state entities, and lessons, and returns matches grouped by category.
```json
{
  "query": "auth rewrite"
}
```

### Run the lesson lifecycle

Situation: enough has happened that patterns are worth capturing as reusable guardrails.

You say: "Extract lessons from recent events, then approve the deploy one and mark it as followed today."

What happens: three tools fire in sequence.

1. `clawtex_extract_lessons` (no parameters) analyses recent event history and proposes lessons in pending status. Pro and Team tiers only.
2. `clawtex_approve_lesson` promotes a proposed lesson to active so it shows up in bootstrap context.
   ```json
   { "lesson_id": "LSN-abc123" }
   ```
3. `clawtex_signal_lesson` records whether the lesson was relevant and followed, which tracks its effectiveness over time.
   ```json
   { "lesson_id": "LSN-abc123", "relevant": true, "followed": true }
   ```

## Tools

| Tool | Description |
|------|-------------|
| `clawtex_bootstrap` | Return full agent context: state entities, active lessons, recent events, and rules |
| `clawtex_get_state` | Return state entities, optionally filtered by type |
| `clawtex_get_events` | Return event history, filtered by time range, entity, and type |
| `clawtex_get_lessons` | Return active lessons |
| `clawtex_get_sessions` | Return recent tracked sessions |
| `clawtex_search` | Search across events, state entities, and lessons |
| `clawtex_update_state` | Create or update a state entity via upsert |
| `clawtex_log_event` | Log a decision, milestone, blocker, task, note, deploy, build, or contact |
| `clawtex_extract_lessons` | Trigger AI lesson extraction from recent events (Pro and Team tiers) |
| `clawtex_create_lesson` | Create a lesson manually in pending status |
| `clawtex_approve_lesson` | Approve a pending lesson, making it active |
| `clawtex_reject_lesson` | Reject a pending lesson |
| `clawtex_signal_lesson` | Record whether a lesson was relevant and followed |
| `clawtex_start_session` | Start a tracked work session |
| `clawtex_end_session` | End a session with a summary |
| `clawtex_delete_state` | Permanently delete a state entity by ID |
| `clawtex_delete_event` | Permanently delete an event by ID |

## Troubleshooting

### Server exits with a CLAWTEX_API_KEY error

If the API key is missing, the server prints the following and exits before Claude can use it:
```
CLAWTEX_API_KEY is required.

1. Sign up at https://clawtex.io/signup
2. Create an agent and copy your API key
3. Add to your Claude config:
   ...
```
Fix: confirm the `env` block in your config sets `CLAWTEX_API_KEY` to a real key starting with `tkr_`, then restart Claude.

### Clawtex does not appear in Claude's tool list

Check, in order:
- **Config file path.** Claude Code reads `~/.claude/settings.json`. Claude Desktop reads `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Editing the wrong file has no effect.
- **Restart.** Config changes only load in a new session. Quit and reopen Claude.
- **JSON syntax.** A trailing comma or an unclosed brace stops the whole config from loading. Paste the file into a JSON validator if the block looks correct but nothing appears.

### npx is running a stale version

`npx` can serve a cached older build. Pin the latest release:
```json
"args": ["-y", "@clawtex/mcp-server@latest"]
```
If that still serves an old version, clear the npx cache with `npx clear-npx-cache` (or remove the `_npx` folder in your npm cache directory) and restart Claude.

### Confirm it is connected

Ask Claude "What Clawtex tools do you have?" and check that it lists 17 `clawtex_` tools. Your dashboard at [clawtex.io](https://clawtex.io) will show the agent as "Active".

## Documentation

Full docs at [clawtex.io/docs](https://clawtex.io/docs)

## License

[Business Source License 1.1](LICENSE)
