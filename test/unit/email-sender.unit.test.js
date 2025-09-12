const chai = require('chai');
chai.should();
const {
    getValidConfig,
    getMockNode,
    getMockMsg,
    mockTransporterSendMail,
    restoreTransporterMock,
    getMockTransport
} = require('../helpers/email-sender.mocks.js');
const {
    createMockNodeRED
} = require('../helpers/general.mocks.js');
const emailSender = require('../../email-sender/email-sender.js');


describe('E-Mail Sender Node Unit Tests', function () {
    let RED;
    let node;
    let config;

    beforeEach(function () {
        // ARRANGE: Set up a new, clean mock environment for each test
        RED = createMockNodeRED();
        // The mock node now correctly inherits from EventEmitter
        node = Object.assign(getMockNode(), new EventEmitter());
        config = getValidConfig();

        // Correctly mock the registration process.
        RED.nodes.registerType = function (type, constructor) {
            RED.nodes.lastRegisteredType = type;
            // The real constructor is saved here, which is what your test needs.
            RED.nodes.lastRegisteredConstructor = constructor;
        };
        emailSender(RED);
    });

    afterEach(function () {
        restoreTransporterMock();
    });

    // A separate describe block for module export
    describe('Module Export', function () {
        it('should export a function', function() {
            // ARRANGE: The module is imported above
            const moduleExport = require('../../email-sender/email-sender.js');

            // ASSERT: The export should be a function
            (typeof moduleExport).should.equal('function');
        });
    });

    // A separate describe block for node registration
    describe('Node Registration', function () {
        it('should register node type without errors', function () {
            // ARRANGE: mockRED is already created in beforeEach
            const mockRED = createMockNodeRED();

            // ACT: Register the node by initializing it
            emailSender(mockRED);

            // ASSERT: Verify registration
            mockRED.nodes.lastRegisteredType.should.equal('email-sender');
            (typeof mockRED.nodes.lastRegisteredConstructor).should.equal('function');
        });
    });

    // A separate describe block for node instantiation
    describe('Node Instantiation', function() {
        it('should handle node instantiation with valid config', function() {
            // ARRANGE: The node and config are set up in beforeEach
            const MyNodeConstructor = RED.nodes.lastRegisteredConstructor;

            // ACT: The node is initialized
            const createdNode = new MyNodeConstructor(config);

            // ASSERT: Verify that the node is created without errors
            createdNode.should.be.an('object');
        });
    });

    // A separate describe block for the node's core functionality
    describe('Node Functionality', function () {

        it('should send email successfully and set status to "sent"', function (done) {
            // ARRANGE: Mock a successful email send
            mockTransporterSendMail({ accepted: ["recipient@example.com"], rejected: [], pending: [] });

            // ACT: Simulate an incoming message to trigger the node
            node.emit('input', getMockMsg(), node.send, (err) => {
                // ASSERT
                (err === undefined).should.be.true;
                node.status.calledWith({ fill: "green", shape: "dot", text: "sent" }).should.be.true;
                done();
            });
        });

        it('should handle sendMail error and set status to "error sending"', function (done) {
            // ARRANGE: Mock a failed email send with a specific error
            mockTransporterSendMail(null, new Error("Mock sendMail error"));

            // ACT: Simulate an incoming message
            node.emit('input', getMockMsg(), node.send, (err) => {
                // ASSERT
                err.should.be.an('error');
                err.message.should.equal("Mock sendMail error");
                node.status.calledWith({ fill: "red", shape: "dot", text: "error sending" }).should.be.true;
                done();
            });
        });

        it('should handle an array of attachments correctly', function (done) {
            // ARRANGE: Configure the node with a JSON string of attachments
            const attachments = [{
                filename: "test1.txt",
                content: "This is the first test file."
            }, {
                filename: "test2.txt",
                content: "This is the second test file."
            }];
            config.attachments = JSON.stringify(attachments);
            config.attachmentsType = "json";

            // ACT: Listen for the 'input' event to check the mock transport
            node.on('input', (msg, send, errorHandler) => {
                const mockTransport = getMockTransport();
                // ASSERT
                mockTransport.mailOptions.attachments.should.be.an('array').with.lengthOf(2);
                mockTransport.mailOptions.attachments[0].filename.should.equal("test1.txt");
                mockTransport.mailOptions.attachments[1].content.should.equal("This is the second test file.");
                done();
            });

            // Simulate an incoming message
            node.emit('input', getMockMsg(), node.send, (err) => {});
        });

        it('should log a warning for malformed attachments', function (done) {
            // ARRANGE: Configure the node with a JSON string containing a malformed attachment
            const attachments = [{
                filename: "test.txt",
                content: "This is a test file."
            }, {
                // Malformed attachment with missing content
                filename: "invalid.txt"
            }];
            config.attachments = JSON.stringify(attachments);
            config.attachmentsType = "json";

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
