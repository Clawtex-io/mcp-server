const BASE_URL = "https://www.clawtex.io/api";
export class ClawtexClient {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async request(path, options = {}) {
        const url = new URL(`${BASE_URL}${path}`);
        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, value);
                }
            }
        }
        const res = await fetch(url.toString(), {
            method: options.method || "GET",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        });
        const contentType = res.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await res.json()
            : await res.text();
        return { data, status: res.status, headers: res.headers };
    }
    // Bootstrap - full context dump
    async bootstrap() {
        const { data, status } = await this.request("/bootstrap");
        if (status !== 200)
            throw new Error(`Bootstrap failed: ${JSON.stringify(data)}`);
        return typeof data === "string" ? data : JSON.stringify(data, null, 2);
    }
    // State
    async getState(type) {
        const params = {};
        if (type)
            params.type = type;
        const { data, status } = await this.request("/state", { params });
        if (status !== 200)
            throw new Error(`Get state failed: ${JSON.stringify(data)}`);
        return data;
    }
    async updateState(id, type, entityData) {
        const { data, status } = await this.request("/state", {
            method: "POST",
            body: { id, type, ...entityData },
        });
        if (status !== 201 && status !== 200)
            throw new Error(`Update state failed: ${JSON.stringify(data)}`);
        return data;
    }
    async deleteState(id) {
        const { data, status } = await this.request(`/state/_/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (status !== 204 && status !== 200)
            throw new Error(`Delete state failed: ${JSON.stringify(data)}`);
        return { deleted: id };
    }
    async deleteEvent(eventId) {
        const { data, status } = await this.request(`/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
        if (status !== 200 && status !== 204)
            throw new Error(`Delete event failed: ${JSON.stringify(data)}`);
        return { deleted: eventId };
    }
    // Events
    async getEvents(options) {
        const params = {};
        if (options?.days)
            params.days = String(options.days);
        if (options?.entity)
            params.entity = options.entity;
        if (options?.type)
            params.type = options.type;
        if (options?.limit)
            params.limit = String(options.limit);
        const { data, status } = await this.request("/events", { params });
        if (status !== 200)
            throw new Error(`Get events failed: ${JSON.stringify(data)}`);
        return data;
    }
    async logEvent(event) {
        const { data, status } = await this.request("/events", {
            method: "POST",
            body: event,
        });
        if (status !== 201 && status !== 200)
            throw new Error(`Log event failed: ${JSON.stringify(data)}`);
        return data;
    }
    // Lessons
    async getLessons() {
        const { data, status } = await this.request("/lessons/inject");
        if (status !== 200)
            throw new Error(`Get lessons failed: ${JSON.stringify(data)}`);
        const result = data;
        return result.injectionBlock || "No active lessons.";
    }
    async extractLessons() {
        const { data, status } = await this.request("/lessons/extract", { method: "POST" });
        if (status === 403)
            return { error: "Lesson extraction requires Pro tier." };
        if (status !== 200)
            throw new Error(`Extract lessons failed: ${JSON.stringify(data)}`);
        return data;
    }
    async approveLesson(lessonId) {
        const { data, status } = await this.request(`/lessons/${lessonId}/approve`, { method: "POST" });
        if (status !== 200)
            throw new Error(`Approve lesson failed: ${JSON.stringify(data)}`);
        return data;
    }
    async rejectLesson(lessonId) {
        const { data, status } = await this.request(`/lessons/${lessonId}/reject`, { method: "POST" });
        if (status !== 200)
            throw new Error(`Reject lesson failed: ${JSON.stringify(data)}`);
        return data;
    }
    async createLesson(lesson) {
        const { data, status } = await this.request("/lessons", {
            method: "POST",
            body: {
                context: lesson.context,
                mistake: lesson.mistake,
                correct: lesson.correct,
                title: lesson.context,
            },
        });
        if (status !== 201 && status !== 200)
            throw new Error(`Create lesson failed: ${JSON.stringify(data)}`);
        return data;
    }
    async signalLesson(lessonId, relevant, followed) {
        const { data, status } = await this.request(`/lessons/${lessonId}/signal`, {
            method: "POST",
            body: { relevant, followed },
        });
        if (status !== 200)
            throw new Error(`Signal lesson failed: ${JSON.stringify(data)}`);
        return data;
    }
    // Sessions
    async startSession(metadata) {
        const { data, status } = await this.request("/sessions", {
            method: "POST",
            body: metadata ? { metadata } : {},
        });
        if (status !== 201 && status !== 200)
            throw new Error(`Start session failed: ${JSON.stringify(data)}`);
        return data;
    }
    async endSession(sessionId, summary) {
        const { data, status } = await this.request(`/sessions/${sessionId}`, {
            method: "PATCH",
            body: { summary },
        });
        if (status !== 200)
            throw new Error(`End session failed: ${JSON.stringify(data)}`);
        return data;
    }
    async getSessions(limit) {
        const params = {};
        if (limit)
            params.limit = String(limit);
        const { data, status } = await this.request("/sessions", { params });
        if (status !== 200)
            throw new Error(`Get sessions failed: ${JSON.stringify(data)}`);
        return data;
    }
    // Search
    async search(query, limit) {
        const { data, status } = await this.request("/search", {
            method: "POST",
            body: { query, limit },
        });
        if (status !== 200)
            throw new Error(`Search failed: ${JSON.stringify(data)}`);
        return data;
    }
}
