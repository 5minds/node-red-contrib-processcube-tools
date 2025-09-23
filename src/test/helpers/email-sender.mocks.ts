// Helper functions and mocks for email-sender tests
import { EventEmitter } from 'events';

// Type definitions
export interface MockNodeREDOptions {
    onHandler?: (this: MockNode, event: string, callback: Function) => void;
    statusHandler?: (status: { fill: string; text: string; shape?: string }) => void;
    errorHandler?: (err: any) => void;
    sendHandler?: (msg: any) => void;
    logHandler?: (...args: any[]) => void;
    warnHandler?: (...args: any[]) => void;
    debugHandler?: (...args: any[]) => void;
    logInfo?: (...args: any[]) => void;
    logWarn?: (...args: any[]) => void;
    logError?: (...args: any[]) => void;
    logDebug?: (...args: any[]) => void;
}

export interface NodeStatus {
    fill: string;
    text: string;
    shape?: string;
}

export interface MockNode {
    id: string;
    type: string;
    name: string;
    on: (event: string, callback: Function) => void;
    status: (status?: NodeStatus) => void;
    error: (err: any) => void;
    send: (msg: any) => void;
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    inputCallback?: ((msg: any) => void) | undefined;
    [key: string]: any;
}

export interface MockNodeRED {
    nodes: {
        createNode: (node: MockNode, config: EmailSenderConfig) => MockNode;
        registerType: (type: string, constructor: Function) => void;
        lastRegisteredType?: string;
        lastRegisteredConstructor?: new (config: EmailSenderConfig) => MockNode;
        getInputCallback: () => Function | undefined;
        getNodeInstance: () => MockNode | undefined;
    };
    util: {
        evaluateNodeProperty: (value: any, type: string, node: MockNode, msg: any, callback?: (err: Error | null, result: any) => void) => any;
        encrypt: (value: string) => string;
        decrypt: (value: string) => string;
    };
    log: {
        info: (...args: any[]) => void;
        warn: (...args: any[]) => void;
        error: (...args: any[]) => void;
        debug: (...args: any[]) => void;
    };
}

export interface EmailSenderConfig {
    id: string;
    type: string;
    name?: string;
    sender?: string;
    senderType?: string;
    address?: string;
    addressType?: string;
    to?: string;
    toType?: string;
    cc?: string;
    ccType?: string;
    bcc?: string;
    bccType?: string;
    subject?: string;
    subjectType?: string;
    htmlContent?: string;
    htmlContentType?: string;
    attachments?: string;
    attachmentsType?: string;
    host?: string;
    hostType?: string;
    port?: number;
    portType?: string;
    user?: string;
    userType?: string;
    password?: string;
    passwordType?: string;
    secure?: boolean;
    secureType?: string;
    rejectUnauthorized?: boolean;
    rejectUnauthorizedType?: string;
    wires?: string[][];
    [key: string]: any;
}

