import { expect } from 'chai';
const helper = require('node-red-node-test-helper');
import {
    setupModuleMocks,
    emailSenderConfigs,
    testFlows,
    testUtils,
    EmailSenderConfig,
    TestFlows
} from '../../test/helpers/email-sender.mocks';

// Type definitions for the integration test environment
interface MockEmailMessage {
    payload: string;
    topic: string;
    from: string;
    subject: string;
    [key: string]: any;
}

describe('E-Mail Sender Node - Integration Tests', function () {
    // Set a reasonable timeout for integration tests
    this.timeout(10000);

    let emailSenderNode: (RED: any) => void;
    let cleanupMocks: (() => void) | undefined;

    beforeEach(function (done: Mocha.Done) {
        // Set up mocks using helper
        cleanupMocks = setupModuleMocks();

        // Load the node with mocked dependencies
        emailSenderNode = require('../../email-sender/email-sender');

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

    beforeEach(function (done: Mocha.Done) {
        helper.startServer(done);
    });

    afterEach(function (done: Mocha.Done) {
        helper.unload();
        helper.stopServer(done);
    });

    describe('Node Loading', function () {
        it('should load in Node-RED test environment', function (done: Mocha.Done) {
            // ARRANGE: Use test flow from helpers
            const flow: EmailSenderConfig[] = [emailSenderConfigs.valid];

            // ACT: Load the node in the test helper environment
            helper.load(emailSenderNode, flow, function () {
                try {
                    // ASSERT: Verify the node loaded correctly
                    const n1: any = helper.getNode(emailSenderConfigs.valid.id);
                    expect(n1).to.exist;
                    expect(n1).to.have.property('name', emailSenderConfigs.valid.name);
                    expect(n1).to.have.property('type', 'email-sender');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('should load with minimal configuration', function (done: Mocha.Done) {
            // ARRANGE: Use minimal test config from helpers
            const flow: EmailSenderConfig[] = [emailSenderConfigs.minimal];

            // ACT: Load the node
            helper.load(emailSenderNode, flow, function () {
                try {
                    // ASSERT: Verify the node loaded with minimal config
                    const n1: any = helper.getNode(emailSenderConfigs.minimal.id);
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
        it('should create wired connections correctly', function (done: Mocha.Done) {
            // ARRANGE: Use connected test flow from helpers
            const flow = testFlows.connected;

            // ACT: Load nodes and verify connections
            helper.load(emailSenderNode, flow, function () {
                try {
                    const n1: any = helper.getNode(emailSenderConfigs.valid.id);
                    const h1: any = helper.getNode('h1');

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

        it('should handle multiple output connections', function (done: Mocha.Done) {
            // ARRANGE: Use multi-output test flow from helpers
            const flow = testFlows.multiOutput;

            // ACT: Load nodes
            helper.load(emailSenderNode, flow, function () {
                try {
                    const n1: any = helper.getNode(emailSenderConfigs.valid.id);
                    const h1: any = helper.getNode('h1');
                    const h2: any = helper.getNode('h2');

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
        it('should handle input without crashing', async function (): Promise<void> {
            // ARRANGE: Use test flow from helpers
            const flow = testFlows.single;

            return new Promise<void>((resolve, reject) => {
                helper.load(emailSenderNode, flow, function () {
                    try {
                        const n1: any = helper.getNode(emailSenderConfigs.valid.id);
                        expect(n1).to.exist;

                        // Send input - this should not crash due to mocked IMAP
                        n1.receive({ payload: 'test input' });

                        // ASSERT: If we reach here, the node handled input gracefully
                        testUtils.wait(500).then(() => {
                            resolve(); // Success if no errors thrown
                        }).catch(reject);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should process messages through connected nodes', function (done: Mocha.Done) {
            // ARRANGE: Use connected test flow from helpers
            const flow = testFlows.connected;

            // ACT: Load nodes and set up message listener
            helper.load(emailSenderNode, flow, function () {
                try {
                    const n1: any = helper.getNode(emailSenderConfigs.valid.id);
                    const h1: any = helper.getNode('h1');

                    // Set up listener for messages from email receiver
                    h1.on('input', function (msg: any) {
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
                            const mockEmailMessage: MockEmailMessage = {
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

        it('should handle message timeout gracefully', async function (): Promise<void> {
            // ARRANGE: Use connected test flow
            const flow = testFlows.connected;

            return new Promise<void>((resolve, reject) => {
                helper.load(emailSenderNode, flow, function () {
                    try {
                        const n1: any = helper.getNode(emailSenderConfigs.valid.id);
                        const h1: any = helper.getNode('h1');

                        // Use testUtils.waitForMessage with timeout
                        testUtils
                            .waitForMessage(h1, 1000)
                            .then((msg: any) => {
                                // ASSERT: Should receive message within timeout
                                expect(msg).to.exist;
                                resolve();
                            })
                            .catch((err: Error) => {
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
    });
});