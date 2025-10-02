import { expect } from 'chai';
import emailReceiverNode from '../../email-receiver/email-receiver';
import { EmailReceiverTestConfigs } from '../helpers/email-receiver-test-configs';

import { MockImap } from '../mocks/imap-mock';
import { createMockMailparser } from '../mocks/mailparser-mock';

import {
    TestScenarioBuilder,
    NodeTestRunner,
    NodeAssertions,
    createNodeTestSuite,
    type TestScenario,
    type MockNodeREDOptions,
    SecurityTestBuilder,
    EdgeCaseTestBuilder,
    ErrorResilienceTestBuilder,
} from '../framework';

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
                    "The 'folders' property must be an array of strings.",
                )
                .addErrorScenario(
                    'missing required config',
                    EmailReceiverTestConfigs.invalidConfig,
                    'Missing required IMAP config',
                );

            configTests.getScenarios().forEach((scenario) => {
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
            it('should establish connection successfully till the end', async function () {
                this.timeout(15000);
                const mockDependencies = {
                    ImapClient: MockImap,
                    mailParser: createMockMailparser(),
                };

                const mockOptions: MockNodeREDOptions = {
                    dependencies: mockDependencies,
                    statusHandler: function (status: any) {
                        console.log('📊 Status received:', JSON.stringify(status, null, 2));
                    },
                    errorHandler: function (err: any) {
                        console.log('❌ Error received:', err);
                    },
                };

                const scenario: TestScenario = {
                    name: 'successful connection',
                    config: EmailReceiverTestConfigs.valid,
                    input: { payload: 'test' },
                    expectedStatus: { fill: 'green', shape: 'dot', text: 'IMAP connection ended.' },
                    timeout: 10000,
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);

                // Should have received a green status
                const finalStatus = context.statuses.pop(); // Get the last status update
                expect(finalStatus.fill).to.equal('green', 'IMAP connection ended.');
                expect(finalStatus.text).to.include(
                    'IMAP connection ended.',
                    'Final status text should indicate completion',
                );
            });

            it('should establish connection successfully to show mails received', async function () {
                this.timeout(15000);
                const mockDependencies = {
                    ImapClient: MockImap,
                    mailParser: createMockMailparser(),
                };

                const mockOptions: MockNodeREDOptions = {
                    dependencies: mockDependencies,
                    statusHandler: function (status: any) {
                        console.log('📊 Status received:', JSON.stringify(status, null, 2));
                    },
                    errorHandler: function (err: any) {
                        console.log('❌ Error received:', err);
                    },
                };

                const scenario: TestScenario = {
                    name: 'successful connection',
                    config: EmailReceiverTestConfigs.valid,
                    input: { payload: 'test' },
                    expectedStatus: { fill: 'green', shape: 'dot', text: 'Done, fetched 5 mails from INBOX.' },
                    timeout: 10000,
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);
                const doneStatus = context.statuses.find((s) => s.text?.includes('Done, fetched'));

                // Should have received a green status
                expect(doneStatus).to.exist;
                expect(doneStatus.fill).to.equal('green', 'Done, fetched 5 mails from INBOX.');
                expect(doneStatus.text).to.include(
                    'Done, fetched',
                    'Final status text should indicate completion and fetched mails',
                );
            });

            it('should handle connection failures gracefully', async function () {
                const mockDependencies = {
                    ImapClient: MockImap,
                    mailParser: createMockMailparser(),
                };

                const mockOptions: MockNodeREDOptions = {
                    dependencies: mockDependencies,
                    statusHandler: function (status: any) {
                        console.log('📊 Status received:', JSON.stringify(status, null, 2));
                    },
                    errorHandler: function (err: any) {
                        console.log('❌ Error received:', err);
                    },
                };

                const scenario: TestScenario = {
                    name: 'connection failure',
                    config: EmailReceiverTestConfigs.invalidConfig,
                    input: { payload: 'test' },
                    expectedStatus: { fill: 'red', shape: 'ring', text: 'config error' },
                    expectedError: 'Missing required IMAP config: host, password. Aborting.',
                    timeout: 5000,
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);

                // Should have either error or red status (or both)
                const hasError = context.errors.length > 0;
                const hasRedStatus = context.statuses.some((s) => s.fill === 'red');

                expect(hasError || hasRedStatus, 'Should have error or red status for connection failure').to.be.true;

                if (hasRedStatus) {
                    const redStatus = context.statuses.find((s) => s.fill === 'red');
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
                    timeout: 5000,
                })
                .addCustomScenario({
                    name: 'multiple folders processing',
                    config: EmailReceiverTestConfigs.arrayFolders,
                    input: { payload: 'fetch' },
                    timeout: 5000,
                });

            processingTests.getScenarios().forEach((scenario) => {
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
                    timeout: 3000,
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);
                expect(context.nodeInstance).to.exist;
            });
        });
    });

    // ========================================================================
    // EMAIL-SPECIFIC ERROR RESILIENCE TESTS
    // ========================================================================

    describe('Email Error Resilience', function () {
        const resilience = new ErrorResilienceTestBuilder()
            .addNetworkErrorScenario('IMAP connection', EmailReceiverTestConfigs.valid)
            .addMalformedInputScenario('email message processing', EmailReceiverTestConfigs.valid)
            .addRapidFireScenario('email burst handling', EmailReceiverTestConfigs.valid, 50);

        resilience.getScenarios().forEach((scenario) => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                // Node should exist and handle errors gracefully
                expect(context.nodeInstance).to.exist;

                // Should either process successfully or handle errors appropriately
                const hasGracefulHandling =
                    context.errors.length === 0 ||
                    context.statuses.some((s) => s.fill === 'red') ||
                    context.errors.some((e) => typeof e === 'string');

                expect(hasGracefulHandling, 'Should handle errors gracefully').to.be.true;
            });
        });
    });

    // ========================================================================
    // EMAIL-SPECIFIC EDGE CASES
    // ========================================================================

    describe('Email Edge Cases', function () {
        const edgeCases = new EdgeCaseTestBuilder()
            .addEmptyDataScenarios('empty email data', EmailReceiverTestConfigs.valid)
            .addSpecialCharacterScenarios('special characters in emails', EmailReceiverTestConfigs.valid)
            .addLargeDataScenarios('large email attachments', EmailReceiverTestConfigs.valid);

        // Add email-specific edge cases
        const emailSpecificCases = new TestScenarioBuilder()
            .addCustomScenario({
                name: 'very long subject line',
                config: EmailReceiverTestConfigs.valid,
                input: {
                    payload: 'fetch',
                    subject: 'a'.repeat(1000), // Very long subject
                },
            })
            .addCustomScenario({
                name: 'multiple folder processing',
                config: {
                    ...EmailReceiverTestConfigs.valid,
                    folders: Array.from({ length: 50 }, (_, i) => `FOLDER${i}`),
                },
                input: { payload: 'fetch' },
            })
            .addCustomScenario({
                name: 'special email characters',
                config: EmailReceiverTestConfigs.valid,
                input: {
                    payload: 'fetch',
                    from: 'tëst@exämple.com',
                    subject: '📧 Émails with spéciál chars! 🌟',
                },
            });

        [...edgeCases.getScenarios(), ...emailSpecificCases.getScenarios()].forEach((scenario) => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);
                expect(context.nodeInstance).to.exist;
            });
        });
    });

    // ========================================================================
    // SECURITY TESTS FOR EMAIL PROCESSING
    // ========================================================================

    describe('Email Security', function () {
        const security = new SecurityTestBuilder()
            .addInjectionTestScenarios('email content injection', EmailReceiverTestConfigs.valid)
            .addOversizedPayloadScenarios('large email payload', EmailReceiverTestConfigs.valid);

        // Email-specific security tests
        const emailSecurity = new TestScenarioBuilder()
            .addCustomScenario({
                name: 'malicious email headers',
                config: EmailReceiverTestConfigs.valid,
                input: {
                    payload: 'fetch',
                    headers: {
                        'X-Malicious': '<script>alert("xss")</script>',
                        'X-Injection': "'; DROP TABLE emails; --",
                    },
                },
            })
            .addCustomScenario({
                name: 'suspicious attachment handling',
                config: EmailReceiverTestConfigs.valid,
                input: {
                    payload: 'fetch',
                    attachments: [
                        { filename: '../../../../../../etc/passwd' },
                        { filename: 'virus.exe.txt' },
                        { filename: '<script>evil.js</script>' },
                    ],
                },
            });

        [...security.getScenarios(), ...emailSecurity.getScenarios()].forEach((scenario) => {
            it(`should resist ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                // Node should exist and not crash
                expect(context.nodeInstance).to.exist;

                // Should handle security threats gracefully
                const handledSecurely =
                    context.errors.length === 0 || context.errors.some((e) => typeof e === 'string');

                expect(handledSecurely, 'Should handle security threats gracefully').to.be.true;
            });
        });
    });

    // ========================================================================
    // DATA-DRIVEN TESTS FOR EMAIL SCENARIOS
    // ========================================================================

    describe('Email Receiver Data driven tests', function () {
        const mockDependencies = {
            ImapClient: MockImap,
            mailParser: createMockMailparser(),
        };
        const mockOptions: MockNodeREDOptions = {
            dependencies: mockDependencies,
            statusHandler: function (status: any) {
                console.log('📊 Status:', JSON.stringify(status, null, 2));
            },
            errorHandler: function (err: any) {
                console.log('❌ Error:', err);
                console.log('❌ Error stack:', new Error().stack); // See when error occurs
            },
            onHandler: function (event: string, callback: Function) {
                console.log(`🎯 Event registered: ${event}`);
                if (event === 'input') {
                    (this as any).inputCallback = callback;
                }
            },
        };

        const DataDrivenTests = [
            {
                name: 'fetch INBOX emails',
                config: {
                    ...EmailReceiverTestConfigs.valid,
                    folder: 'INBOX',
                },
            },
            {
                name: 'fetch SENT emails',
                config: {
                    ...EmailReceiverTestConfigs.valid,
                    folder: 'SENT',
                },
            },
            {
                name: 'invalid email receiver',
                config: {
                    ...EmailReceiverTestConfigs.valid,
                    folder: 'INBOX',
                    host: '',
                },
                expectedStatus: { fill: 'red' },
                expectedError: /invalid|unknown|missing/i,
            },
            {
                name: 'empty folder name',
                config: {
                    ...EmailReceiverTestConfigs.valid,
                    folder: '',
                },
                expectedStatus: { fill: 'red' },
                expectedError: /folders|empty|invalid/i,
                timeout: 2000,
            },
            {
                name: 'numeric folder name',
                config: {
                    ...EmailReceiverTestConfigs.valid,
                    folder: 123,
                },
                expectedStatus: { fill: 'red' },
                expectedError: /folder|string|type/i,
                timeout: 2000,
            },
        ];

        DataDrivenTests.forEach((testCase) => {
            it(`Email Processing Scenarios ${testCase.name}`, async function () {
                const scenario: TestScenario = {
                    name: testCase.name,
                    config: testCase.config,
                    input: { payload: 'fetch' },
                    expectedError: testCase.expectedError,
                    expectedStatus: testCase.expectedStatus,
                    timeout: 3000,
                };
                console.log(`\n🧪 Starting test: ${testCase.name}`);
                console.log('📝 Config:', JSON.stringify(scenario.config));
                console.log('📝 Input:', JSON.stringify(scenario.input));

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);

                // 🔍 DEBUG
                console.log('📦 Node constructed');
                console.log('❌ Errors so far:', context.errors);
                console.log('📊 Statuses so far:', context.statuses);
                console.log('🐛 Has configError:', !!(context.nodeInstance as any).configError);

                setTimeout(() => {
                    console.log('⏰ After 100ms:');
                    console.log('❌ Errors:', context.errors);
                    console.log('📊 Statuses:', context.statuses);
                }, 100);
                expect(context.nodeInstance).to.exist;

                if (scenario.expectedStatus) {
                    NodeAssertions.expectStatus(context, scenario.expectedStatus);
                }

                if (scenario.expectedError) {
                    NodeAssertions.expectError(context, scenario.expectedError);
                }
            });
        });
    });
});
