// `npx @clawtex/mcp-server login` — device-authorization flow.
// Opens the browser to clawtex.io/device, waits for approval, receives the
// api key, and wires Claude Code automatically. No copying, no config edits.
//
// --json: machine mode for embedders (e.g. the Studio Cockpit onboarding):
// exactly one JSON line on stdout ({"api_key":"…"} or {"error":"…"}), no
// browser-independent output suppressed, and NO claude wiring (caller's job).
import { spawn } from "node:child_process";

const BASE_URL = process.env.CLAWTEX_API_URL || "https://www.clawtex.io/api";

type StartResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export type LoginDeps = {
  fetchFn: typeof fetch;
  openBrowser: (url: string) => void;
  runCommand: (cmd: string, args: string[]) => Promise<{ code: number | null; error?: string }>;
  log: (line: string) => void;      // human-mode progress (stderr)
  out: (line: string) => void;      // final output (stdout)
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

export function defaultDeps(): LoginDeps {
  return {
    fetchFn: fetch,
    openBrowser: (url) => { spawn("open", [url], { stdio: "ignore", detached: true }).on("error", () => {}); },
    runCommand: (cmd, args) =>
      new Promise((resolve) => {
        const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "ignore"] });
        child.on("error", (e) => resolve({ code: null, error: String(e) }));
        child.on("exit", (code) => resolve({ code }));
      }),
    log: (line) => console.error(line),
    out: (line) => console.log(line),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };
}

const MANUAL_SNIPPET = (key: string) => `
Add this to your Claude Code config manually:

  claude mcp add -s user -e CLAWTEX_API_KEY=${key} clawtex -- npx -y @clawtex/mcp-server

or in the JSON config:

  {
    "mcpServers": {
      "clawtex": {
        "command": "npx",
        "args": ["-y", "@clawtex/mcp-server"],
        "env": { "CLAWTEX_API_KEY": "${key}" }
      }
    }
  }
`;

export async function runLogin(json: boolean, deps: LoginDeps): Promise<number> {
  const fail = (message: string): number => {
    if (json) deps.out(JSON.stringify({ error: message }));
    else deps.log(`\n${message}\n`);
    return 1;
  };

  let start: StartResponse;
  try {
    const res = await deps.fetchFn(`${BASE_URL}/device/start`, { method: "POST" });
    if (!res.ok) return fail(`clawtex.io rejected the request (HTTP ${res.status}). Try again in a minute.`);
    start = (await res.json()) as StartResponse;
  } catch {
    return fail("Could not reach clawtex.io. Check your connection and try again.");
  }

  const approveUrl = `${start.verification_uri}?code=${encodeURIComponent(start.user_code)}`;
  if (!json) {
    deps.log("");
    deps.log(`  Your code:  ${start.user_code}`);
    deps.log(`  Approve at: ${approveUrl}`);
    deps.log("");
    deps.log("  Opening your browser… sign in (or create a free account) and approve.");
    deps.log("  Waiting for approval…");
  }
  deps.openBrowser(approveUrl);

  const deadline = deps.now() + start.expires_in * 1000;
  const intervalMs = Math.max(2, start.interval || 5) * 1000;
  let apiKey = "";

  while (deps.now() < deadline) {
    await deps.sleep(intervalMs);
    let body: { status?: string; api_key?: string };
    try {
      const res = await deps.fetchFn(`${BASE_URL}/device/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: start.device_code }),
      });
      body = (await res.json()) as { status?: string; api_key?: string };
    } catch {
      continue; // transient network blip — keep polling until the deadline
    }
    if (body.status === "approved" && body.api_key) { apiKey = body.api_key; break; }
    if (body.status === "denied") return fail("The request was denied in the browser.");
    if (body.status === "expired") return fail("The code expired. Run login again.");
    // pending → keep waiting
  }

  if (!apiKey) return fail("Timed out waiting for approval. Run login again.");

  if (json) {
    deps.out(JSON.stringify({ api_key: apiKey }));
    return 0;
  }

  deps.log("  Approved ✓");
  deps.log("  Connecting Claude Code…");
  const result = await deps.runCommand("claude", [
    "mcp", "add", "-s", "user",
    "-e", `CLAWTEX_API_KEY=${apiKey}`,
    "clawtex", "--", "npx", "-y", "@clawtex/mcp-server",
  ]);

  if (result.code === 0) {
    deps.log("");
    deps.log("  Done — Clawtex memory is connected. Restart Claude Code to pick it up.");
    return 0;
  }

  // claude missing or the add failed — never lose the key the user just earned
  deps.log("");
  deps.log(result.error ? "  Could not find the `claude` CLI on your PATH." : "  `claude mcp add` failed.");
  deps.log(`  Your API key: ${apiKey}`);
  deps.log(MANUAL_SNIPPET(apiKey));
  return 1;
}
