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

describe('EmailSenderNode Unit Tests', function () {
    let RED;

    beforeEach(function () {
        RED = {
            nodes: {
                createNode: () => {},
                registerType: sinon.stub()
            },
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

    // Existing test case for successful email sending
    it('should send email successfully and set status to sent', function (done) {
        mockTransporterSendMail({ accepted: ["recipient@example.com"], rejected: [], pending: [] });
        const node = getMockNode();
        const config = getValidConfig();

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.undefined;
                    expect(node.status.calledWith({ fill: "green", shape: "dot", text: "sent" })).to.be.true;
                    expect(node.send.calledOnce).to.be.true;
                    done();
                });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
    });

    // Existing test case for handling sendMail error
    it('should handle sendMail error and set status to error sending', function (done) {
        mockTransporterSendMail(null, new Error("Mock sendMail error"));
        const node = getMockNode();
        const config = getValidConfig();

        node.on = function (event, handler) {
            if (event === 'input') {
                handler(getMockMsg(), node.send, function (err) {
                    expect(err).to.be.an('error');
                    expect(err.message).to.equal("Mock sendMail error");
                    expect(node.status.calledWith({ fill: "red", shape: "dot", text: "error sending" })).to.be.true;
                    expect(node.send.notCalled).to.be.true;
                    done();
                });
            }
        };

        sinon.stub(RED.nodes, 'createNode').callsFake(() => node);
        emailSender(RED);
        RED.nodes.createNode(config);
    });

    // New test cases start here
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
        config.subject = ""; // Override subject in config
        const msg = getMockMsg();
        msg.topic = "Topic from msg"; // Add topic to msg

        // Stub nodemailer.createTransport to inspect the mailOptions
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
});
