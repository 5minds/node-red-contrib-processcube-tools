import { expect } from 'chai';
import emailReceiverNode from '../../email-receiver/email-receiver';
import { createMockMailparser, MockImap, setupModuleMocks, testConfigs } from '../helpers/email-receiver.mocks';

// Import our test framework
import {
  TestScenarioBuilder,
  NodeTestRunner,
  NodeAssertions,
  createNodeTestSuite,
  type TestScenario,
  type MockNodeREDOptions
} from '../framework';

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

    // ========================================================================
    // USE GENERIC TEST SUITE FOR BASIC FUNCTIONALITY
    // ========================================================================

    createNodeTestSuite('Email Receiver', emailReceiverNode, testConfigs);

    // ========================================================================
    // SPECIFIC EMAIL RECEIVER TESTS
    // ========================================================================

    describe('Email Receiver Specific Tests', function () {

        describe('Configuration Validation', function () {
            const configTests = new TestScenarioBuilder()
                .addValidScenario('valid configuration', testConfigs.valid)
                .addValidScenario('minimal configuration', testConfigs.minimal)
                .addValidScenario('array folders configuration', testConfigs.arrayFolders)
                .addErrorScenario(
                    'invalid folder type',
                    testConfigs.invalidFolderType,
                    "The 'folders' property must be an array of strings."
                )
                .addErrorScenario(
                    'missing required config',
                    testConfigs.invalidConfig,
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
                    Imap: MockImap,
                    MailParser: createMockMailparser()
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
                    config: testConfigs.valid,
                    input: { payload: 'test' },
                    expectedStatus: { fill: 'green' },
                    timeout: 3000
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);

                // Should have received a green status
                const hasGreenStatus = context.statuses.some(s => s.fill === 'green');
                expect(hasGreenStatus, 'Should have received green status indicating successful connection').to.be.true;
            });

            it('should handle connection failures gracefully', async function () {
                const invalidConfig = {
                    ...testConfigs.valid,
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
                    config: testConfigs.valid,
                    input: { payload: 'fetch' },
                    timeout: 5000
                })
                .addCustomScenario({
                    name: 'multiple folders processing',
                    config: testConfigs.arrayFolders,
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
                    config: testConfigs.valid,
                    input: { payload: 'test' },
                    timeout: 3000
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);
                expect(context.nodeInstance).to.exist;
            });
        });
    });
});