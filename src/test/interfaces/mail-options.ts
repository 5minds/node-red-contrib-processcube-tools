export interface MailOptions {
    to: string | string[];
    from?: string;
    subject?: string;
    html?: string;
    text?: string;
    attachments?: any[];
    [key: string]: any;
}

export interface MockNodemailerOptions {
    onSendMail?: (mailOptions: MailOptions) => void;
    shouldFail?: boolean;
    shouldFailVerify?: boolean;
    rejectedEmails?: string[];
    pendingEmails?: string[];
    acceptedEmails?: string[];
}