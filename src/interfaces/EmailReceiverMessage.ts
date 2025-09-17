import type { ParsedMail } from 'mailparser';

// Custom type for the output message
export interface EmailReceiverMessage {
    topic: string | undefined;
    payload: string | undefined;
    html: string | boolean | undefined;
    from: string | undefined;
    date: Date | undefined;
    folder: string;
    header: ParsedMail['headers'];
    attachments: Array<{
        contentType: string;
        fileName: string | undefined;
        contentDisposition: string;
        generatedFileName: string | undefined;
        contentId: string | undefined;
        checksum: string;
        length: number;
        content: Buffer;
    }>;
}
