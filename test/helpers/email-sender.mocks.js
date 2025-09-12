// Helper functions and mocks for email-sender tests (Mocha/Chai compatible)

const nodemailer = require('nodemailer');
const sinon = require('sinon');

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

function getMockNode() {
    return {
        status: sinon.spy(),
        error: sinon.spy(),
        warn: sinon.spy(),
        log: sinon.spy(),
        send: sinon.spy()
    };
}

function getMockMsg() {
    return {};
}

/**
 * Mocks the nodemailer.createTransport method to control the sendMail response.
 * @param {object} info - The info object to return on success, e.g., { accepted: [], rejected: [], pending: [] }.
 * @param {Error} error - The error object to return on failure.
 */
function mockTransporterSendMail(info = null, error = null) {
    return sinon.stub(nodemailer, 'createTransport').returns({
        sendMail: (mailOptions, callback) => {
            if (error) {
                callback(error, null);
            } else {
                callback(null, info);
            }
        }
    });
}

function restoreTransporterMock() {
    if (nodemailer.createTransport.restore) {
        nodemailer.createTransport.restore();
    }
}

module.exports = {
    getValidConfig,
    getMockNode,
    getMockMsg,
    mockTransporterSendMail,
    restoreTransporterMock
};
