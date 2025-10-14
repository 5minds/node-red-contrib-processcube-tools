import { EmailReceiverConfig } from '../interfaces/email-receiver-config';

// Mock IMAP config nodes
export const MockImapConfigNodes = {
    'valid-imap-config': {
        host: 'imap.test.com',
        port: 993,
        tls: true,
        user: 'test@test.com',
        userType: 'str',
        password: 'testpass',
        passwordType: 'str',
        connTimeout: 10000,
        authTimeout: 5000,
        keepalive: true,
        autotls: 'never',
        rejectUnauthorized: false,
    },
    'minimal-imap-config': {
        host: 'imap.minimal.com',
        port: 993,
        tls: true,
        user: 'minimal@test.com',
        userType: 'str',
        password: 'minimalpass',
        passwordType: 'str',
        connTimeout: 10000,
        authTimeout: 5000,
        keepalive: true,
        autotls: 'never',
        rejectUnauthorized: false,
    },
    'invalid-imap-config': {
        host: '', // Missing host
        port: 993,
        tls: true,
        user: 'test@test.com',
        userType: 'str',
        password: '', // Missing password
        passwordType: 'str',
        connTimeout: 10000,
        authTimeout: 5000,
        keepalive: true,
        autotls: 'never',
        rejectUnauthorized: false,
    },
    'network-error-imap-config': {
        host: 'unreachable.invalid.host.com',
        port: 993,
        tls: true,
        user: 'test@test.com',
        userType: 'str',
        password: 'testpass',
        passwordType: 'str',
        connTimeout: 10000,
        authTimeout: 5000,
        keepalive: true,
        autotls: 'never',
        rejectUnauthorized: false,
    },
};

export const EmailReceiverTestConfigs = {
    valid: {
        id: 'test-node-1',
        type: 'email-receiver',
        name: 'Test Email Receiver',
        imapConfig: 'valid-imap-config',
        folder: ['INBOX'],
        folderType: 'str',
        markseen: true,
        markseenType: 'bool',
    } as EmailReceiverConfig,

    minimal: {
        id: 'test-node-minimal',
        type: 'email-receiver',
        imapConfig: 'minimal-imap-config',
        folder: 'INBOX',
        folderType: 'str',
    } as EmailReceiverConfig,

    arrayFolders: {
        id: 'test-node-array',
        type: 'email-receiver',
        name: 'Array Folders Test',
        imapConfig: 'valid-imap-config',
        folder: ['INBOX', 'SENT', 'DRAFTS'],
        folderType: 'str',
    } as EmailReceiverConfig,

    invalidFolderType: {
        id: 'test-node-invalid-folder',
        type: 'email-receiver',
        imapConfig: 'valid-imap-config',
        folder: 123 as any, // Invalid type
        folderType: 'str',
    } as EmailReceiverConfig,

    invalidConfig: {
        id: 'test-node-invalid',
        type: 'email-receiver',
        imapConfig: 'invalid-imap-config',
        folder: ['INBOX'],
        folderType: 'str',
    } as EmailReceiverConfig,

    networkError: {
        id: 'test-node-network-error',
        type: 'email-receiver',
        imapConfig: 'network-error-imap-config',
        folder: ['INBOX'],
        folderType: 'str',
    } as EmailReceiverConfig,
};

// Helper function to get the getNodeHandler for tests
export function createImapConfigNodeHandler() {
    return (id: string) => {
        return MockImapConfigNodes[id as keyof typeof MockImapConfigNodes] || null;
    };
}
