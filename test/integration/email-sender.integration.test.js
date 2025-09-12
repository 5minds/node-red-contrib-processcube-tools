const { expect } = require('chai');
const emailSender = require('../../email-sender/email-sender.js');
const {
    getValidConfig,
    getMockNode,
    getMockMsg,
    mockTransporterSendMail,
    restoreTransporterMock,
    mockNodemailer
} = require('../../test/helpers/email-sender.mocks.js');

describe('EmailSenderNode Integration Tests', function () {
    let RED;

    beforeEach(function () {
        RED = {
            nodes: { createNode: () => {} },
            util: {
                evaluateNodeProperty: (value) => value
            }
        };
        // This is a direct mock of the `emailSender` module's nodemailer dependency.
        // It's a way to directly control the behavior of the external `nodemailer` module.
        // For this test, we are assuming that `emailSender.js` requires `nodemailer`.
        // We will directly inject our mock into the module's scope.
        Object.defineProperty(emailSender, 'nodemailer', {
            value: mockNodemailer,
            writable: true
        });
    });

    afterEach(function () {
        restoreTransporterMock();
    });

    it('should handle rejected emails and set status to rejected', function (done) {
        mockTransporterSendMail({ accepted: [], rejected: ["recipient@example.com"], pending: [] });
        const node = getMockNode();
        const config = getValidConfig();

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.an('error');
                    expect(err.message).to.include('Email rejected');
                    expect(node.status.history[0]).to.deep.equal({ fill: "red", shape: "dot", text: "rejected" });
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

    it('should handle pending emails and set status to pending', function (done) {
        mockTransporterSendMail({ accepted: [], rejected: [], pending: ["recipient@example.com"] });
        const node = getMockNode();
        const config = getValidConfig();

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.an('error');
                    expect(err.message).to.include('Email pending');
                    expect(node.status.history[0]).to.deep.equal({ fill: "yellow", shape: "dot", text: "pending" });
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
        config.subject = "";
        const msg = getMockMsg();
        msg.topic = "Topic from msg";

        // Mock nodemailer directly within the test to check arguments
        const createTransportMock = () => {
            return {
                sendMail: (mailOptions, callback) => {
                    try {
                        expect(mailOptions.subject).to.equal(msg.topic);
                        callback(null, { response: "250 OK", accepted: ["recipient@example.com"] });
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            };
        };
        emailSender(RED);
        const nodeInstance = emailSender(RED);
        nodeInstance.createNode = () => node;

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(msg, node.send, function () { });
            }
        };

        Object.defineProperty(emailSender, 'nodemailer', {
            value: { createTransport: createTransportMock },
            writable: true
        });

        RED.nodes.createNode(config);
        node.inputHandler(msg, node.send, node.error);
    });

    it('should handle a single attachment object correctly', function (done) {
        const config = getValidConfig();
        const attachment = {
            filename: "test.txt",
            content: "This is a test file."
        };
        config.attachments = JSON.stringify(attachment);
        config.attachmentsType = "json";
        const node = getMockNode();

        const createTransportMock = () => {
            return {
                sendMail: (mailOptions, callback) => {
                    try {
                        expect(mailOptions.attachments).to.be.an('array').with.lengthOf(1);
                        expect(mailOptions.attachments[0].filename).to.equal("test.txt");
                        expect(mailOptions.attachments[0].content).to.equal("This is a test file.");
                        callback(null, { response: "250 OK", accepted: ["recipient@example.com"] });
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            };
        };
        emailSender(RED);
        const nodeInstance = emailSender(RED);
        nodeInstance.createNode = () => node;

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function () { });
            }
        };

        Object.defineProperty(emailSender, 'nodemailer', {
            value: { createTransport: createTransportMock },
            writable: true
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
                    expect(err.message).to.include("SSL/TLS connection failed");
                    expect(node.status.history[0]).to.deep.equal({ fill: "red", shape: "dot", text: "error sending" });
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
        mockTransporterSendMail({ accepted: ["recipient@example.com"], rejected: [], pending: [] });
        const node = getMockNode();
        const config = getValidConfig();
        config.attachments = "";

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.undefined;
                    expect(node.status.history[0]).to.deep.equal({ fill: "green", shape: "dot", text: "sent" });
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
        mockTransporterSendMail({ accepted: ["recipient@example.com"], rejected: [], pending: [] });
        const node = getMockNode();
        const config = getValidConfig();
        const originalMsg = getMockMsg();
        originalMsg.payload = { test: "data" };

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
