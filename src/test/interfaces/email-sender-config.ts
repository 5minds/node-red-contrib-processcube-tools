export interface EmailSenderConfig {
    id: string;
    type: string;
    name?: string;
    sender?: string;
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    htmlContent?: string;
    attachments?: string;
    attachmentsType?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean;
    rejectUnauthorized?: boolean;
    wires?: string[][];
    // Test-specific properties
    shouldFail?: boolean;
    rejectedEmails?: string[];
    pendingEmails?: string[];
    acceptedEmails?: string[];
}
