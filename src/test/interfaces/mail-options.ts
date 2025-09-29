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
    shouldFail?: boolean;
    rejectedEmails?: string[];
    pendingEmails?: string[];
    acceptedEmails?: string[];
    onSendMail?: (mailOptions: MailOptions) => void;
}