export interface MailOptions {
    to: string | string[];
    from?: string;
    subject?: string;
    html?: string;
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

export interface MockTransporter {
    sendMail: (mailOptions: MailOptions, callback: (err: Error | null, result?: SendMailResult) => void) => void;
}

export interface MockNodemailerOptions {
    shouldFail?: boolean;
    rejectedEmails?: string[];
    pendingEmails?: string[];
    acceptedEmails?: string[];
    onSendMail?: (mailOptions: MailOptions) => void;
}

export interface MockNodemailer {
    createTransport: () => MockTransporter;
    restore: () => void;
}

export interface MockNodeExtended extends EventEmitter {
    status: {
        (...args: any[]): void;
        called: boolean;
        args: any[];
        calledWith: (expectedArgs: any[]) => boolean;
    };
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    log: (...args: any[]) => void;
    send: {
        (...args: any[]): void;
        called: boolean;
        args: any[];
        callCount: number;
        calledWith: (expectedArgs: any) => boolean;
    };
}

export interface TestFlow {
    id: string;
    type: string;
    wires?: string[][];
    [key: string]: any;
}

export interface TestFlows {
    single: TestFlow[];
    withHelper: TestFlow[];
    connected: TestFlow[];
    multiOutput: TestFlow[];
}

export interface TestUtils {
    wait: (ms?: number) => Promise<void>;
    waitForMessage: (node: EventEmitter, timeout?: number) => Promise<any>;
    verifyMessage: (msg: any, expectedProps?: Record<string, any>) => void;
}

// Global variables for tracking
let storedInputCallback: Function | undefined;
let nodeInstance: MockNode | undefined;

/**
 * Create mock Node-RED object for unit testing
 */
export function createMockNodeRED(options: MockNodeREDOptions = {}): MockNodeRED {
    const mockRED: MockNodeRED = {
        nodes: {
            createNode: function (node: MockNode, config: EmailSenderConfig): MockNode {
                nodeInstance = node; // Capture the node instance

                // Apply config properties to node
                Object.assign(node, {
                    id: config.id || 'mock-node-id',
                    type: config.type || 'email-sender',
                    name: config.name || 'Mock Node',
                    on: function (event: string, callback: Function): void {
                        if (event === 'input') {
                            storedInputCallback = callback;
                            // Store the callback on the node instance for easy access
                            node.inputCallback = callback as (msg: any) => void;
                        }
                        // Call the original onHandler if provided
                        if (options.onHandler) {
                            options.onHandler.call(node, event, callback);
                        }
                    },
                    status: options.statusHandler || function (): void {},
                    error: options.errorHandler || function (): void {},
                    send: options.sendHandler || function (): void {},
                    log: options.logHandler || function (): void {},
                    warn: options.warnHandler || function (): void {},
                    debug: options.debugHandler || function (): void {},
                });
                return node;
            },
            registerType: function (type: string, constructor: Function): void {
                // Store registration for verification in tests
                this.lastRegisteredType = type;
                this.lastRegisteredConstructor = constructor as new (config: EmailSenderConfig) => MockNode;
            },
            // Helper method to get the stored input callback
            getInputCallback: function (): Function | undefined {
                return storedInputCallback;
            },
            // Helper method to get the node instance
            getNodeInstance: function (): MockNode | undefined {
                return nodeInstance;
            },
        },
        util: {
            evaluateNodeProperty: function (
                value: any,
                type: string,
                node: MockNode,
                msg: any,
                callback?: (err: Error | null, result: any) => void
            ): any {
                if (type === 'json') {
                    try {
                        // Simulate parsing a JSON string into an object
                        const result = JSON.parse(JSON.stringify(value));
                        if (callback) {
                            callback(null, result);
                        }
                        return result;
                    } catch (e) {
                        if (callback) {
                            callback(e as Error, null);
                        }
                        return null;
                    }
                }

                // Simple mock implementation
                if (callback) {
                    callback(null, value);
                }
                return value;
            },
            encrypt: function (value: string): string {
                return 'encrypted:' + value;
            },
            decrypt: function (value: string): string {
                return value.replace('encrypted:', '');
            },
        },
        log: {
            info: options.logInfo || function (): void {},
            warn: options.logWarn || function (): void {},
            error: options.logError || function (): void {},
            debug: options.logDebug || function (): void {},
        },
    };

    return mockRED;
}

export function createMockNodemailer(options: MockNodemailerOptions = {}): MockNodemailer {
    const settings: MockNodemailerOptions = Object.assign(
        {
            shouldFail: false,
            // New options for different email statuses
            rejectedEmails: [], // Array of emails to mark as rejected
            pendingEmails: [], // Array of emails to mark as pending
            acceptedEmails: [], // Array of emails to mark as accepted (overrides default)
        },
        options,
    );

    return {
        createTransport: (): MockTransporter => ({
            sendMail: (mailOptions: MailOptions, callback: (err: Error | null, result?: SendMailResult) => void): void => {
                if (settings.onSendMail) {
                    settings.onSendMail(mailOptions);
                }

                if (settings.shouldFail === true) {
                    const error = new Error('Mock sendMail error') as Error & { code: string };
                    error.code = 'ECONNREFUSED';
                    return callback(error);
                }

                // Determine email status based on configuration
                const toEmail: string = Array.isArray(mailOptions.to) ? mailOptions.to[0] : mailOptions.to;
                let accepted: string[] = [];
                let rejected: string[] = [];
                let pending: string[] = [];

                if (
                    (settings.rejectedEmails && settings.rejectedEmails.length > 0) ||
                    (settings.pendingEmails && settings.pendingEmails.length > 0) ||
                    (settings.acceptedEmails && settings.acceptedEmails.length > 0)
                ) {
                    // Use explicit configuration
                    if (settings.rejectedEmails && settings.rejectedEmails.includes(toEmail)) {
                        rejected = [toEmail];
                    } else if (settings.pendingEmails && settings.pendingEmails.includes(toEmail)) {
                        pending = [toEmail];
                    } else if (settings.acceptedEmails && settings.acceptedEmails.includes(toEmail)) {
                        accepted = [toEmail];
                    } else {
                        // Default behavior - accept if not explicitly configured
                        accepted = [toEmail];
                    }
                } else {
                    // Original behavior - accept all emails (backwards compatibility)
                    accepted = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
                }

                // Set appropriate response message based on status
                let responseMessage = '250 OK: Message accepted';
                if (rejected.length > 0) {
                    responseMessage = '550 Mailbox unavailable';
                } else if (pending.length > 0) {
                    responseMessage = '451 Requested action aborted: local error';
                }

                callback(null, {
                    messageId: '<mock-message-id@test.com>',
                    response: responseMessage,
                    accepted: accepted,
                    rejected: rejected,
                    pending: pending,
                });
            },
        }),
        restore: function (): void {
            // Cleanup method
        },
    };
}

// Update setupModuleMocks to use the new implementation
export function setupModuleMocks(): () => void {
    const mockNodemailerModule = createMockNodemailer();

    delete require.cache[require.resolve('nodemailer')];
    (require.cache as any)[require.resolve('nodemailer')] = {
        exports: mockNodemailerModule,
    };

    return function cleanup(): void {
        delete (require.cache as any)[require.resolve('nodemailer')];
        if (mockNodemailerModule.restore) {
            mockNodemailerModule.restore();
        }
    };
}

// Custom mock node
export function getMockNode(): MockNodeExtended {
    // Create an EventEmitter instance to get the .on and .emit methods
    const mock = Object.assign(new EventEmitter(), {
        status: () => {},
        error: () => {},
        warn: () => {},
        log: () => {},
        send: () => {},
    }) as MockNodeExtended;

    // Enhance status method with tracking
    const statusFn = (...args: any[]): void => {
        (statusFn as any).called = true;
        (statusFn as any).args = args;
    };
    (statusFn as any).called = false;
    (statusFn as any).args = [];
    (statusFn as any).calledWith = (expectedArgs: any[]): boolean => {
        return (statusFn as any).called && JSON.stringify((statusFn as any).args) === JSON.stringify(expectedArgs);
    };
    mock.status = statusFn as any;

    // Enhance send method with tracking
    const sendFn = (...args: any[]): void => {
        (sendFn as any).called = true;
        (sendFn as any).args = args;
        (sendFn as any).callCount++;
    };
    (sendFn as any).called = false;
    (sendFn as any).args = [];
    (sendFn as any).callCount = 0;
    (sendFn as any).calledWith = (expectedArgs: any): boolean => {
        return (sendFn as any).called && JSON.stringify((sendFn as any).args) === JSON.stringify([expectedArgs]);
    };
    mock.send = sendFn as any;

    return mock;
}

/**
 * Test configurations for the email sender node.
 */
export const emailSenderConfigs = {
    valid: {
        id: 'test-node-6',
        type: 'email-sender',
        name: 'Test Email Sender',
        sender: 'Test Sender',
        senderType: 'str',
        address: 'test.sender@example.com',
        addressType: 'str',
        to: 'recipient@example.com',
        toType: 'str',
        cc: '',
        ccType: 'str',
        bcc: '',
        bccType: 'str',
        subject: 'Test Subject',
        subjectType: 'str',
        htmlContent: '<b>Hello World</b>',
        htmlContentType: 'str',
        attachments: '',
        attachmentsType: 'str',
        host: 'smtp.example.com',
        hostType: 'str',
        port: 587,
        portType: 'num',
        user: 'user',
        userType: 'str',
        password: 'password',
        passwordType: 'str',
        secure: false,
        secureType: 'bool',
        rejectUnauthorized: true,
        rejectUnauthorizedType: 'bool',
    } as EmailSenderConfig,

    invalid: {
        id: 'test-node-7',
        type: 'email-sender',
        name: 'Invalid Email Sender',
        sender: '', // Missing sender
        senderType: 'str',
        address: 'test.sender@example.com',
        addressType: 'str',
        to: 'recipient@example.com',
        toType: 'str',
        subject: 'Invalid Test Subject',
        subjectType: 'str',
        htmlContent: 'Invalid Test Content',
        htmlContentType: 'str',
        host: '', // Missing host
        hostType: 'str',
        port: 587,
        portType: 'str', // Incorrect type
        user: 'user',
        userType: 'str',
        password: '', // Missing password
        passwordType: 'str',
    } as EmailSenderConfig,

    minimal: {
        id: 'test-node-8',
        type: 'email-sender',
        name: 'Minimal Email Sender',
        to: 'recipient@example.com',
        toType: 'str',
        subject: 'Minimal Subject',
        subjectType: 'str',
        htmlContent: 'Minimal content.',
        htmlContentType: 'str',
        host: 'smtp.minimal.com',
        hostType: 'str',
        port: 587,
        portType: 'num',
        user: 'minimal-user',
        userType: 'str',
        password: 'minimal-password',
        passwordType: 'str',
    } as EmailSenderConfig,
};

/**
 * Create test flows for Node-RED integration tests
 */
export const testFlows: TestFlows = {
    single: [emailSenderConfigs.valid],

    withHelper: [emailSenderConfigs.valid, { id: 'h1', type: 'helper' }],

    connected: [
        { ...emailSenderConfigs.valid, wires: [['h1']] },
        { id: 'h1', type: 'helper' },
    ],

    multiOutput: [
        { ...emailSenderConfigs.valid, wires: [['h1', 'h2']] },
        { id: 'h1', type: 'helper' },
        { id: 'h2', type: 'helper' },
    ],
};

/**
 * Utility functions for test assertions and email simulation
 */
export const testUtils: TestUtils = {
    /**
     * Wait for a specified amount of time
     */
    wait: (ms: number = 100): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),

    /**
     * Create a promise that resolves when a node receives a message
     */
    waitForMessage: (node: EventEmitter, timeout: number = 1000): Promise<any> => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Timeout waiting for message'));
            }, timeout);

            node.on('input', (msg: any) => {
                clearTimeout(timer);
                resolve(msg);
            });
        });
    },
    /**
     * Verify that a message has expected properties
     */
    verifyMessage: (msg: any, expectedProps: Record<string, any> = {}): void => {
        const should = require('should');
        should.exist(msg);

        Object.keys(expectedProps).forEach((prop: string) => {
            if (expectedProps[prop] !== undefined) {
                msg.should.have.property(prop, expectedProps[prop]);
            }
        });
    },
};