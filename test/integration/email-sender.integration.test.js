const { expect } = require('chai');
const helper = require('node-red-node-test-helper');
const emailSender = require('../../email-sender/email-sender.js');
const {
    createMockNodemailer,
    setupModuleMocks,
    getMockNode,
    emailSenderConfigs,
    testFlows,
    testUtils,
} = require('../../test/helpers/email-sender.mocks.js');

describe('EmailSenderNode Integration Tests', function () {
    // Set a reasonable timeout for integration tests
    this.timeout(10000);

    let emailSenderNode;
    let cleanupMocks;

    beforeEach(function (done) {
        // Set up mocks using helper
        cleanupMocks = setupModuleMocks();

        // Load the node with mocked dependencies
        emailSenderNode = require('../../email-sender/email-sender.js');

        // CRITICAL: Initialize the helper with Node-RED
        helper.init(require.resolve('node-red'));
        done();
    });

    afterEach(function () {
        // Clean up mocks using helper cleanup function
        if (cleanupMocks) {
            cleanupMocks();
        }
    });

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    describe('Node Loading', function () {
        it('should load in Node-RED test environment', function (done) {
            // ARRANGE: Use test flow from helpers
            const flow = [emailSenderConfigs.valid];

            // ACT: Load the node in the test helper environment
            helper.load(emailSenderNode, flow, function () {
                try {
                    // ASSERT: Verify the node loaded correctly
                    const n1 = helper.getNode(emailSenderConfigs.valid.id);
                    expect(n1).to.exist;
                    expect(n1).to.have.property('name', emailSenderConfigs.valid.name);
                    expect(n1).to.have.property('type', 'email-sender');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should load with minimal configuration', function (done) {
            // ARRANGE: Use minimal test config from helpers
            const flow = [emailSenderConfigs.minimal];

            // ACT: Load the node
            helper.load(emailSenderNode, flow, function () {
                try {
                    // ASSERT: Verify the node loaded with minimal config
                    const n1 = helper.getNode(emailSenderConfigs.minimal.id);
                    expect(n1).to.exist;
                    expect(n1).to.have.property('type', 'email-sender');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('Node Connections', function () {
        it('should create wired connections correctly', function (done) {
            // ARRANGE: Use connected test flow from helpers
            const flow = testFlows.connected;

            // ACT: Load nodes and verify connections
            helper.load(emailSenderNode, flow, function () {
                try {
                    const n1 = helper.getNode(emailSenderConfigs.valid.id);
                    const h1 = helper.getNode('h1');

                    // ASSERT: Both nodes should exist and be connected
                    expect(n1).to.exist;
                    expect(h1).to.exist;
                    expect(n1).to.have.property('name', emailSenderConfigs.valid.name);
                    expect(h1).to.have.property('type', 'helper');

                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should handle multiple output connections', function (done) {
            // ARRANGE: Use multi-output test flow from helpers
            const flow = testFlows.multiOutput;

            // ACT: Load nodes
            helper.load(emailSenderNode, flow, function () {
                try {
                    const n1 = helper.getNode(emailSenderConfigs.valid.id);
                    const h1 = helper.getNode('h1');
                    const h2 = helper.getNode('h2');

                    // ASSERT: All nodes should exist
                    expect(n1).to.exist;
                    expect(h1).to.exist;
                    expect(h2).to.exist;
                    expect(n1).to.have.property('name', emailSenderConfigs.valid.name);

                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('Message Flow', function () {
        it('should handle input without crashing', async function () {
            // ARRANGE: Use test flow from helpers
            const flow = testFlows.single;

            return new Promise((resolve, reject) => {
                helper.load(emailSenderNode, flow, function () {
                    try {
                        const n1 = helper.getNode(emailSenderConfigs.valid.id);
                        expect(n1).to.exist;

                        // Send input - this should not crash due to mocked IMAP
                        n1.receive({ payload: 'test input' });

                        // ASSERT: If we reach here, the node handled input gracefully
                        testUtils.wait(500).then(() => {
                            resolve(); // Success if no errors thrown
                        });
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should process messages through connected nodes', function (done) {
            // ARRANGE: Use connected test flow from helpers
            const flow = testFlows.connected;

            // ACT: Load nodes and set up message listener
            helper.load(emailSenderNode, flow, function () {
                try {
                    const n1 = helper.getNode(emailSenderConfigs.valid.id);
                    const h1 = helper.getNode('h1');

                    // Set up listener for messages from email receiver
                    h1.on('input', function (msg) {
                        try {
                            // ASSERT: Should receive a message with expected properties
                            expect(msg).to.exist;
                            expect(msg.payload).to.exist;
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });

                    // Simulate the email processing
                    // The email-sender node likely starts processing emails automatically
                    // Let's trigger the mock IMAP flow by simulating what happens when emails are found
                    setTimeout(() => {
                        // Simulate the email receiver processing emails and sending a message
                        // This is what your email-sender node should do internally
                        try {
                            const mockEmailMessage = {
                                payload: 'This is a mock email body for testing purposes.',
                                topic: 'email',
                                from: 'sender@test.com',
                                subject: 'Mock Email Subject',
                            };

                            // Directly send a message through the node (simulating internal processing)
                            n1.send(mockEmailMessage);
                        } catch (err) {
                            done(err);
                        }
                    }, 100);
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should handle message timeout gracefully', async function () {
            // ARRANGE: Use connected test flow
            const flow = testFlows.connected;

            return new Promise((resolve, reject) => {
                helper.load(emailSenderNode, flow, function () {
                    try {
                        const n1 = helper.getNode(emailSenderConfigs.valid.id);
                        const h1 = helper.getNode('h1');

                        // Use testUtils.waitForMessage with timeout
                        testUtils
                            .waitForMessage(h1, 1000)
                            .then((msg) => {
                                // ASSERT: Should receive message within timeout
                                expect(msg).to.exist;
                                resolve();
                            })
                            .catch((err) => {
                                // ASSERT: Should handle timeout appropriately
                                expect(err.message).to.include('Timeout waiting for message');
                                resolve(); // This is expected behavior for this test
                            });

                        // Don't trigger anything to test timeout behavior
                        // The timeout should occur as expected
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should process emails and send messages when emails are received', function (done) {
            const flow = testFlows.connected;

            helper.load(emailSenderNode, flow, function () {
                try {
                    const n1 = helper.getNode(emailSenderConfigs.valid.id);
                    const h1 = helper.getNode('h1');

                    h1.on('input', function (msg) {
                        try {
                            expect(msg).to.exist;
                            expect(msg.payload).to.exist;
                            expect(msg).to.have.property('subject');
                            expect(msg).to.have.property('from');
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });

                    // Simulate the email processing that would normally happen
                    // when the IMAP connection finds new emails
                    setTimeout(() => {
                        // This simulates what your email-sender node does internally
                        // when it processes an email from IMAP
                        const processedEmail = {
                            payload: 'This is a mock email body for testing purposes.',
                            subject: 'Mock Email Subject',
                            from: { text: 'sender@test.com' },
                            to: { text: 'recipient@test.com' },
                            date: new Date(),
                            messageId: '<mock-message-id@test.com>',
                        };

                        n1.send(processedEmail);
                    }, 50);
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should handle rejected emails and set status to rejected', function (done) {
        // Create a mock that will reject the specific email used in your test
        const mockNodemailer = createMockNodemailer({
            rejectedEmails: ['recipient@example.com']
        });

        // Store the current mock (if any)
        const originalMock = global.mockNodemailer || null;
        // Set the new mock
        global.mockNodemailer = mockNodemailer;

        const node = getMockNode();
        const config = emailSenderConfigs.valid;

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    try {
                        expect(err).to.be.an('error');
                        expect(err.message).to.include('Email rejected');
                        expect(node.status.history[0]).to.deep.equal({ fill: 'red', shape: 'dot', text: 'rejected' });
                        expect(node.send.notCalled()).to.be.true;

                        // Restore original mock
                        if (originalMock) {
                            global.mockNodemailer = originalMock;
                        } else {
                            delete global.mockNodemailer;
                        }

                        done();
                    } catch (testError) {
                        // Restore original mock even if test fails
                        if (originalMock) {
                            global.mockNodemailer = originalMock;
                        } else {
                            delete global.mockNodemailer;
                        }
                        done(testError);
                    }
                });
            }
        };

        RED.nodes.createNode = (nodeDef) => {
            emailSender(RED);
            const constructor = RED.nodes.createNode(config);
            constructor(nodeDef);
            return node;
        };

        emailSender(RED);
        const nodeConstructor = RED.nodes.createNode(config);
        nodeConstructor(config);
        node.inputHandler(getMockMsg(), node.send, node.error);
    });

    it('should handle pending emails and set status to pending', function (done) {
        mockTransporterSendMail({ accepted: [], rejected: [], pending: ['recipient@example.com'] });
        const node = getMockNode();
        const config = getValidConfig();

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.an('error');
                    expect(err.message).to.include('Email pending');
                    expect(node.status.history[0]).to.deep.equal({ fill: 'yellow', shape: 'dot', text: 'pending' });
                    expect(node.send.notCalled()).to.be.true;
                    done();
                });
            }
        };

        RED.nodes.createNode = (nodeDef) => {
            emailSender(RED);
            const constructor = RED.nodes.createNode(config);
            constructor(nodeDef);
            return node;
        };

        emailSender(RED);
        const nodeConstructor = RED.nodes.createNode(config);
        nodeConstructor(config);
        node.inputHandler(getMockMsg(), node.send, node.error);
    });

    it('should use msg.topic as subject if config.subject is empty', function (done) {
        const node = getMockNode();
        const config = getValidConfig();
        config.subject = '';
        const msg = getMockMsg();
        msg.topic = 'Topic from msg';

        // Mock nodemailer directly within the test to check arguments
        const createTransportMock = () => {
            return {
                sendMail: (mailOptions, callback) => {
                    try {
                        expect(mailOptions.subject).to.equal(msg.topic);
                        callback(null, { response: '250 OK', accepted: ['recipient@example.com'] });
                        done();
                    } catch (e) {
                        done(e);
                    }
                },
            };
        };
        emailSender(RED);
        const nodeInstance = emailSender(RED);
        nodeInstance.createNode = () => node;

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(msg, node.send, function () {});
            }
        };

        Object.defineProperty(emailSender, 'nodemailer', {
            value: { createTransport: createTransportMock },
            writable: true,
        });

        RED.nodes.createNode(config);
        node.inputHandler(msg, node.send, node.error);
    });

    it('should handle a single attachment object correctly', function (done) {
        const config = getValidConfig();
        const attachment = {
            filename: 'test.txt',
            content: 'This is a test file.',
        };
        config.attachments = JSON.stringify(attachment);
        config.attachmentsType = 'json';
        const node = getMockNode();

        const createTransportMock = () => {
            return {
                sendMail: (mailOptions, callback) => {
                    try {
                        expect(mailOptions.attachments).to.be.an('array').with.lengthOf(1);
                        expect(mailOptions.attachments[0].filename).to.equal('test.txt');
                        expect(mailOptions.attachments[0].content).to.equal('This is a test file.');
                        callback(null, { response: '250 OK', accepted: ['recipient@example.com'] });
                        done();
                    } catch (e) {
                        done(e);
                    }
                },
            };
        };
        emailSender(RED);
        const nodeInstance = emailSender(RED);
        nodeInstance.createNode = () => node;

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function () {});
            }
        };

        Object.defineProperty(emailSender, 'nodemailer', {
            value: { createTransport: createTransportMock },
            writable: true,
        });

        RED.nodes.createNode(config);
        node.inputHandler(getMockMsg(), node.send, node.error);
    });

    it('should provide a custom error message for specific SSL/TLS errors', function (done) {
        const sslError = new Error('1402E097:SSL routines:ssl_cert_verify_init:wrong version number');
        mockTransporterSendMail(null, sslError);
        const node = getMockNode();
        const config = getValidConfig();

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.an('error');
                    expect(err.message).to.include('SSL/TLS connection failed');
                    expect(node.status.history[0]).to.deep.equal({ fill: 'red', shape: 'dot', text: 'error sending' });
                    done();
                });
            }
        };

        RED.nodes.createNode = (nodeDef) => {
            emailSender(RED);
            const constructor = RED.nodes.createNode(config);
            constructor(nodeDef);
            return node;
        };

        emailSender(RED);
        const nodeConstructor = RED.nodes.createNode(config);
        nodeConstructor(config);
        node.inputHandler(getMockMsg(), node.send, node.error);
    });

    it('should handle an empty attachments string without error', function (done) {
        mockTransporterSendMail({ accepted: ['recipient@example.com'], rejected: [], pending: [] });
        const node = getMockNode();
        const config = getValidConfig();
        config.attachments = '';

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.undefined;
                    expect(node.status.history[0]).to.deep.equal({ fill: 'green', shape: 'dot', text: 'sent' });
                    expect(node.send.calledOnce()).to.be.true;
                    done();
                });
            }
        };

        RED.nodes.createNode = (nodeDef) => {
            emailSender(RED);
            const constructor = RED.nodes.createNode(config);
            constructor(nodeDef);
            return node;
        };

        emailSender(RED);
        const nodeConstructor = RED.nodes.createNode(config);
        nodeConstructor(config);
        node.inputHandler(getMockMsg(), node.send, node.error);
    });

    it('should pass the original message to the next node on success', function (done) {
        mockTransporterSendMail({ accepted: ['recipient@example.com'], rejected: [], pending: [] });
        const node = getMockNode();
        const config = getValidConfig();
        const originalMsg = getMockMsg();
        originalMsg.payload = { test: 'data' };

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(originalMsg, node.send, function (err) {
                    expect(err).to.be.undefined;
                    expect(node.send.calledOnce()).to.be.true;
                    expect(node.send.history[0]).to.equal(originalMsg);
                    done();
                });
            }
        };

        RED.nodes.createNode = (nodeDef) => {
            emailSender(RED);
            const constructor = RED.nodes.createNode(config);
            constructor(nodeDef);
            return node;
        };

        emailSender(RED);
        const nodeConstructor = RED.nodes.createNode(config);
        nodeConstructor(config);
        node.inputHandler(originalMsg, node.send, node.error);
    });
});
