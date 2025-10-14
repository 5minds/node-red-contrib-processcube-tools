export interface SendMailResult {
    messageId: string;
    response: string;
    accepted: string[];
    rejected: string[];
    pending: string[];
}
