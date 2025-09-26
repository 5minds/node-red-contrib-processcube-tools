/**
 * Email Receiver Node - Test Mocks and Configuration
 */

// ============================================================================
// TEST CONFIGURATIONS - Simplified and focused
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
}

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
