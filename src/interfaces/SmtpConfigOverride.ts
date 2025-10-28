/**
 * Interface for SMTP configuration override via msg.smtpConfig
 * This allows runtime override of SMTP settings instead of using the smtp-config node
 */
export interface SmtpConfigOverride {
    // Required fields
    host: string;
    port: number;
    user: string;
    password: string;

    // Optional fields (defaults will be applied if not provided)
    secure?: boolean;              // default: false
    rejectUnauthorized?: boolean;  // default: false
    connTimeout?: number;          // default: 10000
    authTimeout?: number;          // default: 5000
    keepalive?: boolean;           // default: true
    autotls?: string;              // default: 'never'
}

/**
 * Normalized SMTP configuration with all fields present
 */
export interface NormalizedSmtpConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
    rejectUnauthorized: boolean;
    connTimeout: number;
    authTimeout: number;
    keepalive: boolean;
    autotls: string;
}
