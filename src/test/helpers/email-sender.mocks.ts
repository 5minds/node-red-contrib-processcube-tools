/**
 * Email Sender Node - Test Mocks and Configuration
 * Streamlined for use with the testing framework
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPE DEFINITIONS - Simplified and focused
// ============================================================================

export interface EmailSenderConfig {
    id: string;
    type: string;
    name?: string;
    sender?: string;
    address?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    htmlContent?: string;
    attachments?: string;
    attachmentsType?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean;
    rejectUnauthorized?: boolean;
    wires?: string[][];
    // Test-specific properties
    shouldFail?: boolean;
    rejectedEmails?: string[];
    pendingEmails?: string[];
    acceptedEmails?: string[];
}

export interface MailOptions {
    to: string | string[];
    from?: string;
    subject?: string;
    html?: string;
    text?: string;
    attachments?: any[];
    [key: string]: any;
}

export interface SendMailResult {
    messageId: string;
    response: string;
    accepted: string[];
    rejected: string[];
    pending: string[];
}

// ============================================================================
// MOCK NODEMAILER - Simplified and more realistic
// ============================================================================

export interface MockNodemailerOptions {
    shouldFail?: boolean;
    rejectedEmails?: string[];
    pendingEmails?: string[];
    acceptedEmails?: string[];
    onSendMail?: (mailOptions: MailOptions) => void;
}

class MockTransporter {
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
        createTransport: (config?: any) => new MockTransporter(options),
        restore: () => {
            // Cleanup method for compatibility
        }
    };
}

// ============================================================================
// MODULE MOCKING SETUP - Streamlined
// ============================================================================

export function setupModuleMocks(): () => void {
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function(id: string) {
        if (id === 'nodemailer') {
            return createMockNodemailer();
        }
        return originalRequire.apply(this, arguments);
    };

    return function cleanup(): void {
        Module.prototype.require = originalRequire;
    };
}

// ============================================================================
// TEST CONFIGURATIONS - Focused and clear
// ============================================================================

export const emailSenderConfigs = {
    valid: {
        id: 'test-sender-1',
        type: 'email-sender',
        name: 'Test Email Sender',
        sender: 'Test Sender',
        address: 'test.sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        htmlContent: '<b>Test Content</b>',
        attachments: '',
        attachmentsType: 'str',
        host: 'smtp.example.com',
        port: 587,
        user: 'testuser',
        password: 'testpass',
        secure: false,
        rejectUnauthorized: true
    } as EmailSenderConfig,

    minimal: {
        id: 'test-sender-minimal',
        type: 'email-sender',
        to: 'recipient@example.com',
        subject: 'Minimal Subject',
        htmlContent: 'Minimal content',
        host: 'smtp.minimal.com',
        port: 587,
        user: 'minimal-user',
        password: 'minimal-pass'
    } as EmailSenderConfig,

    invalid: {
        id: 'test-sender-invalid',
        type: 'email-sender',
        name: 'Invalid Sender',
        sender: '', // Missing sender
        to: 'recipient@example.com',
        subject: 'Invalid Test',
        host: '', // Missing host
        port: 587,
        user: 'user',
        password: '' // Missing password
    } as EmailSenderConfig,

    withAttachments: {
        id: 'test-sender-attachments',
        type: 'email-sender',
        name: 'Sender With Attachments',
        to: 'recipient@example.com',
        subject: 'Attachment Test',
        htmlContent: 'Email with attachments',
        attachments: JSON.stringify([
            { filename: 'test.txt', content: 'Test attachment' }
        ]),
        attachmentsType: 'json',
        host: 'smtp.example.com',
        port: 587,
        user: 'testuser',
        password: 'testpass'
    } as EmailSenderConfig,

    errorScenarios: {
        networkError: {
            id: 'test-sender-network-error',
            type: 'email-sender',
            name: 'Network Error Scenario',
            host: 'unreachable.invalid.host.com',
            shouldFail: true
        } as EmailSenderConfig,

        rejectedEmail: {
            id: 'test-sender-rejected',
            type: 'email-sender',
            name: 'Rejected Email Scenario',
            rejectedEmails: ['recipient@example.com']
        } as EmailSenderConfig,

        pendingEmail: {
            id: 'test-sender-pending',
            type: 'email-sender',
            name: 'Pending Email Scenario',
            pendingEmails: ['recipient@example.com']
        } as EmailSenderConfig
    }
};

// Fill in the error scenarios with base config after definition
const baseConfig = emailSenderConfigs.valid;
emailSenderConfigs.errorScenarios.networkError = {
    ...baseConfig,
    ...emailSenderConfigs.errorScenarios.networkError
};

emailSenderConfigs.errorScenarios.rejectedEmail = {
    ...baseConfig,
    ...emailSenderConfigs.errorScenarios.rejectedEmail
};

emailSenderConfigs.errorScenarios.pendingEmail = {
    ...baseConfig,
    ...emailSenderConfigs.errorScenarios.pendingEmail
};

// ============================================================================
// TEST FLOWS - Simplified for integration tests
// ============================================================================

export const testFlows = {
    single: [emailSenderConfigs.valid],

    connected: [
        { ...emailSenderConfigs.valid, wires: [['h1']] },
        { id: 'h1', type: 'helper' }
    ],

    multiOutput: [
        { ...emailSenderConfigs.valid, wires: [['h1', 'h2']] },
        { id: 'h1', type: 'helper' },
        { id: 'h2', type: 'helper' }
    ]
};

// ============================================================================
// UTILITIES - Simplified to work with framework
// ============================================================================

export const testUtils = {
    wait: (ms: number = 100): Promise<void> =>
        new Promise(resolve => setTimeout(resolve, ms)),

    createEmailMessage: (overrides: Partial<any> = {}) => ({
        payload: 'Test email content',
        topic: 'Test Subject',
        to: 'test@example.com',
        from: 'sender@example.com',
        _msgid: 'test-msg-id',
        ...overrides
    }),

    createAttachment: (filename: string, content: string) => ({
        filename,
        content,
        encoding: 'utf8'
    }),

    createLargeEmail: (sizeKb: number = 100) => ({
        payload: 'x'.repeat(sizeKb * 1024),
        topic: 'Large Email Test',
        to: 'large@example.com'
    }),

    validateEmailFormat: (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};