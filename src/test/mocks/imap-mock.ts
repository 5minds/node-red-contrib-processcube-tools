import { EventEmitter } from 'events';
import { ImapConfig } from "../interfaces/imap-config";
import { ImapMailbox } from '../interfaces/imap-mailbox';

export class MockImap extends EventEmitter {
    private config: ImapConfig;
    private isConnected = false;
    private currentBox: string | null = null;
    public state: string = 'disconnected';

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
                this.state = 'authenticated';
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
            const messageIds = this.getFixedMessageIds();
            callback(null, messageIds);
        }, 10);
    }

    fetch(results: number[], options?: any) {
        const fetchEmitter = new EventEmitter();

        setTimeout(() => {
            results.forEach((id, index) => {
                setTimeout(() => {
                    const mockMessage = this.createMockMessage(id);
                    fetchEmitter.emit('message', mockMessage, id);
                }, index * 5);
            });

            // Emit end after all messages are processed
            setTimeout(() => fetchEmitter.emit('end'), results.length * 10 + 50);
        }, 10);

        return fetchEmitter;
    }

    end(): void {
        this.isConnected = false;
        this.state = 'disconnected';
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

    private getFixedMessageIds(): number[] {
        return this.currentBox === 'INBOX' ? [123, 456, 789, 1011, 1213] : [123, 456, 789];
    }

    private createMockMessage(id: number) {
        const message = new EventEmitter();

        setTimeout(() => {
            const emailContent = this.generateEmailContent(id);
            // Create a proper readable stream
            const { Readable } = require('stream');
            const mockStream = new Readable({
                read() {
                    this.push(Buffer.from(emailContent));
                    this.push(null); // End the stream
                }
            });
            message.emit('body', mockStream);
        }, 5);

        setTimeout(() => {
            message.emit('attributes', {
                uid: id,
                flags: Math.random() > 0.5 ? ['\\Seen'] : [],
                date: new Date(),
                size: Math.floor(Math.random() * 10000) + 500
            });
        }, 10);

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