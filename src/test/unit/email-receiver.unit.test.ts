import { expect } from 'chai';
// Import your types and mock helpers.
import type { Node, NodeMessageInFlow, NodeDef } from 'node-red';
import { createMockNodeRED, setupModuleMocks, testConfigs, testUtils } from '../helpers/email-receiver.mocks';
import type { TestConfig } from '../helpers/email-receiver.mocks';
import emailReceiverNode from '../../email-receiver/email-receiver';
import type { NodeAPI } from 'node-red';


describe('E-Mail Receiver Node - Unit Tests', function () {
    this.timeout(10000);

    let cleanupMocks: Function;

    before(function () {
        cleanupMocks = setupModuleMocks();
    });

    after(function () {
        if (cleanupMocks) {
            cleanupMocks();
        }
    });

    describe('Module Export', function () {
        it('should export a function', function () {
            expect(emailReceiverNode).to.be.a('function');
        });
    });

    describe('Node Registration', function () {
        it('should register node type without errors', function () {
            // ARRANGE: Create mock Node-RED with tracking
            const mockRED = createMockNodeRED();

            // ACT: Register the node
            emailReceiverNode(mockRED as unknown as NodeAPI);

            // ASSERT: Verify registration
            expect((mockRED.nodes as any).lastRegisteredType).to.equal('email-receiver');
            expect((mockRED.nodes as any).lastRegisteredConstructor).to.be.a('function');
        });
    });

    describe('Node Instantiation', function () {
        it('should handle node instantiation with valid config', function () {
            // ARRANGE: Track node creation
            let createdNode: Node | null = null;
            const mockRED = createMockNodeRED({
                onHandler: function (this: Node, event: string, callback: Function) {
                    createdNode = this;
                },
            });

            // ACT: Register and create node instance
            emailReceiverNode(mockRED as unknown as NodeAPI);
            new (mockRED.nodes as any).lastRegisteredConstructor(testConfigs.valid as TestConfig);

            // ASSERT: Verify node was created with correct properties
            expect(createdNode).to.exist;
            expect(createdNode).to.have.property('name', testConfigs.valid.name);
            expect(createdNode).to.have.property('id', testConfigs.valid.id);
        });

        it('should handle minimal config', function () {
            // ARRANGE: Use minimal test config
            let createdNode: Node | null = null;
            const mockRED = createMockNodeRED({
                onHandler: function (this: Node, event: string, callback: Function) {
                    createdNode = this;
                },
            });

            // ACT: Register and create node with minimal config
            emailReceiverNode(mockRED as unknown as NodeAPI);
            new (mockRED.nodes as any).lastRegisteredConstructor(testConfigs.minimal);

            // ASSERT: Verify node creation
            expect(createdNode).to.exist;
            expect(createdNode).to.have.property('id', testConfigs.minimal.id);
        });
    });

    describe('Folder Configuration', function () {
        it('should handle array of folders', async function () {
            // ARRANGE: Set up message tracking
            let sentMessage: NodeMessageInFlow | null = null;
            const mockRED = createMockNodeRED({
                sendHandler: function (msg: any) {
                sentMessage = msg;
            },
            });

            // ACT: Register node and create instance with array folders
            emailReceiverNode(mockRED as unknown as NodeAPI);
            const nodeConstructor = (mockRED.nodes as any).lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(testConfigs.arrayFolders);

            // Wait for processing
            await testUtils.wait(50);

            // ASSERT: Should handle array folders without error
            expect(nodeInstance).to.exist;
            expect(nodeInstance).to.have.property('name', testConfigs.arrayFolders.name);
        });
    });

    describe('Error Handling', function () {
        it('should call node.error for invalid folder type', function (done: Mocha.Done) {
            // ARRANGE: Set up error tracking
            const mockRED = createMockNodeRED({
                onHandler: function (this: Node, event: string, callback: Function) {
                    if (event === 'input') {
                        (this as any).inputCallback = callback;
                    }
                },
                errorHandler: function (err: any) {
                    // ASSERT: Should receive appropriate error message
                    expect(err).to.include("The 'folders' property must be an array of strings.");
                    done();
                },
            });

            // ACT: Register node and create instance with invalid config
            emailReceiverNode(mockRED as unknown as NodeAPI);
            const nodeConstructor = (mockRED.nodes as any).lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(testConfigs.invalidFolderType);

            // Trigger the error by sending an input message
            // Use a small delay to ensure the constructor has completed
            setTimeout(() => {
                if ((nodeInstance as any).inputCallback) {
                    (nodeInstance as any).inputCallback({ payload: 'test' });
                } else {
                    done(new Error('inputCallback was not set on the node instance'));
                }
            }, 10);
        });

        it('should call node.error for missing config', function (done) {
            // ARRANGE: Set up error and status tracking
            let statusCalled = false;
            const mockRED = createMockNodeRED({
                onHandler: function (this: Node, event: string, callback: Function) {
                    if (event === 'input') {
                        (this as any).inputCallback = callback;
                    }
                },
                statusHandler: function (status: any) {
                    statusCalled = true;
                    if (status.fill) {
                        expect(status.fill).to.equal('red');
                    }
                },
                errorHandler: function (err: any) {
                    // ASSERT: Should receive config error
                    expect(err).to.include('Missing required IMAP config');
                    expect(statusCalled).to.be.true;
                    done();
                },
            });

            // ACT: Register node and create instance with invalid config
            emailReceiverNode(mockRED as unknown as NodeAPI);
            const nodeConstructor = (mockRED.nodes as any).lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(testConfigs.invalidConfig);

            // Trigger the error by sending an input message
            // Use a small delay to ensure the constructor has completed
            setTimeout(() => {
                if ((nodeInstance as any).inputCallback) {
                    (nodeInstance as any).inputCallback({ payload: 'test' });
                } else {
                    done(new Error('inputCallback was not set on the node instance'));
                }
            }, 10);
        });

        it('should handle connection errors gracefully', function (done) {
            // ARRANGE: Set up connection error scenario with done() protection
            let testCompleted = false;

            const completeDone = (error?: Error) => {
                if (!testCompleted) {
                    testCompleted = true;
                    if (error) {
                        done(error);
                    } else {
                        done();
                    }
                }
            };

            const mockRED = createMockNodeRED({
                onHandler: function (this: Node, event: string, callback: Function) {
                    if (event === 'input') {
                        (this as any).inputCallback = callback;
                    }
                },
                statusHandler: function (status: any) {
                    if (status.fill === 'red' && status.text && status.text.includes('error')) {
                        completeDone(); // Success - error status was set
                    }
                },
                errorHandler: function (err: any) {
                    // Also accept errors as valid completion
                    expect(err).to.exist;
                    completeDone();
                },
            });

            // Use a config that should cause connection issues
            const badConfig = {
                ...testConfigs.valid,
                host: 'nonexistent.invalid.host.com',
                port: 12345, // Invalid port
            };

            // ACT: Register node and create instance with invalid config
            emailReceiverNode(mockRED as unknown as NodeAPI);
            const nodeConstructor = (mockRED.nodes as any).lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(badConfig);

            // Trigger the error by sending an input message
            // Use a small delay to ensure the constructor has completed
            setTimeout(() => {
                if ((nodeInstance as any).inputCallback) {
                    (nodeInstance as any).inputCallback({ payload: 'test' });
                } else {
                    completeDone(new Error('inputCallback was not set on the node instance'));
                }
            }, 10);
        });
    });

    describe('IMAP Connection', function () {
        it('should handle connection success', function (done) {
            // ARRANGE: Set up connection tracking
            const mockRED = createMockNodeRED({
                onHandler: function (this: Node, event: string, callback: Function) {
                    if (event === 'input') {
                        (this as any).inputCallback = callback;
                    }
                },
                statusHandler: function (status: any) {
                    // ASSERT: Check for 'connected' status and then complete the test
                    if (status.fill === 'green' && status.text === 'connected') {
                        done();
                    }
                },
            });

            // ACT: Create node with config that should succeed
            emailReceiverNode(mockRED as unknown as NodeAPI);
            const nodeConstructor = (mockRED.nodes as any).lastRegisteredConstructor;
            const nodeInstance = new nodeConstructor(testConfigs.valid);

            // Trigger the connection attempt by sending an input message
            setTimeout(() => {
                if ((nodeInstance as any).inputCallback) {
                    (nodeInstance as any).inputCallback({ payload: 'test' });
                } else {
                    done(new Error('inputCallback was not set on the node instance'));
                }
            }, 10);
        });

        it('should handle connection errors', function (done) {
            // ARRANGE: Set up error tracking
            const mockRED = createMockNodeRED({
                onHandler: function (this: Node, event: string, callback: Function) {
                    if (event === 'input') {
                        // Store the callback on the node instance
                        (this as any).inputCallback = callback;
                    }
                },
                errorHandler: function (err: any) {
                    // ASSERT: Should handle connection errors gracefully
                    expect(err).to.exist;
                    done();
                },
                statusHandler: function (status: any) {
                    if (status.fill === 'red') {
                        // Connection failed status
                        expect(status.text).to.include('error');
                    }
                },
            });

            // ACT: Create node with config that should fail
            emailReceiverNode(mockRED as unknown as NodeAPI);
            const nodeConstructor = (mockRED.nodes as any).lastRegisteredConstructor;

            // Use invalid config to trigger connection error
            const invalidConfig = { ...testConfigs.valid, host: 'invalid.host.com' };
            const nodeInstance = new nodeConstructor(invalidConfig);

            // Trigger the connection attempt by sending an input message
            setTimeout(() => {
                if ((nodeInstance as any).inputCallback) {
                    (nodeInstance as any).inputCallback({ payload: 'test' });
                } else {
                    done(new Error('inputCallback was not set on the node instance'));
                }
            }, 10);
        });
    });
});