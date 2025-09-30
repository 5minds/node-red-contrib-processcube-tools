import { EmailSenderConfig } from "../interfaces/email-sender-config";

const EmailSenderTestConfigs = {
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
        to: 'test@example.com',
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

const baseConfig = EmailSenderTestConfigs.valid;
EmailSenderTestConfigs.errorScenarios.networkError = {
    ...baseConfig,
    ...EmailSenderTestConfigs.errorScenarios.networkError
};

EmailSenderTestConfigs.errorScenarios.rejectedEmail = {
    ...baseConfig,
    ...EmailSenderTestConfigs.errorScenarios.rejectedEmail
};

EmailSenderTestConfigs.errorScenarios.pendingEmail = {
    ...baseConfig,
    ...EmailSenderTestConfigs.errorScenarios.pendingEmail
};

export { EmailSenderTestConfigs };