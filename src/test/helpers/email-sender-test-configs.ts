import { EmailSenderConfig } from '../interfaces/email-sender-config';

// Mock SMTP config nodes
export const MockSmtpConfigNodes = {
    'valid-smtp-config': {
        host: 'smtp.example.com',
        port: 587,
        user: 'testuser',
        userType: 'str',
        password: 'testpass',
        passwordType: 'str',
        connTimeout: 10000,
        authTimeout: 5000,
        keepalive: true,
        secure: false,
        autotls: 'never',
        rejectUnauthorized: true,
    },
    'minimal-smtp-config': {
        host: 'smtp.minimal.com',
        port: 587,
        user: 'minimal-user',
        userType: 'str',
        password: 'minimal-pass',
        passwordType: 'str',
        connTimeout: 10000,
        authTimeout: 5000,
        keepalive: true,
        secure: false,
        autotls: 'never',
        rejectUnauthorized: true,
    },
    'invalid-smtp-config': {
        host: '', // Missing host
        port: 587,
        user: 'user',
        userType: 'str',
        password: '', // Missing password
        passwordType: 'str',
        connTimeout: 10000,
        authTimeout: 5000,
        keepalive: false,
        secure: false,
        autotls: 'never',
        rejectUnauthorized: false,
    },
};

const EmailSenderTestConfigs = {
    valid: {
        id: 'test-sender-1',
        type: 'email-sender',
        name: 'Test Email Sender',
        sender: 'Test Sender',
        from: 'test.sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        htmlContent: '<b>Test Content</b>',
        attachments: '',
        attachmentsType: 'str',
        smtpConfig: 'valid-smtp-config',
    } as EmailSenderConfig,

    minimal: {
        id: 'test-sender-minimal',
        type: 'email-sender',
        sender: 'Test Sender',
        from: 'test.sender@example.com',
        to: 'recipient@example.com',
        subject: 'Minimal Subject',
        htmlContent: 'Minimal content',
        smtpConfig: 'minimal-smtp-config',
    } as EmailSenderConfig,

    invalid: {
        id: 'test-sender-invalid',
        type: 'email-sender',
        name: 'Invalid Sender',
        sender: '', // Missing sender
        to: 'test@example.com',
        subject: 'Invalid Test',
        smtpConfig: 'invalid-smtp-config',
    } as EmailSenderConfig,

    minimalDataDriven: {
        id: 'test-sender-minimal-data-driven',
        type: 'email-sender',
        sender: 'Test Sender',
        from: 'test.sender@example.com',
        to: '', // Empty - will be provided via msg.to
        subject: '', // Empty - will be provided via msg.topic
        htmlContent: '', // Empty - will be provided via msg.payload
        smtpConfig: 'minimal-smtp-config',
    } as EmailSenderConfig,

    withAttachments: {
        id: 'test-sender-attachments',
        type: 'email-sender',
        name: 'Sender With Attachments',
        sender: 'Test Sender',
        from: 'test.sender@example.com',
        to: 'recipient@example.com',
        subject: 'Attachment Test',
        htmlContent: 'Email with attachments',
        attachments: JSON.stringify([{ filename: 'test.txt', content: 'Test attachment' }]),
        attachmentsType: 'json',
        smtpConfig: 'valid-smtp-config',
    } as EmailSenderConfig,

    errorScenarios: {
        networkError: {
            id: 'test-sender-network-error',
            type: 'email-sender',
            name: 'Network Error Scenario',
            smtpConfig: 'valid-smtp-config',
            shouldFail: true,
        } as EmailSenderConfig,

        rejectedEmail: {
            id: 'test-sender-rejected',
            type: 'email-sender',
            name: 'Rejected Email Scenario',
            smtpConfig: 'valid-smtp-config',
            rejectedEmails: ['recipient@example.com'],
        } as EmailSenderConfig,

        pendingEmail: {
            id: 'test-sender-pending',
            type: 'email-sender',
            name: 'Pending Email Scenario',
            smtpConfig: 'valid-smtp-config',
            pendingEmails: ['recipient@example.com'],
        } as EmailSenderConfig,
    },
};

const baseConfig = EmailSenderTestConfigs.valid;
EmailSenderTestConfigs.errorScenarios.networkError = {
    ...baseConfig,
    ...EmailSenderTestConfigs.errorScenarios.networkError,
};

EmailSenderTestConfigs.errorScenarios.rejectedEmail = {
    ...baseConfig,
    ...EmailSenderTestConfigs.errorScenarios.rejectedEmail,
};

EmailSenderTestConfigs.errorScenarios.pendingEmail = {
    ...baseConfig,
    ...EmailSenderTestConfigs.errorScenarios.pendingEmail,
};

// Helper function to get the getNodeHandler for tests
export function createSmtpConfigNodeHandler() {
    return (id: string) => {
        return MockSmtpConfigNodes[id as keyof typeof MockSmtpConfigNodes] || null;
    };
}

export { EmailSenderTestConfigs };
