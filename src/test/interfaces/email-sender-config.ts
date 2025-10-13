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
    smtpConfig: string; // Reference to smtp-config node
    wires?: string[][];
    // Test-specific properties
    shouldFail?: boolean;
    rejectedEmails?: string[];
    pendingEmails?: string[];
    acceptedEmails?: string[];
}
