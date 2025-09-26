import { expect } from 'chai';
import emailReceiverNode from '../../email-receiver/email-receiver';
import { EmailReceiverTestConfigs } from '../helpers/email-receiver-test-configs';
import { MockImap } from '../mocks/imap-mock';
// Import our test framework
import {
  TestScenarioBuilder,
  NodeTestRunner,
  NodeAssertions,
  createNodeTestSuite,
  type TestScenario,
  type MockNodeREDOptions
} from '../framework';
import { createMockMailparser } from '../mocks/mailparser-mock';

describe('E-Mail Receiver Node - Unit Tests', function () {

    // ========================================================================
    // USE GENERIC TEST SUITE FOR BASIC FUNCTIONALITY
    // ========================================================================

    createNodeTestSuite('Email Receiver', emailReceiverNode, EmailReceiverTestConfigs);

    // ========================================================================
    // SPECIFIC EMAIL RECEIVER TESTS
    // ========================================================================

    describe('Email Receiver Specific Tests', function () {

        describe('Configuration Validation', function () {
            const configTests = new TestScenarioBuilder()
                .addValidScenario('valid configuration', EmailReceiverTestConfigs.valid)
                .addValidScenario('minimal configuration', EmailReceiverTestConfigs.minimal)
                .addValidScenario('array folders configuration', EmailReceiverTestConfigs.arrayFolders)
                .addErrorScenario(
                    'invalid folder type',
                    EmailReceiverTestConfigs.invalidFolderType,
                    "The 'folders' property must be an array of strings."
                )
                .addErrorScenario(
                    'missing required config',
                    EmailReceiverTestConfigs.invalidConfig,
                    'Missing required IMAP config'
                );

            configTests.getScenarios().forEach(scenario => {
                it(`should handle ${scenario.name}`, async function () {
                    const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                    // Verify node was created
                    expect(context.nodeInstance).to.exist;

                    // Check specific expectations
                    if (scenario.expectedError) {
                        NodeAssertions.expectError(context, scenario.expectedError);
                    } else {
                        NodeAssertions.expectNoErrors(context);
                    }

                    // Verify node properties
                    if (scenario.config.name) {
                        NodeAssertions.expectNodeProperty(context, 'name', scenario.config.name);
                    }

                    if (scenario.config.id) {
                        NodeAssertions.expectNodeProperty(context, 'id', scenario.config.id);
                    }
                });
            });
        });

        describe('IMAP Connection Handling', function () {
            it('should establish connection successfully', async function () {
                const mockDependencies = {
                    ImapClient: MockImap,
                    mailParser: createMockMailparser()
                };

                const mockOptions: MockNodeREDOptions = {
                    dependencies: mockDependencies,
                    statusHandler: function(status: any) {
                        console.log('📊 Status received:', JSON.stringify(status, null, 2));
                    },
                    errorHandler: function(err: any) {
                        console.log('❌ Error received:', err);
                    }
                };

                const scenario: TestScenario = {
                    name: 'successful connection',
                    config: EmailReceiverTestConfigs.valid,
                    input: { payload: 'test' },
                    expectedStatus: { fill: 'green', shape: 'dot', text: 'Done, fetched 5 mails from INBOX.' },
                    timeout: 3000
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);

                // Should have received a green status
                const finalStatus = context.statuses.pop(); // Get the last status update
                expect(finalStatus.fill).to.equal('green', 'Done, fetched 5 mails from INBOX.');
                expect(finalStatus.text).to.include('Done, fetched', 'Final status text should indicate completion and fetched mails');
            });

            it('should handle connection failures gracefully', async function () {
                const invalidConfig = {
                    ...EmailReceiverTestConfigs.valid,
                    host: 'nonexistent.invalid.host.com',
                    port: 12345
                };

                const scenario: TestScenario = {
                    name: 'connection failure',
                    config: invalidConfig,
                    input: { payload: 'test' },
                    timeout: 5000
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                // Should have either error or red status (or both)
                const hasError = context.errors.length > 0;
                const hasRedStatus = context.statuses.some(s => s.fill === 'red');

                expect(hasError || hasRedStatus, 'Should have error or red status for connection failure').to.be.true;

                if (hasRedStatus) {
                    const redStatus = context.statuses.find(s => s.fill === 'red');
                    expect(redStatus!.text).to.include('error');
                }
            });
        });

        describe('Email Processing', function () {
            const processingTests = new TestScenarioBuilder()
                .addCustomScenario({
                    name: 'single email fetch',
                    config: EmailReceiverTestConfigs.valid,
                    input: { payload: 'fetch' },
                    timeout: 5000
                })
                .addCustomScenario({
                    name: 'multiple folders processing',
                    config: EmailReceiverTestConfigs.arrayFolders,
                    input: { payload: 'fetch' },
                    timeout: 5000
                });

            processingTests.getScenarios().forEach(scenario => {
                it(`should handle ${scenario.name}`, async function () {
                    const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                    // Node should be created without errors
                    expect(context.nodeInstance).to.exist;
                    NodeAssertions.expectNoErrors(context);

                    // For now, just verify the node processes input without crashing
                    // You can add more specific email processing assertions here
                });
            });
        });

        describe('Error Recovery', function () {
            it('should recover from temporary connection issues', async function () {
                // This test would verify that the node can recover from network issues
                // Implementation depends on your specific error recovery logic
                const scenario: TestScenario = {
                    name: 'error recovery',
                    config: EmailReceiverTestConfigs.valid,
                    input: { payload: 'test' },
                    timeout: 3000
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);
                expect(context.nodeInstance).to.exist;
            });
        });
    });
});