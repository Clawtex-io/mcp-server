#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { ClawtexClient } from "./client.js";
const apiKey = process.env.CLAWTEX_API_KEY;
if (!apiKey) {
    console.error("CLAWTEX_API_KEY environment variable is required");
    process.exit(1);
}
const client = new ClawtexClient(apiKey);
const server = new Server({ name: "clawtex", version: "0.1.0" }, { capabilities: { tools: {}, resources: {} } });
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
// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "clawtex_bootstrap",
            description: "Load full agent context from Clawtex - state, lessons, recent events, and rules. Call this at the start of a session to get full context.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "clawtex_get_state",
            description: "Read state entities from Clawtex. Returns structured data about clients, projects, repos, and other tracked entities.",
            inputSchema: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        description: "Filter by entity type (e.g. 'clients', 'projects', 'repos'). Omit to get all.",
                    },
                },
            },
        },
        {
            name: "clawtex_update_state",
            description: "Create or update a state entity in Clawtex. Use this when a project status changes, a new client appears, or any tracked entity needs updating.",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "Entity ID, lowercase hyphenated (e.g. 'acme-corp', 'website-rebuild')",
                    },
                    type: {
                        type: "string",
                        description: "Entity type, plural lowercase (e.g. 'clients', 'projects', 'repos')",
                    },
                    data: {
                        type: "object",
                        description: "Entity data object. Include name/title, status, and any relevant fields.",
                    },
                },
                required: ["id", "type", "data"],
            },
        },
        {
            name: "clawtex_log_event",
            description: "Log a significant event to Clawtex. Use this after completing tasks, making decisions, hitting milestones, or encountering blockers. Log events as they happen, not at session end.",
            inputSchema: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        enum: [
                            "decision",
                            "milestone",
                            "blocker",
                            "task",
                            "note",
                            "deploy",
                            "build",
                            "contact",
                        ],
                        description: "Event type",
                    },
                    summary: {
                        type: "string",
                        description: "One sentence summary of what happened",
                    },
                    entity: {
                        type: "string",
                        description: "Related entity reference in type/id format (e.g. 'project/website-rebuild')",
                    },
                    outcome: {
                        type: "string",
                        description: "Outcome or result of the event",
                    },
                },
                required: ["type", "summary"],
            },
        },
        {
            name: "clawtex_get_events",
            description: "Query event history from Clawtex. See what happened in recent sessions.",
            inputSchema: {
                type: "object",
                properties: {
                    days: {
                        type: "number",
                        description: "Number of days to look back (default 7)",
                    },
                    entity: {
                        type: "string",
                        description: "Filter by entity reference",
                    },
                    type: {
                        type: "string",
                        description: "Filter by event type",
                    },
                    limit: {
                        type: "number",
                        description: "Max events to return (default 50, max 200)",
                    },
                },
            },
        },
        {
            name: "clawtex_get_lessons",
            description: "Get active lessons from Clawtex. These are patterns extracted from event history - corrections and guardrails that should be followed.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "clawtex_extract_lessons",
            description: "Trigger AI lesson extraction from recent events. Analyses event history and proposes new lessons based on patterns. Pro/Team tier only.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "clawtex_approve_lesson",
            description: "Approve a pending lesson so it becomes active and gets injected in future sessions.",
            inputSchema: {
                type: "object",
                properties: {
                    lesson_id: {
                        type: "string",
                        description: "The lesson ID to approve (e.g. 'LSN-abc123')",
                    },
                },
                required: ["lesson_id"],
            },
        },
        {
            name: "clawtex_reject_lesson",
            description: "Reject a pending lesson so it is not used.",
            inputSchema: {
                type: "object",
                properties: {
                    lesson_id: {
                        type: "string",
                        description: "The lesson ID to reject",
                    },
                },
                required: ["lesson_id"],
            },
        },
        {
            name: "clawtex_create_lesson",
            description: "Manually create a lesson. Use this when you or the user identifies a pattern that should be corrected in future sessions.",
            inputSchema: {
                type: "object",
                properties: {
                    context: {
                        type: "string",
                        description: "When this lesson applies (e.g. 'When deploying code changes')",
                    },
                    mistake: {
                        type: "string",
                        description: "What went wrong and why it matters",
                    },
                    correct: {
                        type: "string",
                        description: "Numbered steps to follow instead (e.g. '1. Do X\\n2. Do Y\\n3. Do Z')",
                    },
                },
                required: ["context", "mistake", "correct"],
            },
        },
        {
            name: "clawtex_signal_lesson",
            description: "Signal whether a lesson was relevant and followed in the current session. Tracks lesson effectiveness over time.",
            inputSchema: {
                type: "object",
                properties: {
                    lesson_id: {
                        type: "string",
                        description: "The lesson ID",
                    },
                    relevant: {
                        type: "boolean",
                        description: "Whether the lesson was relevant to the current task",
                    },
                    followed: {
                        type: "boolean",
                        description: "Whether the lesson's correction steps were followed",
                    },
                },
                required: ["lesson_id", "relevant", "followed"],
            },
        },
        {
            name: "clawtex_start_session",
            description: "Start a new tracked session. Call this at the beginning of a work session to group events together.",
            inputSchema: {
                type: "object",
                properties: {
                    metadata: {
                        type: "object",
                        description: "Optional session metadata (e.g. project focus, goals)",
                    },
                },
            },
        },
        {
            name: "clawtex_end_session",
            description: "End a tracked session with a summary. Call this at the end of a work session.",
            inputSchema: {
                type: "object",
                properties: {
                    session_id: {
                        type: "string",
                        description: "The session ID to end",
                    },
                    summary: {
                        type: "string",
                        description: "Brief summary of what was accomplished in this session",
                    },
                },
                required: ["session_id"],
            },
        },
        {
            name: "clawtex_get_sessions",
            description: "Get recent sessions. See what happened in previous work sessions.",
            inputSchema: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "Number of sessions to return (default 10, max 50)",
                    },
                },
            },
        },
        {
            name: "clawtex_search",
            description: "Search across all Clawtex memory - events, state, and lessons. Use natural language queries like 'when did we discuss pricing' or 'deployment issues'.",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Search query - keywords or natural language",
                    },
                    limit: {
                        type: "number",
                        description: "Max results per category (default 20)",
                    },
                },
                required: ["query"],
            },
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
