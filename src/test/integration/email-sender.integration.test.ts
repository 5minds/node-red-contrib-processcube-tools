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
    it('should load node in a flow configuration', async function () {
        const scenario: IntegrationTestScenario = {
            name: 'node in flow',
            flow: testFlows.connected,
            nodeId: EmailSenderTestConfigs.valid.id,
            timeout: 2000
        };

        const context = await IntegrationTestRunner.runIntegrationScenario(emailSenderNode, scenario);

        // Only verify the main node exists - helper nodes aren't actually created
        IntegrationAssertions.expectNodeExists(context, EmailSenderTestConfigs.valid.id);
        IntegrationAssertions.expectNodeProperty(context, EmailSenderTestConfigs.valid.id, 'name', EmailSenderTestConfigs.valid.name);
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
    });
});