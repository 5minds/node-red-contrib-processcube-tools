import { expect } from 'chai';
import {
    createMockNodeRED,
    setupModuleMocks,
    emailSenderConfigs,
    createMockNodemailer,
    MockNodeRED,
    MockNodemailer,
    EmailSenderConfig
} from '../helpers/email-sender.mocks';

// Type definitions for the test environment
interface NodeInstance {
    name?: string;
    id: string;
    inputCallback?: ((msg: any) => void) | undefined;
    [key: string]: any;
}

interface MockREDOptions {
    onHandler?: (event: string, callback: Function) => void;
    statusHandler?: (status: { fill: string; text: string; shape?: string }) => void;
    errorHandler?: (err: any) => void;
}

interface MessagePayload {
    payload: string;
    topic: string;
    [key: string]: any;
}

interface AttachmentObject {
    filename: string;
    content?: string;
    [key: string]: any;
}

describe('E-Mail Sender Node - Unit Tests', function () {
    this.timeout(10000);

    let emailSenderNode: (RED: MockNodeRED) => void;
    let cleanupMocks: (() => void) | undefined;

    before(function () {
        // Set up module mocks using helper
        cleanupMocks = setupModuleMocks();

        // Load the node with mocked dependencies
        emailSenderNode = require('../../email-sender/email-sender.js');
    });

    after(function () {
        // Clean up mocks
        if (cleanupMocks) {
            cleanupMocks();
        }
    });

    // A separate describe block for module export
    describe('Module Export', function () {
        it('should export a function', function () {
            expect(emailSenderNode).to.be.a('function');
        });
    });

    describe('Node Registration', function () {
        it('should register node type without errors', function () {
            // ARRANGE: Create mock Node-RED with tracking
            const mockRED: MockNodeRED = createMockNodeRED();

            // ACT: Register the node
            emailSenderNode(mockRED);

            // ASSERT: Verify registration
            expect(mockRED.nodes.lastRegisteredType).to.equal('email-sender');
            expect(mockRED.nodes.lastRegisteredConstructor).to.be.a('function');
        });
    });

    describe('Node Instantiation', function () {
        it('should handle node instantiation with valid config', function () {
            // ARRANGE: Track node creation
            let createdNode: NodeInstance | null = null;
            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    createdNode = this;
                },
            });

            // ACT: Register and create node instance
            emailSenderNode(mockRED);
            new mockRED.nodes.lastRegisteredConstructor!(emailSenderConfigs.valid);

            // ASSERT: Verify node was created with correct properties
            expect(createdNode).to.exist;
            expect(createdNode).to.have.property('name', emailSenderConfigs.valid.name);
            expect(createdNode).to.have.property('id', emailSenderConfigs.valid.id);
        });

        it('should handle minimal config', function () {
            // ARRANGE: Use minimal test config
            let createdNode: NodeInstance | null = null;
            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    createdNode = this;
                },
            });

            // ACT: Register and create node with minimal config
            emailSenderNode(mockRED);
            new mockRED.nodes.lastRegisteredConstructor!(emailSenderConfigs.minimal);

            // ASSERT: Verify node creation
            expect(createdNode).to.exist;
            expect(createdNode).to.have.property('id', emailSenderConfigs.minimal.id);
        });
    });

    describe('Node Functionality', function () {
        beforeEach(function () {
            // Clear the module cache BEFORE requiring anything
            delete (require.cache as any)[require.resolve('nodemailer')];
        });

        afterEach(function () {
            delete (require.cache as any)[require.resolve('nodemailer')];
        });

        it('should send email successfully and set status to "sent"', function (done: Mocha.Done) {
            let statusSet = false;

            // ARRANGE: Initialize mockNodemailer
            const mockNodemailer: MockNodemailer = createMockNodemailer();

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            // ARRANGE: Create mock Node-RED environment
            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        if (status.shape) {
                            expect(status.shape).to.equal('dot');
                        }
                        statusSet = true;
                        done();
                    }
                },
                errorHandler: function (err: Error) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            // ACT: Initialize the email sender node
            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid) as NodeInstance;

            nodeInstance.inputCallback!({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle sendMail error and set status to "error sending"', function (done: Mocha.Done) {
            let errorHandlerCalled = false;
            let redStatusSet = false;

            function checkDone(): void {
                if (errorHandlerCalled && redStatusSet) {
                    done();
                }
            }

            // Explicitly set shouldFail to true
            const mockOptions = { shouldFail: true };
            const mockNodemailer: MockNodemailer = createMockNodemailer(mockOptions);

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'red' && status.text === 'error sending') {
                        redStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err: Error) {
                    expect(err.message).to.equal('Mock sendMail error');
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid) as NodeInstance;

            nodeInstance.inputCallback!({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle an array of attachments correctly', function (done: Mocha.Done) {
            let attachmentsChecked = false;
            let statusSet = false;

            function checkDone(): void {
                if (attachmentsChecked && statusSet) {
                    done();
                }
            }

            // ARRANGE: Configure test attachments
            const attachments: AttachmentObject[] = [
                {
                    filename: 'test1.txt',
                    content: 'This is the first test file.',
                },
                {
                    filename: 'test2.txt',
                    content: 'This is the second test file.',
                },
            ];

            const mockNodemailer: MockNodemailer = createMockNodemailer({
                onSendMail: (mailOptions: any) => {
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(2);
                    expect(mailOptions.attachments[0].filename).to.equal('test1.txt');
                    expect(mailOptions.attachments[1].content).to.equal('This is the second test file.');
                    attachmentsChecked = true;
                    checkDone();
                },
            });

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        if (status.shape) {
                            expect(status.shape).to.equal('dot');
                        }
                        statusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err: Error) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config: EmailSenderConfig = { ...emailSenderConfigs.valid };
            config.attachments = JSON.stringify(attachments);
            config.attachmentsType = 'json';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(config) as NodeInstance;

            setTimeout(() => {
                nodeInstance.inputCallback!({
                    payload: 'test',
                    topic: 'test message',
                });
            }, 100);
        });

        it('should throw error for malformed attachments', function (done: Mocha.Done) {
            let errorHandlerCalled = false;
            let redStatusSet = false;

            function checkDone(): void {
                if (errorHandlerCalled && redStatusSet) {
                    done();
                }
            }

            // ARRANGE: Configure the node with a JSON string containing a malformed attachment
            const malformedAttachments: Partial<AttachmentObject>[] = [
                {
                    filename: 'test.txt',
                    content: 'This is a test file.',
                },
                {
                    // Malformed attachment with missing content
                    filename: 'invalid.txt',
                },
            ];

            const mockNodemailer: MockNodemailer = createMockNodemailer();

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'red') {
                        redStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err: string | Error) {
                    expect(err).to.equal("Attachment object is missing 'filename' or 'content' property.");
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config: EmailSenderConfig = { ...emailSenderConfigs.valid };
            config.attachments = JSON.stringify(malformedAttachments);
            config.attachmentsType = 'json';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(config) as NodeInstance;

            nodeInstance.inputCallback!({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle rejected emails and set status to rejected', function (done: Mocha.Done) {
            let errorHandlerCalled = false;
            let redStatusSet = false;

            function checkDone(): void {
                if (errorHandlerCalled && redStatusSet) {
                    done();
                }
            }

            // ARRANGE: Configure mock to simulate rejected emails
            const mockOptions = {
                rejectedEmails: ['recipient@example.com'],
                acceptedEmails: [], // Ensure no emails are accepted
            };

            const mockNodemailer: MockNodemailer = createMockNodemailer(mockOptions);

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'red' && status.text === 'rejected') {
                        redStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err: Error) {
                    expect(err.message).to.include('Email rejected: recipient@example.com');
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid) as NodeInstance;

            nodeInstance.inputCallback!({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle pending emails and set status to pending', function (done: Mocha.Done) {
            let errorHandlerCalled = false;
            let yellowStatusSet = false;

            function checkDone(): void {
                if (errorHandlerCalled && yellowStatusSet) {
                    done();
                }
            }

            // ARRANGE: Configure mock to simulate pending emails
            const mockOptions = {
                pendingEmails: ['recipient@example.com'],
                acceptedEmails: [], // Ensure no emails are accepted
            };

            const mockNodemailer: MockNodemailer = createMockNodemailer(mockOptions);

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'yellow' && status.text === 'pending') {
                        yellowStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err: Error) {
                    expect(err.message).to.include('Email pending: recipient@example.com');
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid) as NodeInstance;

            nodeInstance.inputCallback!({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle a single attachment object correctly', function (done: Mocha.Done) {
            let attachmentChecked = false;
            let statusSet = false;

            function checkDone(): void {
                if (attachmentChecked && statusSet) {
                    done();
                }
            }

            // ARRANGE: Configure test with single attachment object
            const singleAttachment: AttachmentObject = {
                filename: 'single-test.txt',
                content: 'This is a single test file.',
            };

            const mockNodemailer: MockNodemailer = createMockNodemailer({
                onSendMail: (mailOptions: any) => {
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(1);
                    expect(mailOptions.attachments[0].filename).to.equal('single-test.txt');
                    expect(mailOptions.attachments[0].content).to.equal('This is a single test file.');
                    attachmentChecked = true;
                    checkDone();
                },
            });

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        if (status.shape) {
                            expect(status.shape).to.equal('dot');
                        }
                        statusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err: Error) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config: EmailSenderConfig = { ...emailSenderConfigs.valid };
            config.attachments = JSON.stringify(singleAttachment);
            config.attachmentsType = 'json';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(config) as NodeInstance;

            setTimeout(() => {
                nodeInstance.inputCallback!({
                    payload: 'test',
                    topic: 'test message',
                });
            }, 100);
        });

        it('should handle an empty attachments string without error', function (done: Mocha.Done) {
            let statusSet = false;

            // ARRANGE: Create mock nodemailer to verify no attachments are processed
            const mockNodemailer: MockNodemailer = createMockNodemailer({
                onSendMail: (mailOptions: any) => {
                    // Should be an empty array when no attachments are provided
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(0);
                },
            });

            // Mock the nodemailer module
            delete (require.cache as any)[require.resolve('nodemailer')];
            (require.cache as any)[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED: MockNodeRED = createMockNodeRED({
                onHandler: function (this: NodeInstance, event: string, callback: Function) {
                    if (event === 'input') {
                        this.inputCallback = callback as (msg: any) => void;
                    }
                },
                statusHandler: function (status: { fill: string; text: string; shape?: string }) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        if (status.shape) {
                            expect(status.shape).to.equal('dot');
                        }
                        statusSet = true;
                        done();
                    }
                },
                errorHandler: function (err: Error) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config: EmailSenderConfig = { ...emailSenderConfigs.valid };
            // Set attachments to empty string to test this scenario
            config.attachments = '';
            config.attachmentsType = 'str';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor!;
            const nodeInstance = new nodeConstructor(config) as NodeInstance;

            setTimeout(() => {
                nodeInstance.inputCallback!({
                    payload: 'test',
                    topic: 'test message',
                });
            }, 100);
        });
    });
});