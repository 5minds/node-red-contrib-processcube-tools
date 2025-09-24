/**
 * Email Receiver Node - Test Mocks and Configuration
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPE DEFINITIONS - Simplified and focused
// ============================================================================

export interface TestConfig {
    id: string;
    type: string;
    name?: string;
    host: string;
    port: number;
    user: string;
    password: string;
    folder: string | string[];
    tls?: boolean;
    markseen?: boolean;
    // Remove redundant type fields - framework handles these
}

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

// ============================================================================
// MOCK IMAP - Simplified and more realistic
// ============================================================================

interface ImapConfig {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    password: string;
    authTimeout?: number;
    connTimeout?: number;
}

interface ImapMailbox {
    messages: { total: number };
    name: string;
    readOnly: boolean;
}

export class MockImap extends EventEmitter {
    private config: ImapConfig;
    private isConnected = false;
    private currentBox: string | null = null;

    constructor(config: ImapConfig) {
        super();
        this.config = config;
    }

    connect(): void {
        setTimeout(() => {
            if (this.isConnectionInvalid()) {
                const error = new Error('Connection failed') as Error & { code: string };
                error.code = 'ENOTFOUND';
                this.emit('error', error);
            } else {
                this.isConnected = true;
                this.emit('ready');
            }
        }, 10);
    }

    openBox(folder: string, readOnly: boolean, callback: (err: Error | null, box?: ImapMailbox) => void): void {
        if (!this.isConnected) {
            callback(new Error('Not connected'));
            return;
        }

        setTimeout(() => {
            this.currentBox = folder;
            callback(null, {
                messages: { total: this.getMessageCount(folder) },
                name: folder,
                readOnly
            });
        }, 5);
    }

    search(criteria: any[], callback: (err: Error | null, results?: number[]) => void): void {
        setTimeout(() => {
            const messageIds = this.generateMessageIds();
            callback(null, messageIds);
        }, 10);
    }

    fetch(results: number[], options?: any) {
        const fetchEmitter = new EventEmitter();

        setTimeout(() => {
            results.forEach((id, index) => {
                const mockMessage = this.createMockMessage(id);
                fetchEmitter.emit('message', mockMessage);
            });

            setTimeout(() => fetchEmitter.emit('end'), 20);
        }, 10);

        return fetchEmitter;
    }

    end(): void {
        this.isConnected = false;
        setTimeout(() => this.emit('end'), 5);
    }

    addFlags(source: number | number[], flags: string[], callback: (err: Error | null) => void): void {
        setTimeout(() => callback(null), 5);
    }

    // Private helper methods
    private isConnectionInvalid(): boolean {
        return !this.config.host ||
               this.config.host.includes('invalid') ||
               this.config.host.includes('nonexistent') ||
               this.config.host.includes('unreachable') ||
               !this.config.user ||
               !this.config.password;
    }

    private getMessageCount(folder: string): number {
        const counts: Record<string, number> = {
            'INBOX': 5,
            'SENT': 2,
            'DRAFTS': 1,
            'JUNK': 0
        };
        return counts[folder.toUpperCase()] || 3;
    }

    private generateMessageIds(): number[] {
        return [123, 456, 789, 1011, 1213].slice(0, Math.max(1, Math.floor(Math.random() * 5)));
    }

    private createMockMessage(id: number) {
        const message = new EventEmitter();

        setTimeout(() => {
            const emailContent = this.generateEmailContent(id);
            message.emit('body', Buffer.from(emailContent));
        }, 5);

        setTimeout(() => {
            message.emit('attributes', {
                uid: id,
                flags: Math.random() > 0.5 ? ['\\Seen'] : [],
                date: new Date(),
                size: Math.floor(Math.random() * 10000) + 500
            });
        }, 10);

        setTimeout(() => {
            message.emit('end');
        }, 15);

        return message;
    }

    private generateEmailContent(id: number): string {
        return [
            `Message-ID: <${id}@test.com>`,
            `From: sender${id}@test.com`,
            `To: recipient@test.com`,
            `Subject: Test Email ${id}`,
            `Date: ${new Date().toUTCString()}`,
            ``,
            `This is test email content for message ${id}.`,
            `Generated for testing purposes.`
        ].join('\r\n');
    }
}

// ============================================================================
// MOCK MAILPARSER - Simplified
// ============================================================================

export function createMockMailparser() {
    return {
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

// ============================================================================
// MODULE MOCKING SETUP - Streamlined
// ============================================================================

export function setupModuleMocks(): () => void {
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function(id: string) {
        switch (id) {
            case 'node-imap':
                return MockImap;
            case 'mailparser':
                return createMockMailparser();
            default:
                return originalRequire.apply(this, arguments);
        }
    };

    return function cleanup(): void {
        Module.prototype.require = originalRequire;
    };
}

// ============================================================================
// TEST CONFIGURATIONS - Simplified and focused
// ============================================================================

export const testConfigs = {
    valid: {
        id: 'test-node-1',
        type: 'email-receiver',
        name: 'Test Email Receiver',
        host: 'imap.test.com',
        port: 993,
        user: 'test@test.com',
        password: 'testpass',
        folder: ['INBOX'],
        tls: true,
        markseen: true
    } as TestConfig,

    minimal: {
        id: 'test-node-minimal',
        type: 'email-receiver',
        host: 'imap.minimal.com',
        port: 993,
        user: 'minimal@test.com',
        password: 'minimalpass',
        folder: 'INBOX'
    } as TestConfig,

    arrayFolders: {
        id: 'test-node-array',
        type: 'email-receiver',
        name: 'Array Folders Test',
        host: 'imap.test.com',
        port: 993,
        user: 'test@test.com',
        password: 'testpass',
        folder: ['INBOX', 'SENT', 'DRAFTS']
    } as TestConfig,

    invalidFolderType: {
        id: 'test-node-invalid-folder',
        type: 'email-receiver',
        host: 'imap.test.com',
        port: 993,
        user: 'test@test.com',
        password: 'testpass',
        folder: 123 as any // Invalid type
    } as TestConfig,

    invalidConfig: {
        id: 'test-node-invalid',
        type: 'email-receiver',
        host: '', // Missing host
        port: 993,
        user: 'test@test.com',
        password: '', // Missing password
        folder: ['INBOX']
    } as TestConfig,

    networkError: {
        id: 'test-node-network-error',
        type: 'email-receiver',
        host: 'unreachable.invalid.host.com',
        port: 993,
        user: 'test@test.com',
        password: 'testpass',
        folder: ['INBOX']
    } as TestConfig
};

// ============================================================================
// TEST FLOWS - Simplified for integration tests
// ============================================================================

export const testFlows = {
    single: [testConfigs.valid],

    connected: [
        { ...testConfigs.valid, wires: [['h1']] },
        { id: 'h1', type: 'helper' }
    ],

    multiOutput: [
        { ...testConfigs.valid, wires: [['h1', 'h2']] },
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

    createEmailData: (overrides: Partial<EmailData> = {}): EmailData => ({
        subject: 'Test Email',
        from: 'sender@test.com',
        to: 'recipient@test.com',
        text: 'Test email content',
        date: new Date(),
        messageId: '<test@test.com>',
        ...overrides
    }),

    createLargeEmail: (sizeKb: number = 100): EmailData => ({
        subject: 'Large Email Test',
        from: 'sender@test.com',
        to: 'recipient@test.com',
        text: 'x'.repeat(sizeKb * 1024),
        date: new Date(),
        messageId: '<large@test.com>'
    })
};