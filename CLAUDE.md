# @clawtex/mcp-server — build notes

The Clawtex MCP server: gives an AI agent persistent memory — state, event history, and AI-extracted lessons — over the Clawtex API. Published to npm as `@clawtex/mcp-server`. Source-available under BSL 1.1.

## Stack

Node / TypeScript, `@modelcontextprotocol/sdk`. Authenticates to the Clawtex API (clawtex.io) with a user-supplied `CLAWTEX_API_KEY` provided via environment — no credentials are stored in this repo.

## Commands

- Build: `npm run build` (`tsc` → `dist/`)
- Run: `npm run start` (`node dist/server.js`; requires `CLAWTEX_API_KEY`)
- Build + run: `npm run dev`

## Releasing

- Distributed via npm (`@clawtex/mcp-server`) and launched by the MCP client (e.g. Claude Code) per the user's config. This is not a hosted/web deploy.
- To release: bump `version` in `package.json`, `npm run build`, then publish to npm. The published package ships the built output, so keep `dist/` in sync with `src/`.
- Keep the tool set aligned with the Clawtex API contract.

## Branch discipline

Confirm the branch before starting work.
