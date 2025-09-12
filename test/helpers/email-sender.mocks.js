// Helper functions and mocks for email-sender tests (Mocha/Chai compatible)
const nodemailer = require('nodemailer');
const originalCreateTransport = nodemailer.createTransport;

let mockTransport;

function getValidConfig() {
    return {
        sender: "Test Sender",
        senderType: "str",
        address: "test.sender@example.com",
        addressType: "str",
        to: "recipient@example.com",
        toType: "str",
        cc: "",
        ccType: "str",
        bcc: "",
        bccType: "str",
        subject: "Test Subject",
        subjectType: "str",
        htmlContent: "<b>Hello World</b>",
        htmlContentType: "str",
        attachments: "",
        attachmentsType: "str",
        host: "smtp.example.com",
        hostType: "str",
        port: 587,
        portType: "num",
        user: "user",
        userType: "str",
        password: "password",
        passwordType: "str",
        secure: false,
        secureType: "bool",
        rejectUnauthorized: true,
        rejectUnauthorizedType: "bool"
    };
}

// Custom mock node to replace Sinon spies
function getMockNode() {
    const mock = {
        status: () => {},
        error: () => {},
        warn: () => {},
        log: () => {},
        send: () => {}
    };

    mock.status = (...args) => {
        mock.status.called = true;
        mock.status.args = args;
    };
    mock.status.called = false;
    mock.status.args = [];
    mock.status.calledWith = (expectedArgs) => {
        return mock.status.called && JSON.stringify(mock.status.args) === JSON.stringify(expectedArgs);
    };

    mock.send = (...args) => {
        mock.send.called = true;
        mock.send.args = args;
        mock.send.callCount++;
    };
    mock.send.called = false;
    mock.send.args = [];
    mock.send.callCount = 0;
    mock.send.calledWith = (expectedArgs) => {
        return mock.send.called && JSON.stringify(mock.send.args) === JSON.stringify([expectedArgs]);
    };

    return mock;
}

// Custom mock transporter to replace Sinon stubs
function mockTransporterSendMail(info, errorMsg = null) {
    mockNodemailer();
    nodemailer.createTransport = () => {
        return {
            sendMail: (mailOptions, callback) => {
                mockTransport = { mailOptions };
                if (errorMsg) {
                    callback(errorMsg, null);
                } else {
                    callback(null, info);
                }
            }
        };
    };
}

// Sets up a full module mock for nodemailer
function mockNodemailer() {
    nodemailer.createTransport = () => {
        throw new Error("nodemailer.createTransport should be mocked by mockTransporterSendMail");
    };
}

function restoreTransporterMock() {
    nodemailer.createTransport = originalCreateTransport;
}

function getMockTransport() {
    return mockTransport;
}

module.exports = {
    getValidConfig,
    getMockNode,
    getMockMsg: () => ({}),
    mockTransporterSendMail,
    restoreTransporterMock,
    getMockTransport,
    mockNodemailer
};
