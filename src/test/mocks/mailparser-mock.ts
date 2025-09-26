import { EmailData } from "../interfaces/email-data";

export function createMockMailparser() {
    return function mockMailParser(stream: NodeJS.ReadableStream, callback: (err: Error | null, parsed?: any) => void) {
        // Read the stream data
        let emailData = '';

        stream.on('data', (chunk) => {
            emailData += chunk.toString();
        });

        stream.on('end', () => {
            // Parse the email content using your existing helper
            const parsedData = parseEmailContent(emailData);
            const parsedMail = {
                subject: parsedData.subject || 'Mock Email Subject',
                text: parsedData.text || 'Mock email content',
                html: parsedData.html || '<p>Mock email content</p>',
                from: {
                    text: parsedData.from || 'sender@test.com',
                    value: [{ address: parsedData.from || parsedData.from || 'sender@test.com' }]
                },
                replyTo: {
                    text: parsedData.from || 'sender@test.com',
                    value: [{ address: parsedData.to || parsedData.to || 'recipient@test.com' }]
                },
                date: parsedData.date || new Date(),
                messageId: parsedData.messageId || '<mock@test.com>',
                headers: new Map([
                    ['message-id', parsedData.messageId || '<mock@test.com>'],
                    ['subject', parsedData.subject || 'Mock Email Subject'],
                    ['from', parsedData.from || 'sender@test.com']
                ]),
                attachments: parsedData.attachments || []
            };

            // Call the callback asynchronously to simulate real parsing
            setTimeout(() => {
                callback(null, parsedMail);
            }, 5);
        });

        stream.on('error', (err) => {
            callback(err);
        });
    };
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