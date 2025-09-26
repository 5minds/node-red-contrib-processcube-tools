import { TestConfig } from "../interfaces/test-config";

export const EmailReceiverTestConfigs = {
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

