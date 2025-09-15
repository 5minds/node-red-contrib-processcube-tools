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

            // ARRANGE: Initialisiere mockNodemailer
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
                console.log('Check done - Error:', errorHandlerCalled, 'Status:', redStatusSet);
                if (errorHandlerCalled && redStatusSet) {
                    done();
                }
            }

            // Explizit shouldFail auf true setzen
            const mockOptions = { shouldFail: true };
            console.log('Creating mock with options:', mockOptions); // Debug log

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
                    console.log('Status received:', status);
                    if (status.fill === 'red' && status.text === 'error sending') {
                        redStatusSet = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    console.log('Error received:', err);
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
                console.log('checkDone called - attachmentsChecked:', attachmentsChecked, 'statusSet:', statusSet);
                if (attachmentsChecked && statusSet) {
                    console.log('Both conditions met, calling done');
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
            console.log('Test attachments configured');

            const mockNodemailer = createMockNodemailer({
                onSendMail: (mailOptions) => {
                    console.log('onSendMail called with attachments:', mailOptions.attachments);
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(2);
                    expect(mailOptions.attachments[0].filename).to.equal('test1.txt');
                    expect(mailOptions.attachments[1].content).to.equal('This is the second test file.');
                    attachmentsChecked = true;
                    console.log('Attachments checked successfully');
                    checkDone();
                },
            });
            console.log('Mock nodemailer created');

            // Mock the nodemailer module
            delete require.cache[require.resolve('nodemailer')];
            require.cache[require.resolve('nodemailer')] = {
                exports: mockNodemailer,
            };
            console.log('Nodemailer mock installed');

            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    console.log('onHandler called with event:', event);
                    if (event === 'input') {
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    console.log('statusHandler called with status:', status);
                    if (status.fill === 'green') {
                        expect(status.text).to.include('sent');
                        expect(status.shape).to.equal('dot');
                        statusSet = true;
                        console.log('Status set successfully');
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    console.log('errorHandler called with:', err);
                    done(err || new Error('Unexpected error handler called'));
                },
            });

            const emailSenderNode = require('../../email-sender/email-sender.js');
            emailSenderNode(mockRED);
            console.log('Email sender node initialized');

            const config = { ...emailSenderConfigs.valid };
            config.attachments = JSON.stringify(attachments);
            config.attachmentsType = 'json';

            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(config);
            console.log('Node instance created');

            setTimeout(() => {
                nodeInstance.inputCallback({
                    payload: 'test',
                    topic: 'test message',
                });
            }, 100);
        });

        it('should log a warning for malformed attachments', function (done) {
            let warningLogged = false;
            let emailSent = false;

            function checkDone() {
                if (warningLogged && emailSent) {
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
                    if (status.fill === 'green') {
                        emailSent = true;
                        checkDone();
                    }
                },
                errorHandler: function (err) {
                    done(err || new Error('Unexpected error handler called'));
                },
                logWarn: function (msg) {
                    expect(msg).to.equal(
                        "Attachment object is missing 'filename' or 'content' property and will be ignored.",
                    );
                    warningLogged = true;
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
    });
});
