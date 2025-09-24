/**
 * Shared mock objects and utilities for Email Receiver Node tests
 */

import { EventEmitter } from 'events';

// Type definitions for Node-RED objects
interface NodeRedMessage {
    payload?: any;
    topic?: string;
    [key: string]: any;
}

interface NodeRedNode {
    id: string;
    type: string;
    name?: string;
    on: (event: string, callback: Function) => void;
    status: (status: any) => void;
    error: (error: string | Error, message?: NodeRedMessage) => void;
    send: (message: NodeRedMessage | NodeRedMessage[]) => void;
    log: (message: string) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
    inputCallback?: (message: NodeRedMessage) => void;
}

interface NodeRedConfig {
    id?: string;
    type?: string;
    name?: string;
    host?: string;
    hostType?: string;
    port?: number;
    portType?: string;
    tls?: boolean;
    tlsType?: string;
    user?: string;
    userType?: string;
    password?: string;
    passwordType?: string;
    folder?: string | string[];
    folderType?: string;
    markseen?: boolean;
    markseenType?: string;
    wires?: string[][];
}

interface MockNodeRedOptions {
    onHandler?: (event: string, callback: Function) => void;
    statusHandler?: (status: any) => void;
    errorHandler?: (error: string | Error, message?: NodeRedMessage) => void;
    sendHandler?: (message: NodeRedMessage | NodeRedMessage[]) => void;
    logHandler?: (message: string) => void;
    warnHandler?: (message: string) => void;
    debugHandler?: (message: string) => void;
    logInfo?: (message: string) => void;
    logWarn?: (message: string) => void;
    logError?: (message: string) => void;
    logDebug?: (message: string) => void;
}

interface MockNodeRED {
    nodes: {
        createNode: (node: NodeRedNode, config: NodeRedConfig) => NodeRedNode;
        registerType: (type: string, constructor: Function) => void;
        lastRegisteredType?: string;
        lastRegisteredConstructor?: Function;
        getInputCallback: () => ((message: NodeRedMessage) => void) | null;
        getNodeInstance: () => NodeRedNode | null;
    };
    util: {
        evaluateNodeProperty: (value: any, type: string, node: NodeRedNode, msg: NodeRedMessage, callback?: (err: Error | null, result: any) => void) => any;
        encrypt: (value: string) => string;
        decrypt: (value: string) => string;
    };
    log: {
        info: (message: string) => void;
        warn: (message: string) => void;
        error: (message: string) => void;
        debug: (message: string) => void;
    };
}

interface ImapConfig {
    host?: string;
    port?: number;
    tls?: boolean;
    user?: string;
    password?: string;
    authTimeout?: number;
    connTimeout?: number;
    keepalive?: boolean;
    secure?: boolean;
}

interface ImapMessage {
    on: (event: string, callback: (data: any) => void) => void;
    once: (event: string, callback: () => void) => void;
}

interface ImapFetchEmitter extends EventEmitter {
    on: (event: string, callback: (message?: ImapMessage) => void) => this;
    once: (event: string, callback: () => void) => this;
}

interface ImapMailbox {
    messages: { total: number };
    name: string;
    readOnly: boolean;
}

interface IMockImap {
    config: ImapConfig;
    events: Record<string, Function>;
    connect: () => void;
    openBox: (folder: string, readOnly: boolean, callback: (err: Error | null, box?: ImapMailbox) => void) => void;
    search: (criteria: any[], callback: (err: Error | null, results?: number[]) => void) => void;
    fetch: (results: number[], options?: any) => ImapFetchEmitter;
    end: () => void;
    once: (event: string, callback: Function) => void;
    on: (event: string, callback: Function) => void;
    addFlags: (source: number | number[], flags: string[], callback: (err: Error | null) => void) => void;
    removeFlags: (source: number | number[], flags: string[], callback: (err: Error | null) => void) => void;
    simulateNewEmail: (emailData?: Record<string, any>) => void;
    lastFetchEmitter?: ImapFetchEmitter;
    errorCallback?: (error: Error) => void;
}

interface EmailAddress {
    address: string;
    name?: string;
}

interface ParsedEmail {
    subject?: string;
    text?: string;
    html?: string;
    from?: {
        text: string;
        value: EmailAddress[];
    };
    to?: {
        text: string;
        value: EmailAddress[];
    };
    date?: Date;
    messageId?: string;
    headers: Map<string, string>;
    attachments?: any[];
}

