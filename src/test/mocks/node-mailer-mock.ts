import { MailOptions, MockNodemailerOptions } from "../interfaces/mail-options";
import { SendMailResult } from "../interfaces/send-mail-result";

class MockNodemailer {
    constructor(private options: MockNodemailerOptions = {}) {}

    sendMail(mailOptions: MailOptions, callback: (err: Error | null, result?: SendMailResult) => void): void {
        // Allow inspection of mail options
        if (this.options.onSendMail) {
            this.options.onSendMail(mailOptions);
        }

        // Simulate different failure scenarios
        if (this.options.shouldFail) {
            const error = new Error('Mock sendMail error') as Error & { code: string };
            error.code = 'ECONNREFUSED';
            return callback(error);
        }

        // Process recipient status
        const recipients = this.normalizeRecipients(mailOptions.to);
        const result = this.categorizeRecipients(recipients);

        // Simulate realistic delays
        setTimeout(() => {
            callback(null, {
                messageId: this.generateMessageId(),
                response: this.getResponseMessage(result),
                accepted: result.accepted,
                rejected: result.rejected,
                pending: result.pending
            });
        }, 10);
    }

    private normalizeRecipients(to: string | string[]): string[] {
        if (Array.isArray(to)) return to;
        if (typeof to === 'string') return to.split(',').map(email => email.trim());
        return [];
    }

    private categorizeRecipients(recipients: string[]): { accepted: string[]; rejected: string[]; pending: string[] } {
        const result = { accepted: [] as string[], rejected: [] as string[], pending: [] as string[] };

        recipients.forEach(email => {
            if (this.options.rejectedEmails?.includes(email)) {
                result.rejected.push(email);
            } else if (this.options.pendingEmails?.includes(email)) {
                result.pending.push(email);
            } else if (this.options.acceptedEmails?.length) {
                if (this.options.acceptedEmails.includes(email)) {
                    result.accepted.push(email);
                }
            } else {
                // Default: accept all emails not explicitly rejected or pending
                result.accepted.push(email);
            }
        });

        return result;
    }

    private getResponseMessage(result: { accepted: string[]; rejected: string[]; pending: string[] }): string {
        if (result.rejected.length > 0) return '550 Mailbox unavailable';
        if (result.pending.length > 0) return '451 Requested action aborted: local error';
        return '250 OK: Message accepted';
    }

    private generateMessageId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `<${timestamp}.${random}@test.com>`;
    }
}

export function createMockNodemailer(options: MockNodemailerOptions = {}) {
    return {
        createTransport: (config?: any) => new MockNodemailer(options),
        restore: () => {
            // Cleanup method for compatibility
        }
    };
}
