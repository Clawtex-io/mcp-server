export type LoginDeps = {
    fetchFn: typeof fetch;
    openBrowser: (url: string) => void;
    runCommand: (cmd: string, args: string[]) => Promise<{
        code: number | null;
        error?: string;
    }>;
    log: (line: string) => void;
    out: (line: string) => void;
    sleep: (ms: number) => Promise<void>;
    now: () => number;
};
export declare function defaultDeps(): LoginDeps;
export declare function runLogin(json: boolean, deps: LoginDeps): Promise<number>;
