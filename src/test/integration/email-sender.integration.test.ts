import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
    IntegrationTestRunner,
    IntegrationAssertions,
    IntegrationScenarioBuilder,
    type IntegrationTestScenario
} from '../framework';
import { EmailSenderTestConfigs } from '../helpers/email-sender-test-configs';
import { testFlows } from '../helpers/email-sender-test-flows';

const emailSenderNode = require('../../email-sender/email-sender');



describe('E-Mail Sender Node - Integration Tests (Framework)', function () {

    // ========================================================================
    // NODE LOADING TESTS USING FRAMEWORK
    // ========================================================================

    describe('Node Loading (Enhanced)', function () {
        const loadingTests = new IntegrationScenarioBuilder()
            .addLoadingScenario('valid configuration', [EmailSenderTestConfigs.valid], EmailSenderTestConfigs.valid.id)
            .addLoadingScenario('minimal configuration', [EmailSenderTestConfigs.minimal], EmailSenderTestConfigs.minimal.id);

        loadingTests.getScenarios().forEach(scenario => {
            it(`should load with ${scenario.name}`, async function () {
                const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);

                IntegrationAssertions.expectNodeExists(context, scenario.nodeId);
                IntegrationAssertions.expectNodeProperty(context, scenario.nodeId, 'type', 'email-sender');

                const nodeConfig = scenario.flow.find(n => n.id === scenario.nodeId);
                if (nodeConfig.name) {
                    IntegrationAssertions.expectNodeProperty(context, scenario.nodeId, 'name', nodeConfig.name);
                }
            });
        });
    });

    // ========================================================================
    // CONNECTION TESTS USING FRAMEWORK
    // ========================================================================

    describe('Node Connections', function () {
        const connectionTests = new IntegrationScenarioBuilder()
            .addConnectionScenario('simple connection', testFlows.connected, [EmailSenderTestConfigs.valid.id, 'h1'])
            .addConnectionScenario('multiple outputs', testFlows.multiOutput, [EmailSenderTestConfigs.valid.id, 'h1', 'h2']);

        connectionTests.getScenarios().forEach(scenario => {
            it(`should create ${scenario.name} correctly`, async function () {
                const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);

                // Get node IDs from flow and verify they all exist
                const nodeIds = scenario.flow.map(n => n.id);
                IntegrationAssertions.expectAllNodesExist(context, nodeIds);

                // Verify the main node has correct properties
                IntegrationAssertions.expectNodeProperty(context, EmailSenderTestConfigs.valid.id, 'name', EmailSenderTestConfigs.valid.name);
            });
        });
    });

    // ========================================================================
    // MESSAGE FLOW TESTS USING FRAMEWORK
    // ========================================================================

    describe('Message Flow', function () {
        it('should handle input without crashing', async function () {
            const scenario: IntegrationTestScenario = {
                name: 'input handling',
                flow: testFlows.single,
                nodeId: EmailSenderTestConfigs.valid.id,
                input: { payload: 'test input' },
                timeout: 2000
            };

            const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
            IntegrationAssertions.expectNodeExists(context, EmailSenderTestConfigs.valid.id);
            // Success is implicit - if we reach here, no crash occurred
        });

        it('should process messages through connected nodes', async function () {
            const scenario: IntegrationTestScenario = {
                name: 'message processing',
                flow: testFlows.connected,
                nodeId: EmailSenderTestConfigs.valid.id,
                expectedMessages: [
                    { nodeId: 'h1', expectedMsg: { payload: 'string' } }
                ],
                timeout: 3000,
                setup: (nodes) => {
                    // Simulate email sending after a short delay
                    setTimeout(() => {
                        const mockEmailMessage = {
                            payload: 'This is a mock email body for testing purposes.',
                            topic: 'email',
                            from: 'sender@test.com',
                            subject: 'Mock Email Subject',
                            _msgid: 'test-msg-id',
                        };
                        (nodes[EmailSenderTestConfigs.valid.id] as any).send(mockEmailMessage);
                    }, 100);
                }
            };

            const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
            IntegrationAssertions.expectMessageReceived(context, 'h1');
        });

        it('should handle message timeout scenarios', async function () {
            const scenario: IntegrationTestScenario = {
                name: 'timeout handling',
                flow: testFlows.connected,
                nodeId: EmailSenderTestConfigs.valid.id,
                timeout: 1000, // Short timeout to test timeout handling
                setup: (nodes) => {
                    // Don't send any messages - let it timeout
                }
            };

            try {
                await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
                // If we reach here, no messages were expected and timeout was handled gracefully
            } catch (error: any) {
                // Expected timeout behavior
                expect(error.message).to.include('timed out');
            }
        });

        it('should handle complex multi-output flows', async function () {
            const scenario: IntegrationTestScenario = {
                name: 'multi-output flow',
                flow: testFlows.multiOutput,
                nodeId: EmailSenderTestConfigs.valid.id,
                expectedMessages: [
                    { nodeId: 'h1', expectedMsg: { payload: 'string' } },
                    { nodeId: 'h2', expectedMsg: { payload: 'string' } }
                ],
                timeout: 3000,
                setup: (nodes) => {
                    setTimeout(() => {
                        const mockEmail = {
                            payload: 'Multi-output test email',
                            subject: 'Multi-output Test',
                            from: 'multi@test.com',
                            _msgid: 'multi-output-test-id',
                        };
                        // Send to both outputs
                        (nodes[EmailSenderTestConfigs.valid.id] as any).send([mockEmail, mockEmail]);
                    }, 50);
                }
            };

            const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
            IntegrationAssertions.expectMessageCount(context, 'h1', 1);
            IntegrationAssertions.expectMessageCount(context, 'h2', 1);
        });
    });

    // ========================================================================
    // EMAIL-SPECIFIC INTEGRATION TESTS
    // ========================================================================

    describe('Email Sending Integration', function () {
        it('should handle successful email sending', async function () {
            const scenario: IntegrationTestScenario = {
                name: 'successful email sending',
                flow: testFlows.connected,
                nodeId: EmailSenderTestConfigs.valid.id,
                input: {
                    payload: 'Test email content',
                    topic: 'Test Subject',
                    to: 'test@example.com'
                },
                expectedMessages: [
                    { nodeId: 'h1', expectedMsg: { payload: 'string' } }
                ],
                timeout: 3000
            };

            const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
            IntegrationAssertions.expectMessageReceived(context, 'h1');

            const receivedMessage = context.messages.find(m => m.nodeId === 'h1');
            expect(receivedMessage).to.exist;
        });

        it('should handle email with attachments', async function () {
            const attachmentConfig = {
                ...EmailSenderTestConfigs.valid,
                attachments: JSON.stringify([
                    { filename: 'test.txt', content: 'Test attachment content' }
                ])
            };

            const scenario: IntegrationTestScenario = {
                name: 'email with attachments',
                flow: [
                    { ...attachmentConfig, wires: [['h1']] },
                    { id: 'h1', type: 'helper' }
                ],
                nodeId: attachmentConfig.id,
                input: {
                    payload: 'Email with attachment',
                    topic: 'Attachment Test',
                    to: 'test@example.com'
                },
                expectedMessages: [
                    { nodeId: 'h1', expectedMsg: { payload: 'string' } }
                ],
                timeout: 4000
            };

            const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
            IntegrationAssertions.expectMessageReceived(context, 'h1');
        });

        it('should handle email sending errors gracefully', async function () {
            const errorConfig = {
                ...EmailSenderTestConfigs.valid,
                smtpHost: 'invalid.smtp.server',
                shouldFail: true
            };

            const scenario: IntegrationTestScenario = {
                name: 'email sending error',
                flow: [
                    { ...errorConfig, wires: [['h1']] },
                    { id: 'h1', type: 'helper' }
                ],
                nodeId: errorConfig.id,
                input: {
                    payload: 'This should fail',
                    topic: 'Error Test',
                    to: 'test@example.com'
                },
                timeout: 3000
            };

            const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
            IntegrationAssertions.expectNodeExists(context, errorConfig.id);
            // Should handle error gracefully without crashing the flow
        });
    });

    // ========================================================================
    // CONFIGURATION VALIDATION INTEGRATION
    // ========================================================================

    describe('Configuration Validation Integration', function () {
        const validationTests = new IntegrationScenarioBuilder()
            .addScenario({
                name: 'minimal configuration handling',
                flow: [EmailSenderTestConfigs.minimal],
                nodeId: EmailSenderTestConfigs.minimal.id,
                input: { payload: 'test', topic: 'test' },
                timeout: 2000
            })
            .addScenario({
                name: 'complex configuration handling',
                flow: [{
                    ...EmailSenderTestConfigs.valid,
                    attachments: JSON.stringify([
                        { filename: 'config-test.txt', content: 'Configuration test' }
                    ]),
                    priority: 'high'
                }],
                nodeId: EmailSenderTestConfigs.valid.id,
                input: { payload: 'complex test', topic: 'complex' },
                timeout: 3000
            });

        validationTests.getScenarios().forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
                IntegrationAssertions.expectNodeExists(context, scenario.nodeId);
                // Node should handle different configurations gracefully
            });
        });
    });

    // ========================================================================
    // LIFECYCLE TESTS USING FRAMEWORK
    // ========================================================================

    describe('Node Lifecycle', function () {
        it('should handle multiple load/unload cycles', async function () {
            const cycles = 3;

            for (let i = 0; i < cycles; i++) {
                const scenario: IntegrationTestScenario = {
                    name: `lifecycle cycle ${i}`,
                    flow: testFlows.single,
                    nodeId: EmailSenderTestConfigs.valid.id,
                    input: { payload: `test cycle ${i}`, topic: `cycle ${i}` },
                    timeout: 1000
                };

                const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
                IntegrationAssertions.expectNodeExists(context, EmailSenderTestConfigs.valid.id);

                await new Promise(resolve => setTimeout(resolve, 50));
            }
        });

        it('should handle rapid message processing', async function () {
            const scenario: IntegrationTestScenario = {
                name: 'rapid message processing',
                flow: testFlows.connected,
                nodeId: EmailSenderTestConfigs.valid.id,
                expectedMessages: [
                    { nodeId: 'h1', expectedMsg: { payload: 'string' } }
                ],
                timeout: 3000,
                setup: (nodes) => {
                    // Send multiple messages rapidly
                    for (let i = 0; i < 5; i++) {
                        setTimeout(() => {
                            const message = {
                                payload: `Rapid message ${i}`,
                                topic: `Rapid ${i}`,
                                _msgid: `rapid-${i}`
                            };
                            (nodes[EmailSenderTestConfigs.valid.id] as any).receive(message);
                        }, i * 10);
                    }
                }
            };

            const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
            IntegrationAssertions.expectMessageReceived(context, 'h1');
        });
    });

    // ========================================================================
    // INTEGRATION WITH DIFFERENT MESSAGE TYPES
    // ========================================================================

    describe('Message Type Integration', function () {
        const messageTypeTests = [
            {
                name: 'plain text email',
                input: {
                    payload: 'Plain text content',
                    topic: 'Plain Text Test',
                    to: 'plain@test.com'
                }
            },
            {
                name: 'HTML email',
                input: {
                    payload: '<h1>HTML Content</h1><p>This is HTML email</p>',
                    topic: 'HTML Test',
                    to: 'html@test.com',
                    html: true
                }
            },
            {
                name: 'email with custom headers',
                input: {
                    payload: 'Custom headers test',
                    topic: 'Custom Headers',
                    to: 'headers@test.com',
                    headers: {
                        'X-Priority': 'high',
                        'X-Custom': 'integration-test'
                    }
                }
            },
            {
                name: 'email with multiple recipients',
                input: {
                    payload: 'Multiple recipients test',
                    topic: 'Multiple Recipients',
                    to: 'user1@test.com,user2@test.com',
                    cc: 'cc@test.com'
                }
            }
        ];

        messageTypeTests.forEach(testCase => {
            it(`should handle ${testCase.name}`, async function () {
                const scenario: IntegrationTestScenario = {
                    name: testCase.name,
                    flow: testFlows.connected,
                    nodeId: EmailSenderTestConfigs.valid.id,
                    input: testCase.input,
                    expectedMessages: [
                        { nodeId: 'h1', expectedMsg: { payload: 'string' } }
                    ],
                    timeout: 3000
                };

                const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);
                IntegrationAssertions.expectMessageReceived(context, 'h1');
            });
        });
    });
});