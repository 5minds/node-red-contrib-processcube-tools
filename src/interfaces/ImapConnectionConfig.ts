export interface ImapConnectionConfig {
    host: string;
    port: number;
    tls: boolean;
    user: string;
    password: string;
    folders: string[];
    markSeen: boolean;
    connTimeout: number;
    authTimeout: number;
    keepalive: boolean;
    autotls: string;
    tlsOptions: { rejectUnauthorized: boolean };
}
