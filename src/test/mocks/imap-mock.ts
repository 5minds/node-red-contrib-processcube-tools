import { EventEmitter } from 'events';

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
