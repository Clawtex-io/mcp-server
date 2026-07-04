import { describe, it, expect } from "vitest";
import { runLogin, type LoginDeps } from "./login.js";

type FetchStep = { status?: number; body: unknown };

function makeDeps(steps: FetchStep[], overrides: Partial<LoginDeps> = {}) {
  const calls: { urls: string[]; opened: string[]; ran: string[][]; out: string[]; log: string[] } =
    { urls: [], opened: [], ran: [], out: [], log: [] };
  let i = 0;
  let clock = 1_000_000;
  const deps: LoginDeps = {
    fetchFn: (async (url: string) => {
      calls.urls.push(String(url));
      const step = steps[Math.min(i++, steps.length - 1)];
      return {
        ok: (step.status ?? 200) < 400,
        status: step.status ?? 200,
        json: async () => step.body,
      } as Response;
    }) as unknown as typeof fetch,
    openBrowser: (url) => calls.opened.push(url),
    runCommand: async (cmd, args) => { calls.ran.push([cmd, ...args]); return { code: 0 }; },
    log: (l) => calls.log.push(l),
    out: (l) => calls.out.push(l),
    sleep: async () => { clock += 5000; },
    now: () => clock,
    ...overrides,
  };
  return { deps, calls };
}

const START = {
  device_code: "secret-device-code",
  user_code: "ABCD-EFGH",
  verification_uri: "https://www.clawtex.io/device",
  expires_in: 900,
  interval: 5,
};

describe("runLogin", () => {
  it("happy path: opens browser, polls to approval, wires claude", async () => {
    const { deps, calls } = makeDeps([
      { body: START },
      { body: { status: "pending" } },
      { body: { status: "approved", api_key: "tkr_test123" } },
    ]);
    const code = await runLogin(false, deps);
    expect(code).toBe(0);
    expect(calls.opened[0]).toContain("/device?code=ABCD-EFGH");
    expect(calls.ran[0]).toEqual([
      "claude", "mcp", "add", "-s", "user", "clawtex",
      "-e", "CLAWTEX_API_KEY=tkr_test123",
      "--", "npx", "-y", "@clawtex/mcp-server",
    ]);
  });

  it("--json emits exactly one json line with the key and does NOT wire claude", async () => {
    const { deps, calls } = makeDeps([
      { body: START },
      { body: { status: "approved", api_key: "tkr_test123" } },
    ]);
    const code = await runLogin(true, deps);
    expect(code).toBe(0);
    expect(calls.out).toEqual([JSON.stringify({ api_key: "tkr_test123" })]);
    expect(calls.ran).toEqual([]);
  });

  it("--json failure emits an error json line and non-zero exit", async () => {
    const { deps, calls } = makeDeps([
      { body: START },
      { body: { status: "denied" } },
    ]);
    const code = await runLogin(true, deps);
    expect(code).toBe(1);
    expect(JSON.parse(calls.out[0])).toHaveProperty("error");
  });

  it("denied stops polling with a failure", async () => {
    const { deps } = makeDeps([{ body: START }, { body: { status: "denied" } }]);
    expect(await runLogin(false, deps)).toBe(1);
  });

  it("expired stops with a failure", async () => {
    const { deps } = makeDeps([{ body: START }, { body: { status: "expired" } }]);
    expect(await runLogin(false, deps)).toBe(1);
  });

  it("times out at the deadline while pending", async () => {
    const { deps } = makeDeps([{ body: START }, { body: { status: "pending" } }]);
    expect(await runLogin(false, deps)).toBe(1);
  });

  it("claude missing: prints the key and manual instructions, exits non-zero", async () => {
    const { deps, calls } = makeDeps(
      [{ body: START }, { body: { status: "approved", api_key: "tkr_rescue" } }],
      { runCommand: async () => ({ code: null, error: "spawn claude ENOENT" }) },
    );
    const code = await runLogin(false, deps);
    expect(code).toBe(1);
    expect(calls.log.join("\n")).toContain("tkr_rescue");
    expect(calls.log.join("\n")).toContain("mcpServers");
  });

  it("start failure reports unreachable", async () => {
    const { deps } = makeDeps([{ status: 429, body: { error: "rate_limited" } }]);
    expect(await runLogin(false, deps)).toBe(1);
  });
});
