export declare class ClawtexClient {
    private apiKey;
    constructor(apiKey: string);
    private request;
    bootstrap(): Promise<string>;
    getState(type?: string): Promise<unknown[]>;
    updateState(id: string, type: string, entityData: Record<string, unknown>): Promise<unknown>;
    getEvents(options?: {
        days?: number;
        entity?: string;
        type?: string;
        limit?: number;
    }): Promise<unknown[]>;
    logEvent(event: {
        type: string;
        summary: string;
        entity?: string;
        outcome?: string;
        metadata?: Record<string, unknown>;
    }): Promise<unknown>;
    getLessons(): Promise<string>;
    extractLessons(): Promise<unknown>;
    approveLesson(lessonId: string): Promise<unknown>;
    rejectLesson(lessonId: string): Promise<unknown>;
    createLesson(lesson: {
        context: string;
        mistake: string;
        correct: string;
        enforcement?: string;
    }): Promise<unknown>;
    signalLesson(lessonId: string, relevant: boolean, followed: boolean): Promise<unknown>;
    startSession(metadata?: Record<string, unknown>): Promise<unknown>;
    endSession(sessionId: string, summary?: string): Promise<unknown>;
    getSessions(limit?: number): Promise<unknown[]>;
    search(query: string, limit?: number): Promise<unknown>;
}
