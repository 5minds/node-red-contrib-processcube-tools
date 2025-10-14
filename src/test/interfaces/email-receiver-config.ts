export interface EmailReceiverConfig {
    id: string;
    type: string;
    name?: string;
    imapConfig: string; // Reference to imap-config node
    folder: string | string[];
    folderType?: string;
    markseen?: boolean;
    markseenType?: string;
}

// Legacy interface for backwards compatibility with old test configs
export interface LegacyEmailReceiverConfig {
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
