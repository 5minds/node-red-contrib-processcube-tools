export interface ParsedEmail {
    subject?: string;
    text?: string;
    html?: string;
    from?: { text: string; value: Array<{ address: string; name?: string }> };
    to?: { text: string; value: Array<{ address: string; name?: string }> };
    date?: Date;
    messageId?: string;
    headers: Map<string, string>;
    attachments?: any[];
}