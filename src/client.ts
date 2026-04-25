const BASE_URL = "https://www.clawtex.io/api";

export class ClawtexClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(
    path: string,
    options: { method?: string; body?: unknown; params?: Record<string, string> } = {}
  ): Promise<{ data: unknown; status: number; headers: Headers }> {
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
  async bootstrap(): Promise<string> {
    const { data, status } = await this.request("/bootstrap");
    if (status !== 200) throw new Error(`Bootstrap failed: ${JSON.stringify(data)}`);
    return typeof data === "string" ? data : JSON.stringify(data, null, 2);
  }

  // State
  async getState(type?: string): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    const { data, status } = await this.request("/state", { params });
    if (status !== 200) throw new Error(`Get state failed: ${JSON.stringify(data)}`);
    return data as unknown[];
  }

  async updateState(id: string, type: string, entityData: Record<string, unknown>): Promise<unknown> {
    const { data, status } = await this.request("/state", {
      method: "POST",
      body: { id, type, ...entityData },
    });
    if (status !== 201 && status !== 200) throw new Error(`Update state failed: ${JSON.stringify(data)}`);
    return data;
  }

  // Events
  async getEvents(options?: {
    days?: number;
    entity?: string;
    type?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (options?.days) params.days = String(options.days);
    if (options?.entity) params.entity = options.entity;
    if (options?.type) params.type = options.type;
    if (options?.limit) params.limit = String(options.limit);
    const { data, status } = await this.request("/events", { params });
    if (status !== 200) throw new Error(`Get events failed: ${JSON.stringify(data)}`);
    return data as unknown[];
  }

  async logEvent(event: {
    type: string;
    summary: string;
    entity?: string;
    outcome?: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    const { data, status } = await this.request("/events", {
      method: "POST",
      body: event,
    });
    if (status !== 201 && status !== 200) throw new Error(`Log event failed: ${JSON.stringify(data)}`);
    return data;
  }

  // Lessons
  async getLessons(): Promise<string> {
    const { data, status } = await this.request("/lessons/inject");
    if (status !== 200) throw new Error(`Get lessons failed: ${JSON.stringify(data)}`);
    const result = data as { injectionBlock?: string };
    return result.injectionBlock || "No active lessons.";
  }

  async extractLessons(): Promise<unknown> {
    const { data, status } = await this.request("/lessons/extract", { method: "POST" });
    if (status === 403) return { error: "Lesson extraction requires Pro tier." };
    if (status !== 200) throw new Error(`Extract lessons failed: ${JSON.stringify(data)}`);
    return data;
  }

  async approveLesson(lessonId: string): Promise<unknown> {
    const { data, status } = await this.request(`/lessons/${lessonId}/approve`, { method: "POST" });
    if (status !== 200) throw new Error(`Approve lesson failed: ${JSON.stringify(data)}`);
    return data;
  }

  async rejectLesson(lessonId: string): Promise<unknown> {
    const { data, status } = await this.request(`/lessons/${lessonId}/reject`, { method: "POST" });
    if (status !== 200) throw new Error(`Reject lesson failed: ${JSON.stringify(data)}`);
    return data;
  }

  async createLesson(lesson: {
    context: string;
    mistake: string;
    correct: string;
    enforcement?: string;
  }): Promise<unknown> {
    const { data, status } = await this.request("/lessons", {
      method: "POST",
      body: {
        context: lesson.context,
        mistake: lesson.mistake,
        correct: lesson.correct,
        title: lesson.context,
      },
    });
    if (status !== 201 && status !== 200) throw new Error(`Create lesson failed: ${JSON.stringify(data)}`);
    return data;
  }

  async signalLesson(lessonId: string, relevant: boolean, followed: boolean): Promise<unknown> {
    const { data, status } = await this.request(`/lessons/${lessonId}/signal`, {
      method: "POST",
      body: { relevant, followed },
    });
    if (status !== 200) throw new Error(`Signal lesson failed: ${JSON.stringify(data)}`);
    return data;
  }

  // Sessions
  async startSession(metadata?: Record<string, unknown>): Promise<unknown> {
    const { data, status } = await this.request("/sessions", {
      method: "POST",
      body: metadata ? { metadata } : {},
    });
    if (status !== 201 && status !== 200) throw new Error(`Start session failed: ${JSON.stringify(data)}`);
    return data;
  }

  async endSession(sessionId: string, summary?: string): Promise<unknown> {
    const { data, status } = await this.request(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: { summary },
    });
    if (status !== 200) throw new Error(`End session failed: ${JSON.stringify(data)}`);
    return data;
  }

  async getSessions(limit?: number): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (limit) params.limit = String(limit);
    const { data, status } = await this.request("/sessions", { params });
    if (status !== 200) throw new Error(`Get sessions failed: ${JSON.stringify(data)}`);
    return data as unknown[];
  }

  // Search
  async search(query: string, limit?: number): Promise<unknown> {
    const { data, status } = await this.request("/search", {
      method: "POST",
      body: { query, limit },
    });
    if (status !== 200) throw new Error(`Search failed: ${JSON.stringify(data)}`);
    return data;
  }
}
