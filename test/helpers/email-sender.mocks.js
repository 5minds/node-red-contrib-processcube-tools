// Helper functions and mocks for email-sender tests
const { EventEmitter } = require('events');

/**
 * Create mock Node-RED object for unit testing
 */
function createMockNodeRED(options = {}) {
    const mockRED = {
        nodes: {
            createNode: function (node, config) {
                nodeInstance = node; // Capture the node instance

                // Apply config properties to node
                Object.assign(node, {
                    id: config.id || 'mock-node-id',
                    type: config.type || 'email-sender',
                    name: config.name || 'Mock Node',
                    on: function (event, callback) {
                        if (event === 'input') {
                            storedInputCallback = callback;
                            // Store the callback on the node instance for easy access
                            node.inputCallback = callback;
                        }
                        // Call the original onHandler if provided
                        if (options.onHandler) {
                            options.onHandler.call(node, event, callback);
                        }
                    },
                    status: options.statusHandler || function () {},
                    error: options.errorHandler || function () {},
                    send: options.sendHandler || function () {},
                    log: options.logHandler || function () {},
                    warn: options.warnHandler || function () {},
                    debug: options.debugHandler || function () {},
                });
                return node;
            },
            registerType: function (type, constructor) {
                // Store registration for verification in tests
                this.lastRegisteredType = type;
                this.lastRegisteredConstructor = constructor;
            },
            // Helper method to get the stored input callback
            getInputCallback: function () {
                return storedInputCallback;
            },
            // Helper method to get the node instance
            getNodeInstance: function () {
                return nodeInstance;
            },
        },
        util: {
            evaluateNodeProperty: function (value, type, node, msg, callback) {
                if (type === 'json') {
                    try {
                        // Simulate parsing a JSON string into an object
                        return JSON.parse(JSON.stringify(value));
                    } catch (e) {
                        if (callback) {
                            callback(e, null);
                        }
                        return null;
                    }
                }

                // Simple mock implementation
                if (callback) {
                    callback(null, value);
                }
                return value;
            },
            encrypt: function (value) {
                return 'encrypted:' + value;
            },
            decrypt: function (value) {
                return value.replace('encrypted:', '');
            },
        },
        log: {
            info: options.logInfo || function () {},
            warn: options.logWarn || function () {},
            error: options.logError || function () {},
            debug: options.logDebug || function () {},
        },
    };

    return mockRED;
}

function createMockNodemailer(options = {}) {
    const settings = Object.assign({
        shouldFail: false
    }, options);

    return {
        createTransport: () => ({
            sendMail: (mailOptions, callback) => {
                if (settings.shouldFail === true) {
                    const error = new Error('Mock sendMail error');
                    error.code = 'ECONNREFUSED';
                    return callback(error);
                }

                callback(null, {
                    messageId: '<mock-message-id@test.com>',
                    response: '250 OK: Message accepted',
                    accepted: [mailOptions.to],
                    rejected: [],
                    pending: []
                });
            }
        }),
        restore: function() {
            // Cleanup method
        }
    };
}

// Aktualisiere setupModuleMocks um die neue Implementation zu nutzen
function setupModuleMocks() {
    const mockNodemailerModule = createMockNodemailer();

    delete require.cache[require.resolve('nodemailer')];
    require.cache[require.resolve('nodemailer')] = {
        exports: mockNodemailerModule
    };

    return function cleanup() {
        delete require.cache[require.resolve('nodemailer')];
        if (mockNodemailerModule.restore) {
            mockNodemailerModule.restore();
        }
    };
}

// Custom mock node
function getMockNode() {
    // Create an EventEmitter instance to get the .on and .emit methods
    const mock = Object.assign(new EventEmitter(), {
        status: () => {},
        error: () => {},
        warn: () => {},
        log: () => {},
        send: () => {},
    });

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

/**
 * Test configurations for the email sender node.
 */
const emailSenderConfigs = {
    valid: {
        id: 'test-node-6',
        type: 'email-sender',
        name: 'Test Email Sender',
        sender: 'Test Sender',
        senderType: 'str',
        address: 'test.sender@example.com',
        addressType: 'str',
        to: 'recipient@example.com',
        toType: 'str',
        cc: '',
        ccType: 'str',
        bcc: '',
        bccType: 'str',
        subject: 'Test Subject',
        subjectType: 'str',
        htmlContent: '<b>Hello World</b>',
        htmlContentType: 'str',
        attachments: '',
        attachmentsType: 'str',
        host: 'smtp.example.com',
        hostType: 'str',
        port: 587,
        portType: 'num',
        user: 'user',
        userType: 'str',
        password: 'password',
        passwordType: 'str',
        secure: false,
        secureType: 'bool',
        rejectUnauthorized: true,
        rejectUnauthorizedType: 'bool',
    },

    invalid: {
        id: 'test-node-7',
        type: 'email-sender',
        name: 'Invalid Email Sender',
        sender: '', // Missing sender
        senderType: 'str',
        address: 'test.sender@example.com',
        addressType: 'str',
        to: 'recipient@example.com',
        toType: 'str',
        subject: 'Invalid Test Subject',
        subjectType: 'str',
        htmlContent: 'Invalid Test Content',
        htmlContentType: 'str',
        host: '', // Missing host
        hostType: 'str',
        port: 587,
        portType: 'str', // Incorrect type
        user: 'user',
        userType: 'str',
        password: '', // Missing password
        passwordType: 'str',
    },

    minimal: {
        id: 'test-node-8',
        type: 'email-sender',
        name: 'Minimal Email Sender',
        to: 'recipient@example.com',
        toType: 'str',
        subject: 'Minimal Subject',
        subjectType: 'str',
        htmlContent: 'Minimal content.',
        htmlContentType: 'str',
        host: 'smtp.minimal.com',
        hostType: 'str',
        port: 587,
        portType: 'num',
        user: 'minimal-user',
        userType: 'str',
        password: 'minimal-password',
        passwordType: 'str',
    },
};

module.exports = {
    createMockNodeRED,
    setupModuleMocks,
    getMockNode,
    emailSenderConfigs,
    createMockNodemailer
};
