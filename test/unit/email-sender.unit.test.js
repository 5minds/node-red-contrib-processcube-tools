const { expect } = require('chai');
const nodemailer = require('nodemailer');
const { createMockNodeRED, setupModuleMocks, emailSenderConfigs } = require('../helpers/email-sender.mocks.js');

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

    // A separate describe block for the node's core functionality
    describe('Node Functionality', function () {
        it('should send email successfully and set status to "sent"', function (done) {
            let mockNodemailer;

            // Before each test, apply the mock
            beforeEach(function () {
                mockNodemailer = createMockNodemailer(nodemailer);
            });

            // After each test, restore the original function
            afterEach(function () {
                delete require.cache[require.resolve('nodemailer')];
            });

            // ARRANGE: Mock a successful email send
            const mockRED = createMockNodeRED({
                onHandler: function (event, callback) {
                    if (event === 'input') {
                        // Store the callback on the node instance
                        this.inputCallback = callback;
                    }
                },
                statusHandler: function (status) {
                    // ASSERT: Check that status is set to "sent"
                    if (status.fill === 'green') {
                        // Connection succeded status
                        expect(status.text).to.include('sent');
                        except(status.shape).to.equal('dot');

                        // ASSERT: Use the mock to verify an email was sent
                        const sentEmails = mockNodemailer.getSentEmails();
                        expect(sentEmails).to.have.lengthOf(1);
                        expect(sentEmails[0].to).to.equal(emailSenderConfigs.valid.to);
                        expect(sentEmails[0].subject).to.equal(emailSenderConfigs.valid.subject);

                        done();
                    }
                },
                errorHandler: function (err) {
                    // There should be no errors in this test
                    expect(err).to.be.undefined;
                    done(err);
                },
            });

            // ACT: Simulate an incoming message to trigger the node
            emailSenderNode(mockRED);
            const nodeConstructor = mockRED.nodes.lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(emailSenderConfigs.valid);

            // Trigger the error by sending an input message
            // Use a small delay to ensure the constructor has completed
            setTimeout(() => {
                if (nodeInstance.inputCallback) {
                    nodeInstance.inputCallback({ payload: 'test' });
                } else {
                    done(new Error('inputCallback was not set on the node instance'));
                }
            }, 10);
        });

        it('should handle sendMail error and set status to "error sending"', function (done) {
            // ARRANGE: Mock a failed email send with a specific error
            mockTransporterSendMail(null, new Error('Mock sendMail error'));

            // ACT: Simulate an incoming message
            node.emit('input', getMockMsg(), node.send, (err) => {
                // ASSERT
                err.should.be.an('error');
                err.message.should.equal('Mock sendMail error');
                node.status.calledWith({ fill: 'red', shape: 'dot', text: 'error sending' }).should.be.true;
                done();
            });
        });

        it('should handle an array of attachments correctly', function (done) {
            // ARRANGE: Configure the node with a JSON string of attachments
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
            config.attachments = JSON.stringify(attachments);
            config.attachmentsType = 'json';

            // ACT: Listen for the 'input' event to check the mock transport
            node.on('input', (msg, send, errorHandler) => {
                const mockTransport = getMockTransport();
                // ASSERT
                mockTransport.mailOptions.attachments.should.be.an('array').with.lengthOf(2);
                mockTransport.mailOptions.attachments[0].filename.should.equal('test1.txt');
                mockTransport.mailOptions.attachments[1].content.should.equal('This is the second test file.');
                done();
            });

            // Simulate an incoming message
            node.emit('input', getMockMsg(), node.send, (err) => {});
        });

        it('should log a warning for malformed attachments', function (done) {
            // ARRANGE: Configure the node with a JSON string containing a malformed attachment
            const attachments = [
                {
                    filename: 'test.txt',
                    content: 'This is a test file.',
                },
                {
                    // Malformed attachment with missing content
                    filename: 'invalid.txt',
                },
            ];
            config.attachments = JSON.stringify(attachments);
            config.attachmentsType = 'json';

            // ACT: Mock the warn function to check for the expected warning message
            node.warn = (message) => {
                // ASSERT
                message.should.include("Attachment object is missing 'filename' or 'content'");
                done();
            };

            // Simulate an incoming message
            node.emit('input', getMockMsg(), node.send, (err) => {});
        });
    });
});
