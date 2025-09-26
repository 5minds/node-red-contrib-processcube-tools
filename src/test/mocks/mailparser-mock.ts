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


export const MockMailParser = {
    /**
     * Parses an email source (string or buffer) and returns a ParsedEmail object.
     * It's a mock implementation that provides a predictable output for testing.
     * @param source The email content as a buffer or string.
     * @param options Optional overrides for the parsed email properties.
     * @returns A Promise resolving to a ParsedEmail object.
     */
    simpleParser: async (source: any, options: Partial<EmailData> = {}): Promise<ParsedEmail> => {
        // Parse basic email structure from source if it's a buffer/string
        let parsedData: Partial<EmailData> = {};

        if (Buffer.isBuffer(source) || typeof source === 'string') {
            const content = source.toString();
            parsedData = parseEmailContent(content);
        }

        return {
            subject: options.subject || parsedData.subject || 'Mock Email Subject',
            text: options.text || parsedData.text || 'Mock email content',
            html: options.html || parsedData.html || '<p>Mock email content</p>',
            from: {
                text: options.from || parsedData.from || 'sender@test.com',
                value: [{ address: options.from || parsedData.from || 'sender@test.com' }]
            },
            to: {
                text: options.to || parsedData.to || 'recipient@test.com',
                value: [{ address: options.to || parsedData.to || 'recipient@test.com' }]
            },
            date: options.date || parsedData.date || new Date(),
            messageId: options.messageId || parsedData.messageId || '<mock@test.com>',
            headers: new Map([
                ['message-id', options.messageId || '<mock@test.com>'],
                ['subject', options.subject || 'Mock Email Subject'],
                ['from', options.from || 'sender@test.com']
            ]),
            attachments: options.attachments || []
        };
    }
};

/**
 * Helper to parse basic email content.
 * This function remains the same as it's a private utility for the mock parser.
 */
function parseEmailContent(content: string): Partial<EmailData> {
    const lines = content.split('\r\n');
    const result: Partial<EmailData> = {};
    let bodyStart = false;
    let bodyLines: string[] = [];

    for (const line of lines) {
        if (!bodyStart) {
            if (line === '') {
                bodyStart = true;
                continue;
            }

            if (line.startsWith('Subject: ')) {
                result.subject = line.substring(9);
            } else if (line.startsWith('From: ')) {
                result.from = line.substring(6);
            } else if (line.startsWith('To: ')) {
                result.to = line.substring(4);
            } else if (line.startsWith('Message-ID: ')) {
                result.messageId = line.substring(12);
            }
        } else {
            bodyLines.push(line);
        }
    }

    if (bodyLines.length > 0) {
        result.text = bodyLines.join('\n');
    }

    return result;
}
