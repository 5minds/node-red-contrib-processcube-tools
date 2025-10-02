export interface ImapConfig {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    password: string;
    authTimeout?: number;
    connTimeout?: number;
}
