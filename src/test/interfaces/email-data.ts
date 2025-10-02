export interface EmailData {
    subject?: string;
    from?: string;
    to?: string;
    text?: string;
    html?: string;
    date?: Date;
    messageId?: string;
    attachments?: any[];
}
