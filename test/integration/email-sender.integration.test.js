const { expect } = require('chai');
const sinon = require('sinon');
const {
    getValidConfig,
    getMockNode,
    getMockMsg,
    mockTransporterSendMail,
    restoreTransporterMock
} = require('../../test/helpers/email-sender.mocks.js');
const emailSender = require('../../email-sender/email-sender.js');
const nodemailer = require('nodemailer');

describe('EmailSenderNode Integration Tests', function () {
    let RED;

    beforeEach(function () {
        RED = {
            nodes: { createNode: () => {} },
            util: {
                evaluateNodeProperty: (value) => value
            }
        };
    });

    afterEach(function () {
        restoreTransporterMock();
        if (RED.nodes.createNode.restore) {
            RED.nodes.createNode.restore();
        }
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
                    expect(node.status.calledWith({ fill: "red", shape: "dot", text: "rejected" })).to.be.true;
                    expect(node.send.notCalled).to.be.true;
                    done();
                });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
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
                    expect(node.status.calledWith({ fill: "yellow", shape: "dot", text: "pending" })).to.be.true;
                    expect(node.send.notCalled).to.be.true;
                    done();
                });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
    });

    it('should use msg.topic as subject if config.subject is empty', function (done) {
        mockTransporterSendMail({ accepted: ["recipient@example.com"], rejected: [], pending: [] });
        const node = getMockNode();
        const config = getValidConfig();
        config.subject = "";
        const msg = getMockMsg();
        msg.topic = "Topic from msg";

        const createTransportStub = sinon.stub(nodemailer, 'createTransport');
        createTransportStub.callsFake(() => {
            return {
                sendMail: (mailOptions, callback) => {
                    expect(mailOptions.subject).to.equal(msg.topic);
                    callback(null, { response: "250 OK", accepted: ["recipient@example.com"] });
                    createTransportStub.restore();
                    done();
                }
            };
        });

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(msg, node.send, function () { });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
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

        const createTransportStub = sinon.stub(nodemailer, 'createTransport');
        createTransportStub.callsFake(() => {
            return {
                sendMail: (mailOptions, callback) => {
                    expect(mailOptions.attachments).to.be.an('array').with.lengthOf(1);
                    expect(mailOptions.attachments[0].filename).to.equal("test.txt");
                    expect(mailOptions.attachments[0].content).to.equal("This is a test file.");
                    callback(null, { response: "250 OK", accepted: ["recipient@example.com"] });
                    createTransportStub.restore();
                    done();
                }
            };
        });

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function () { });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
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
                    expect(node.status.calledWith({ fill: "red", shape: "dot", text: "error sending" })).to.be.true;
                    done();
                });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
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
                    expect(node.status.calledWith({ fill: "green", shape: "dot", text: "sent" })).to.be.true;
                    done();
                });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
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
                    expect(node.send.calledOnce).to.be.true;
                    expect(node.send.calledWith(originalMsg)).to.be.true;
                    done();
                });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
    });
});
