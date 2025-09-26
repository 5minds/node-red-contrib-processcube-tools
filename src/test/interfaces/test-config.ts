export interface TestConfig {
    id: string;
    type: string;
    name?: string;
    host: string;
    port: number;
    user: string;
    password: string;
    folder: string | string[];
    tls?: boolean;
    markseen?: boolean;
}