interface MockMailparserOptions {
    subject?: string;
    text?: string;
    html?: string;
    from?: string;
    to?: string;
    date?: Date;
    messageId?: string;
    attachments?: any[];
}

interface MockMailparser {
    simpleParser: (source: any, options?: MockMailparserOptions) => Promise<ParsedEmail>;
}

interface TestConfig extends NodeRedConfig {
    id: string;
    type: string;
}

interface TestFlow {
    single: TestConfig[];
    withHelper: TestConfig[];
    connected: TestConfig[];
    multiOutput: TestConfig[];
}

/**
 * Create mock Node-RED object for unit testing
 */
function createMockNodeRED(options: MockNodeRedOptions = {}): MockNodeRED {
    // Store input callback in the mock RED context
    let storedInputCallback: ((message: NodeRedMessage) => void) | null = null;
    let nodeInstance: NodeRedNode | null = null;

    const mockRED: MockNodeRED = {
        nodes: {
            createNode: function (node: NodeRedNode, config: NodeRedConfig): NodeRedNode {
                nodeInstance = node; // Capture the node instance

                // Apply config properties to node
                Object.assign(node, {
                    id: config.id || 'mock-node-id',
                    type: config.type || 'email-receiver',
                    name: config.name || 'Mock Node',
                    on: function (event: string, callback: Function) {
                        if (event === 'input') {
                            storedInputCallback = callback as (message: NodeRedMessage) => void;
                            // Store the callback on the node instance for easy access
                            node.inputCallback = callback as (message: NodeRedMessage) => void;
                        }
                        // Call the original onHandler if provided
                        if (options.onHandler) {
                            options.onHandler.call(node, event, callback);
                        }
                    },
                    status: options.statusHandler || function () {},
                    error: options.errorHandler || function () {},
                    send: options.sendHandler || function () {},
                    log: options.logHandler || function () {},
                    warn: options.warnHandler || function () {},
                    debug: options.debugHandler || function () {},
                });
                return node;
            },
            registerType: function (type: string, constructor: Function) {
                // Store registration for verification in tests
                this.lastRegisteredType = type;
                this.lastRegisteredConstructor = constructor;
            },
            // Helper method to get the stored input callback
            getInputCallback: function (): ((message: NodeRedMessage) => void) | null {
                return storedInputCallback;
            },
            // Helper method to get the node instance
            getNodeInstance: function (): NodeRedNode | null {
                return nodeInstance;
            },
        },
        util: {
            evaluateNodeProperty: function (
                value: any,
                type: string,
                node: NodeRedNode,
                msg: NodeRedMessage,
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
            info: options.logInfo || function () {},
            warn: options.logWarn || function () {},
            error: options.logError || function () {},
            debug: options.logDebug || function () {},
        },
    };

    return mockRED;
}

/**
 * Mock IMAP implementation for testing
 */
class MockImap implements IMockImap {
  public config: ImapConfig;
  public events: Record<string, Function> = {};
  public lastFetchEmitter: ImapFetchEmitter | undefined;
  public errorCallback?: (error: Error) => void;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  // Simulate connection behavior
  public connect(): void {
    if (this.config.host && this.config.host.includes('invalid')) {
      if (this.events.error) {
        setTimeout(() => {
          const error = new Error('Connection failed') as Error & { code: string };
          error.code = 'ENOTFOUND';
          this.events.error(error);
        }, 10);
      }
    } else {
      if (this.events.ready) {
        setTimeout(() => this.events.ready(), 10);
      }
    }
  }

  // Simulate opening a mailbox
  public openBox(
    folder: string,
    readOnly: boolean,
    callback: (err: Error | null, box?: ImapMailbox) => void
  ): void {
    setTimeout(() => {
      callback(null, {
        messages: { total: 1 },
        name: folder,
        readOnly: readOnly,
      });
    }, 10);
  }

  // Simulate searching for emails
  public search(
    criteria: any[],
    callback: (err: Error | null, results?: number[]) => void
  ): void {
    setTimeout(() => {
      callback(null, [123, 456, 789]);
    }, 10);
  }

  // Simulate fetching email messages
  public fetch(results: number[], options?: any): ImapFetchEmitter {
    const fetchEmitter = {
      on: (event: string, callback: (message?: ImapMessage) => void) => {
        if (event === 'message') {
          setTimeout(() => {
            const mockMessage: ImapMessage = {
              on: (messageEvent: string, messageCallback: (data: any) => void) => {
                if (messageEvent === 'body') {
                  setTimeout(() => {
                    const mockEmailContent = `From: sender@test.com\r\nTo: recipient@test.com\r\nSubject: Mock Email Subject\r\n\r\nThis is a mock email body for testing purposes.`;
                    messageCallback(Buffer.from(mockEmailContent));
                  }, 5);
                } else if (messageEvent === 'attributes') {
                  setTimeout(() => {
                    messageCallback({
                      uid: 123,
                      flags: ['\\Seen'],
                      date: new Date(),
                      size: 1024,
                    });
                  }, 5);
                }
              },
              once: (messageEvent: string, messageCallback: () => void) => {
                if (messageEvent === 'end') {
                  setTimeout(() => messageCallback(), 15);
                }
              },
            };
            callback(mockMessage);
          }, 10);
        }
      },
      once: (event: string, callback: () => void) => {
        if (event === 'end') {
          setTimeout(() => callback(), 20);
        } else if (event === 'error') {
          this.errorCallback = callback as (error: Error) => void;
        }
      },
    } as ImapFetchEmitter;

    this.lastFetchEmitter = fetchEmitter;
    return fetchEmitter;
  }

  // Simulate closing connection
  public end(): void {
    if (this.events.end) {
      setTimeout(() => this.events.end(), 5);
    }
  }

  // Event listener setup
  public once(event: string, callback: Function): this {
    this.events[event] = callback;
    return this;
  }

  public on(event: string, callback: Function): this {
    this.events[event] = callback;
    return this;
  }

  // Additional IMAP methods
  public addFlags(
    source: number | number[],
    flags: string[],
    callback: (err: Error | null) => void
  ): void {
    setTimeout(() => callback(null), 5);
  }

  public removeFlags(
    source: number | number[],
    flags: string[],
    callback: (err: Error | null) => void
  ): void {
    setTimeout(() => callback(null), 5);
  }

  // Helper method to trigger the email processing flow
  public simulateNewEmail(emailData: Record<string, any> = {}): void {
    if (this.events.mail) {
      setTimeout(() => {
        this.events.mail(1);
      }, 10);
    }
  }
}

/**
 * Factory function to create MockImap instances
 */
function createMockImap(config: ImapConfig = {}): MockImap {
    return new MockImap(config);
}

/**
 * Mock Mailparser implementation for testing
 */
function createMockMailparser(): MockMailparser {
    return {
        simpleParser: function (source: any, options: MockMailparserOptions = {}): Promise<ParsedEmail> {
            return Promise.resolve({
                subject: options.subject || 'Mock Email Subject',
                text: options.text || 'This is a mock email body for testing purposes.',
                html: options.html || '<p>This is a mock email body for testing purposes.</p>',
                from: {
                    text: options.from || 'sender@test.com',
                    value: [{ address: options.from || 'sender@test.com', name: 'Test Sender' }],
                },
                to: {
                    text: options.to || 'recipient@test.com',
                    value: [{ address: options.to || 'recipient@test.com', name: 'Test Recipient' }],
                },
                date: options.date || new Date(),
                messageId: options.messageId || '<mock-message-id@test.com>',
                headers: new Map([
                    ['message-id', '<mock-message-id@test.com>'],
                    ['subject', options.subject || 'Mock Email Subject'],
                    ['from', options.from || 'sender@test.com'],
                    ['to', options.to || 'recipient@test.com'],
                ]),
                attachments: options.attachments || [],
            });
        },
    };
}

/**
 * Enhanced module mocks setup with better email simulation
 */
function setupModuleMocks(): () => void {
    // Store original require function
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    // Override the require function globally
    Module.prototype.require = function(id: string) {
        if (id === 'node-imap') {
            console.log('Intercepted node-imap import, returning MockImap');
            return MockImap;
        }
        if (id === 'mailparser') {
            return createMockMailparser();
        }
        return originalRequire.apply(this, arguments);
    };

    // Also handle dynamic imports and module resolution
    const originalResolveFilename = Module._resolveFilename;
    Module._resolveFilename = function(request: string, parent: any, isMain: boolean) {
        if (request === 'node-imap') {
            // Return the path to our mock instead
            return __filename; // Use current file as fake path
        }
        return originalResolveFilename.apply(this, arguments);
    };

    return function cleanup(): void {
        Module.prototype.require = originalRequire;
        Module._resolveFilename = originalResolveFilename;
    };
}
/**
 * Create test configurations for different scenarios
 */
const testConfigs: Record<string, TestConfig> = {
    valid: {
        id: 'test-node-1',
        type: 'email-receiver',
        name: 'Test Email Receiver',
        host: 'imap.test.com',
        hostType: 'str',
        port: 993,
        portType: 'num',
        tls: true,
        tlsType: 'bool',
        user: 'test@test.com',
        userType: 'str',
        password: 'testpass',
        passwordType: 'str',
        folder: ['INBOX'],
        folderType: 'str',
        markseen: true,
        markseenType: 'bool',
    },

    arrayFolders: {
        id: 'test-node-3',
        type: 'email-receiver',
        name: 'Array Folders Test',
        host: 'imap.test.com',
        hostType: 'str',
        port: 993,
        portType: 'num',
        user: 'test@test.com',
        userType: 'str',
        password: 'testpass',
        passwordType: 'str',
        folder: ['INBOX', 'Junk', 'Drafts'],
        folderType: 'json',
        markseen: false,
        markseenType: 'bool',
    },

    invalidFolderType: {
        id: 'test-node-4',
        type: 'email-receiver',
        name: 'Invalid Config Test',
        host: '', // Missing host
        hostType: 'str',
        port: 993,
        portType: 'num',
        user: 'test@test.com',
        userType: 'str',
        password: '', // Missing password
        passwordType: 'str',
        folder: 123 as any,
        folderType: 'num',
    },

    invalidConfig: {
        id: 'test-node-4',
        type: 'email-receiver',
        name: 'Invalid Config Test',
        host: 'invalid', // Missing host
        hostType: 'str',
        port: 993,
        portType: 'num',
        user: 'test@test.com',
        userType: 'str',
        password: '', // Missing password
        passwordType: 'str',
        folder: ['Inbox'],
        folderType: 'num',
    },

    minimal: {
        id: 'test-node-5',
        type: 'email-receiver',
        host: 'imap.minimal.com',
        hostType: 'str',
        port: 993,
        portType: 'num',
        user: 'minimal@test.com',
        userType: 'str',
        password: 'minimalpass',
        passwordType: 'str',
        folder: 'INBOX',
        folderType: 'str',
    },
};

/**
 * Create test flows for Node-RED integration tests
 */
const testFlows: TestFlow = {
    single: [testConfigs.valid],

    withHelper: [testConfigs.valid, { id: 'h1', type: 'helper' }],

    connected: [
        { ...testConfigs.valid, wires: [['h1']] },
        { id: 'h1', type: 'helper' },
    ],

    multiOutput: [
        { ...testConfigs.valid, wires: [['h1', 'h2']] },
        { id: 'h1', type: 'helper' },
        { id: 'h2', type: 'helper' },
    ],
};

/**
 * Utility functions for test assertions and email simulation
 */
const testUtils = {
    /**
     * Wait for a specified amount of time
     */
    wait: (ms: number = 100): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),

    /**
     * Create a promise that resolves when a node receives a message
     */
    waitForMessage: (node: NodeRedNode, timeout: number = 1000): Promise<NodeRedMessage> => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Timeout waiting for message'));
            }, timeout);

            node.on('input', (msg: NodeRedMessage) => {
                clearTimeout(timer);
                resolve(msg);
            });
        });
    },

    /**
     * Verify that a message has expected properties
     */
    verifyMessage: (msg: NodeRedMessage, expectedProps: Record<string, any> = {}): void => {
        const should = require('should');
        should.exist(msg);

        Object.keys(expectedProps).forEach((prop) => {
            if (expectedProps[prop] !== undefined) {
                (msg as any).should.have.property(prop, expectedProps[prop]);
            }
        });
    },
};

export {
    createMockNodeRED,
    createMockImap,
    createMockMailparser,
    setupModuleMocks,
    testConfigs,
    testFlows,
    testUtils,
    MockImap,
    // Type exports
    type NodeRedMessage,
    type NodeRedNode,
    type NodeRedConfig,
    type MockNodeRedOptions,
    type MockNodeRED,
    type ImapConfig,
    type IMockImap,
    type ParsedEmail,
    type MockMailparser,
    type TestConfig,
    type TestFlow,
};