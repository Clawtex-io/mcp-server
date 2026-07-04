#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { ClawtexClient } from "./client.js";
if (process.argv[2] === "login") {
    const { runLogin, defaultDeps } = await import("./login.js");
    process.exit(await runLogin(process.argv.includes("--json"), defaultDeps()));
}
const apiKey = process.env.CLAWTEX_API_KEY;
if (!apiKey) {
    console.error("\nCLAWTEX_API_KEY is required.\n");
    console.error("Easiest fix, run:  npx -y @clawtex/mcp-server login\n");
    console.error("Or manually:");
    console.error("1. Sign up at https://clawtex.io/signup");
    console.error("2. Create an agent and copy your API key");
    console.error("3. Add to your Claude config:\n");
    console.error(`   {
     "mcpServers": {
       "clawtex": {
         "command": "npx",
         "args": ["-y", "@clawtex/mcp-server"],
         "env": { "CLAWTEX_API_KEY": "tkr_your_key_here" }
       }
     }
   }\n`);
    console.error("Docs: https://clawtex.io/docs\n");
    process.exit(1);
}
const client = new ClawtexClient(apiKey);
const server = new Server({ name: "clawtex", version: "0.2.1" }, { capabilities: { tools: {}, resources: {} } });
// Resources - auto-loaded into context
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
        {
            uri: "clawtex://state",
            name: "Clawtex State",
            description: "Current state entities - clients, projects, goals, and other tracked data",
            mimeType: "application/json",
        },
        {
            uri: "clawtex://lessons",
            name: "Clawtex Lessons",
            description: "Active lessons - corrections and guardrails extracted from event history",
            mimeType: "text/plain",
        },
    ],
}));
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === "clawtex://state") {
        const state = await client.getState();
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(state, null, 2),
                },
            ],
        };
    }
    if (uri === "clawtex://lessons") {
        const lessons = await client.getLessons();
        return {
            contents: [
                {
                    uri,
                    mimeType: "text/plain",
                    text: lessons,
                },
            ],
        };
    }
    throw new Error(`Unknown resource: ${uri}`);
});
// Tool definitions -- synced with connector (src/lib/mcp/tools.ts in clawtex repo)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        // ── Read tools ──────────────────────────────────────────
        {
            name: "clawtex_bootstrap",
            description: "Returns full agent context from Clawtex: current state entities, active lessons, recent events, and operational rules. Provides a comprehensive snapshot of all tracked memory in one response.",
            inputSchema: { type: "object", properties: {} },
            annotations: { title: "Bootstrap Context", readOnlyHint: true },
        },
        {
            name: "clawtex_get_state",
            description: "Returns state entities from Clawtex. State entities are structured records tracking clients, projects, repos, goals, people, and other tracked items. Optionally filter by entity type.",
            inputSchema: {
                type: "object",
                properties: {
                    type: { type: "string", description: "Filter by entity type (e.g. 'clients', 'projects'). Omit to get all." },
                },
            },
            annotations: { title: "Get State", readOnlyHint: true },
        },
        {
            name: "clawtex_get_events",
            description: "Returns event history from Clawtex. Events are timestamped records of decisions, milestones, blockers, tasks, and other significant occurrences. Supports filtering by time range, entity, and event type.",
            inputSchema: {
                type: "object",
                properties: {
                    days: { type: "number", description: "Number of days to look back (default 7)" },
                    entity: { type: "string", description: "Filter by entity reference (e.g. 'project/my-app')" },
                    type: { type: "string", description: "Filter by event type (e.g. 'decision', 'milestone')" },
                    limit: { type: "number", description: "Max events to return (default 50, max 200)" },
                },
            },
            annotations: { title: "Get Events", readOnlyHint: true },
        },
        {
            name: "clawtex_get_lessons",
            description: "Returns active lessons from Clawtex. Lessons are patterns extracted from event history, each containing a context (when it applies), a correction (what to do differently), and an enforcement rule.",
            inputSchema: { type: "object", properties: {} },
            annotations: { title: "Get Lessons", readOnlyHint: true },
        },
        {
            name: "clawtex_get_sessions",
            description: "Returns recent tracked sessions from Clawtex. Each session groups related events together with start/end timestamps and a summary of what was accomplished.",
            inputSchema: {
                type: "object",
                properties: {
                    limit: { type: "number", description: "Number of sessions to return (default 10, max 50)" },
                },
            },
            annotations: { title: "Get Sessions", readOnlyHint: true },
        },
        {
            name: "clawtex_search",
            description: "Searches across all Clawtex memory: events, state entities, and lessons. Accepts natural language or keyword queries and returns matching results grouped by category.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query - keywords or natural language" },
                    limit: { type: "number", description: "Max results per category (default 20)" },
                },
                required: ["query"],
            },
            annotations: { title: "Search Memory", readOnlyHint: true },
        },
        // ── Write tools ─────────────────────────────────────────
        {
            name: "clawtex_update_state",
            description: "Creates or updates a state entity in Clawtex via upsert. If the entity ID already exists under the given type, it is updated; otherwise a new entity is created. State entities track structured data like project status, client details, and configuration.",
            inputSchema: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Entity ID, lowercase hyphenated (e.g. 'acme-corp')" },
                    type: { type: "string", description: "Entity type, plural lowercase (e.g. 'clients', 'projects')" },
                    data: { type: "object", description: "Entity data object. Include name/title, status, and any relevant fields." },
                },
                required: ["id", "type", "data"],
            },
            annotations: { title: "Update State", destructiveHint: true },
        },
        {
            name: "clawtex_log_event",
            description: "Logs a timestamped event to Clawtex. Events record decisions, milestones, blockers, tasks, deploys, and other significant occurrences. Each event has a type, a one-sentence summary, and an optional entity reference.",
            inputSchema: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        enum: ["decision", "milestone", "blocker", "task", "note", "deploy", "build", "contact"],
                        description: "Event type",
                    },
                    summary: { type: "string", description: "One sentence summary of what happened" },
                    entity: { type: "string", description: "Related entity reference in type/id format (e.g. 'project/website-rebuild')" },
                    outcome: { type: "string", description: "Outcome or result of the event" },
                },
                required: ["type", "summary"],
            },
            annotations: { title: "Log Event", destructiveHint: true },
        },
        {
            name: "clawtex_extract_lessons",
            description: "Triggers AI-powered lesson extraction from recent event history. Analyses patterns across events and proposes new lessons with context, correction steps, and enforcement rules. Proposed lessons require approval before becoming active. Pro and Team tiers only.",
            inputSchema: { type: "object", properties: {} },
            annotations: { title: "Extract Lessons", destructiveHint: true },
        },
        {
            name: "clawtex_create_lesson",
            description: "Creates a new lesson manually. A lesson consists of a context (when it applies), a description of the mistake or pattern to correct, and numbered correction steps. New lessons are created in pending status and require approval.",
            inputSchema: {
                type: "object",
                properties: {
                    context: { type: "string", description: "When this lesson applies (e.g. 'When deploying code changes')" },
                    mistake: { type: "string", description: "What went wrong and why it matters" },
                    correct: { type: "string", description: "Numbered steps to follow instead" },
                },
                required: ["context", "mistake", "correct"],
            },
            annotations: { title: "Create Lesson", destructiveHint: true },
        },
        {
            name: "clawtex_approve_lesson",
            description: "Approves a pending lesson, changing its status to active. Active lessons are included in bootstrap context and returned by get_lessons.",
            inputSchema: {
                type: "object",
                properties: {
                    lesson_id: { type: "string", description: "The lesson ID to approve (e.g. 'LSN-abc123')" },
                },
                required: ["lesson_id"],
            },
            annotations: { title: "Approve Lesson", destructiveHint: true },
        },
        {
            name: "clawtex_reject_lesson",
            description: "Rejects a pending lesson, marking it as dismissed. Rejected lessons are excluded from bootstrap context and get_lessons results.",
            inputSchema: {
                type: "object",
                properties: {
                    lesson_id: { type: "string", description: "The lesson ID to reject" },
                },
                required: ["lesson_id"],
            },
            annotations: { title: "Reject Lesson", destructiveHint: true },
        },
        {
            name: "clawtex_signal_lesson",
            description: "Records whether a lesson was relevant and followed during the current session. Signals are used to track lesson effectiveness over time, surfacing which lessons are consistently useful and which are stale.",
            inputSchema: {
                type: "object",
                properties: {
                    lesson_id: { type: "string", description: "The lesson ID" },
                    relevant: { type: "boolean", description: "Whether the lesson was relevant to the current task" },
                    followed: { type: "boolean", description: "Whether the lesson's correction steps were followed" },
                },
                required: ["lesson_id", "relevant", "followed"],
            },
            annotations: { title: "Signal Lesson", destructiveHint: true },
        },
        {
            name: "clawtex_start_session",
            description: "Creates a new tracked session. Sessions group related events together under a single ID with start/end timestamps and optional metadata about the session's focus.",
            inputSchema: {
                type: "object",
                properties: {
                    metadata: { type: "object", description: "Optional session metadata (e.g. project focus, goals)" },
                },
            },
            annotations: { title: "Start Session", destructiveHint: true },
        },
        {
            name: "clawtex_end_session",
            description: "Ends a tracked session by setting its end timestamp and recording a summary of what was accomplished. The session ID must reference an active (not yet ended) session.",
            inputSchema: {
                type: "object",
                properties: {
                    session_id: { type: "string", description: "The session ID to end" },
                    summary: { type: "string", description: "Brief summary of what was accomplished in this session" },
                },
                required: ["session_id"],
            },
            annotations: { title: "End Session", destructiveHint: true },
        },
        // ── Delete tools ────────────────────────────────────────
        {
            name: "clawtex_delete_state",
            description: "Deletes a state entity from Clawtex by its ID. The entity and all its data are permanently removed.",
            inputSchema: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Entity ID to delete (e.g. 'acme-corp')" },
                },
                required: ["id"],
            },
            annotations: { title: "Delete State Entity", destructiveHint: true },
        },
        {
            name: "clawtex_delete_event",
            description: "Deletes an event from Clawtex by its ID. The event record is permanently removed from the timeline.",
            inputSchema: {
                type: "object",
                properties: {
                    event_id: { type: "string", description: "The event ID to delete (e.g. 'EVT-20260505-123456-abc')" },
                },
                required: ["event_id"],
            },
            annotations: { title: "Delete Event", destructiveHint: true },
        },
    ],
}));
// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "clawtex_bootstrap": {
                const result = await client.bootstrap();
                return { content: [{ type: "text", text: result }] };
            }
            case "clawtex_get_state": {
                const typedArgs = args;
                const result = await client.getState(typedArgs.type);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_delete_state": {
                const typedArgs = args;
                const result = await client.deleteState(typedArgs.id);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_delete_event": {
                const typedArgs = args;
                const result = await client.deleteEvent(typedArgs.event_id);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_update_state": {
                const typedArgs = args;
                const result = await client.updateState(typedArgs.id, typedArgs.type, typedArgs.data);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_log_event": {
                const typedArgs = args;
                const result = await client.logEvent(typedArgs);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_get_events": {
                const typedArgs = args;
                const result = await client.getEvents(typedArgs);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_get_lessons": {
                const result = await client.getLessons();
                return { content: [{ type: "text", text: result }] };
            }
            case "clawtex_extract_lessons": {
                const result = await client.extractLessons();
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_approve_lesson": {
                const typedArgs = args;
                const result = await client.approveLesson(typedArgs.lesson_id);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_reject_lesson": {
                const typedArgs = args;
                const result = await client.rejectLesson(typedArgs.lesson_id);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_create_lesson": {
                const typedArgs = args;
                const result = await client.createLesson(typedArgs);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_signal_lesson": {
                const typedArgs = args;
                const result = await client.signalLesson(typedArgs.lesson_id, typedArgs.relevant, typedArgs.followed);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_start_session": {
                const typedArgs = args;
                const result = await client.startSession(typedArgs.metadata);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_end_session": {
                const typedArgs = args;
                const result = await client.endSession(typedArgs.session_id, typedArgs.summary);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_get_sessions": {
                const typedArgs = args;
                const result = await client.getSessions(typedArgs.limit);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "clawtex_search": {
                const typedArgs = args;
                const result = await client.search(typedArgs.query, typedArgs.limit);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
