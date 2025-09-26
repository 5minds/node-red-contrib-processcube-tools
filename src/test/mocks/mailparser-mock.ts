import { EmailData } from "../interfaces/email-data";
import { ParsedEmail } from "../interfaces/parsed-email";

export function createMockMailparser() {
    const mockParser = {
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

    // Return a function that returns the parser object
    return () => mockParser;
}

// Helper to parse basic email content
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