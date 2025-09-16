const { expect } = require('chai');
const {
    createMockNodeRED,
    setupModuleMocks,
    emailSenderConfigs,
    createMockNodemailer,
} = require('../helpers/email-sender.mocks.js');

describe('E-Mail Sender Node Unit Tests', function () {
    this.timeout(10000);

    let emailSenderNode;
    let cleanupMocks;

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
            const mockRED = createMockNodeRED();

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
            let createdNode = null;
            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    createdNode = this;
                },
            });

            // ACT: Register and create node instance
            emailSenderNode(mockRED);
            new mockRED.nodes.lastRegisteredConstructor(emailSenderConfigs.valid);

            // ASSERT: Verify node was created with correct properties
            expect(createdNode).to.exist;
            expect(createdNode).to.have.property('name', emailSenderConfigs.valid.name);
            expect(createdNode).to.have.property('id', emailSenderConfigs.valid.id);
        });

        it('should handle minimal config', function () {
            // ARRANGE: Use minimal test config
            let createdNode = null;
            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    createdNode = this;
                },
            });

            // ACT: Register and create node with minimal config
            emailSenderNode(mockRED);
            new mockRED.nodes.lastRegisteredConstructor(emailSenderConfigs.minimal);

            // ASSERT: Verify node creation
            expect(createdNode).to.exist;
            expect(createdNode).to.have.property('id', emailSenderConfigs.minimal.id);
        });
    });

    describe('Node Functionality', function () {
        beforeEach(function () {
            // Clear the module cache BEFORE requiring anything
            delete require.cache[require.resolve('nodemailer')];
        });

        afterEach(function () {
            delete require.cache[require.resolve('nodemailer')];
        });

        it('should send email successfully and set status to "sent"', function (done) {
            let statusSet = false;

            // ARRANGE: Initialize mockNodemailer
            const mockNodemailer = createMockNodemailer();

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            // ARRANGE: Create mock Node-RED environment
            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        expect(status.shape).to.equal('dot');
                        statusSet = true;
                        done();
                    }
                },
                errorHandler: function (err) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            // ACT: Initialize the email sender node
            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid);

            nodeInstance.inputCallback({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle sendMail error and set status to "error sending"', function (done) {
            let errorHandlerCalled = false;
            let redStatusSet = false;

            function checkDone() {
                if (errorHandlerCalled && redStatusSet) {
                    done();
                }
            }

            // Explicitly set shouldFail to true
            const mockOptions = { shouldFail: true };
            const mockNodemailer = createMockNodemailer(mockOptions);

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'red' && status.text === 'error sending') {
                        redStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    expect(err.message).to.equal('Mock sendMail error');
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid);

            nodeInstance.inputCallback({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle an array of attachments correctly', function (done) {
            let attachmentsChecked = false;
            let statusSet = false;

            function checkDone() {
                if (attachmentsChecked && statusSet) {
                    done();
                }
            }

            // ARRANGE: Configure test attachments
            const attachments = [
                {
                    filename: 'test1.txt',
                    content: 'This is the first test file.',
                },
                {
                    filename: 'test2.txt',
                    content: 'This is the second test file.',
                },
            ];

            const mockNodemailer = createMockNodemailer({
                onSendMail: (mailOptions) => {
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(2);
                    expect(mailOptions.attachments[0].filename).to.equal('test1.txt');
                    expect(mailOptions.attachments[1].content).to.equal('This is the second test file.');
                    attachmentsChecked = true;
                    checkDone();
                },
            });

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        expect(status.shape).to.equal('dot');
                        statusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config = { ...emailSenderConfigs.valid };
            config.attachments = JSON.stringify(attachments);
            config.attachmentsType = 'json';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(config);

            setTimeout(() => {
                nodeInstance.inputCallback({
                    payload: 'test',
                    topic: 'test message',
                });
            }, 100);
        });

        it('should throw error for malformed attachments', function (done) {
            let errorHandlerCalled = false;
            let redStatusSet = false;

            function checkDone() {
                if (errorHandlerCalled && redStatusSet) {
                    done();
                }
            }

            // ARRANGE: Configure the node with a JSON string containing a malformed attachment
            const malformedAttachments = [
                {
                    filename: 'test.txt',
                    content: 'This is a test file.',
                },
                {
                    // Malformed attachment with missing content
                    filename: 'invalid.txt',
                },
            ];

            const mockNodemailer = createMockNodemailer();

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'red') {
                        redStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    expect(err).to.equal("Attachment object is missing 'filename' or 'content' property.");
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config = { ...emailSenderConfigs.valid };
            config.attachments = JSON.stringify(malformedAttachments);
            config.attachmentsType = 'json';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(config);

            nodeInstance.inputCallback({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle rejected emails and set status to rejected', function (done) {
            let errorHandlerCalled = false;
            let redStatusSet = false;

            function checkDone() {
                if (errorHandlerCalled && redStatusSet) {
                    done();
                }
            }

            // ARRANGE: Configure mock to simulate rejected emails
            const mockOptions = {
                rejectedEmails: ['recipient@example.com'],
                acceptedEmails: [] // Ensure no emails are accepted
            };

            const mockNodemailer = createMockNodemailer(mockOptions);

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'red' && status.text === 'rejected') {
                        redStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    expect(err.message).to.include('Email rejected: recipient@example.com');
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid);

            nodeInstance.inputCallback({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle pending emails and set status to pending', function (done) {
            let errorHandlerCalled = false;
            let yellowStatusSet = false;

            function checkDone() {
                if (errorHandlerCalled && yellowStatusSet) {
                    done();
                }
            }

            // ARRANGE: Configure mock to simulate pending emails
            const mockOptions = {
                pendingEmails: ['recipient@example.com'],
                acceptedEmails: [] // Ensure no emails are accepted
            };

            const mockNodemailer = createMockNodemailer(mockOptions);

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'yellow' && status.text === 'pending') {
                        yellowStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    expect(err.message).to.include('Email pending: recipient@example.com');
                    errorHandlerCalled = true;
                    checkDone();
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid);

            nodeInstance.inputCallback({
                payload: 'test',
                topic: 'test message',
            });
        });

        it('should handle a single attachment object correctly', function (done) {
            let attachmentChecked = false;
            let statusSet = false;

            function checkDone() {
                if (attachmentChecked && statusSet) {
                    done();
                }
            }

            // ARRANGE: Configure test with single attachment object
            const singleAttachment = {
                filename: 'single-test.txt',
                content: 'This is a single test file.',
            };

            const mockNodemailer = createMockNodemailer({
                onSendMail: (mailOptions) => {
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(1);
                    expect(mailOptions.attachments[0].filename).to.equal('single-test.txt');
                    expect(mailOptions.attachments[0].content).to.equal('This is a single test file.');
                    attachmentChecked = true;
                    checkDone();
                },
            });

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        expect(status.shape).to.equal('dot');
                        statusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config = { ...emailSenderConfigs.valid };
            config.attachments = JSON.stringify(singleAttachment);
            config.attachmentsType = 'json';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(config);

            setTimeout(() => {
                nodeInstance.inputCallback({
                    payload: 'test',
                    topic: 'test message',
                });
            }, 100);
        });

        it('should handle an empty attachments string without error', function (done) {
            let statusSet = false;

            // ARRANGE: Create mock nodemailer to verify no attachments are processed
            const mockNodemailer = createMockNodemailer({
                onSendMail: (mailOptions) => {
                    // Should be an empty array when no attachments are provided
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(0);
                },
            });

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        expect(status.shape).to.equal('dot');
                        statusSet = true;
                        done();
                    }
                },
                errorHandler: function (err) {
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);

            const config = { ...emailSenderConfigs.valid };
            // Set attachments to empty string to test this scenario
            config.attachments = '';
            config.attachmentsType = 'str';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(config);

            setTimeout(() => {
                nodeInstance.inputCallback({
                    payload: 'test',
                    topic: 'test message',
                });
            }, 100);
        });
    });
});