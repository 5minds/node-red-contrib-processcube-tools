/**
 * Interface for IMAP configuration override via msg.imapConfig
 * This allows runtime override of IMAP settings instead of using the imap-config node
 */
export interface ImapConfigOverride {
    // Required fields
    host: string;
    port: number;
    user: string;
    password: string;

    // Optional fields (defaults will be applied if not provided)
    tls?: boolean;                 // default: true
    connTimeout?: number;          // default: 10000
    authTimeout?: number;          // default: 5000
    keepalive?: boolean;           // default: true
    autotls?: string;              // default: 'never'
    rejectUnauthorized?: boolean;  // default: false
}

/**
 * Normalized IMAP configuration with all fields present
 */
export interface NormalizedImapConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    tls: boolean;
    connTimeout: number;
    authTimeout: number;
    keepalive: boolean;
    autotls: string;
    rejectUnauthorized: boolean;
}
