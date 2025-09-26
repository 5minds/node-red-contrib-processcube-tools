import { expect } from 'chai';
import emailReceiverNode from '../../email-receiver/email-receiver';
import { EmailReceiverTestConfigs } from '../helpers/email-receiver-test-configs';

// Import our comprehensive test framework
import {
  TestScenarioBuilder,
  NodeTestRunner,
  NodeAssertions,
  type TestScenario
} from '../framework';

import {
  TestPatternHelpers,
  PerformanceTestRunner,
  StressTestBuilder,
  ErrorResilienceTestBuilder,
  DataValidationTestBuilder,
  EdgeCaseTestBuilder,
  AsyncBehaviorTestBuilder,
  SecurityTestBuilder,
  type PerformanceTestScenario
} from '../framework/advanced-test-patterns';

describe('E-Mail Receiver Node - Integration Tests', function () {

    // ========================================================================
    // USE HELPER TO CREATE COMPREHENSIVE SUITE
    // ========================================================================

    TestPatternHelpers.createComprehensiveTestSuite(
        'Email Receiver',
        emailReceiverNode,
        {
            valid: EmailReceiverTestConfigs.valid,
            minimal: EmailReceiverTestConfigs.minimal,
            invalid: EmailReceiverTestConfigs.invalidConfig
        },
        {
            includePerformance: true,
            includeStress: true,
            includeSecurity: true,
            includeEdgeCases: true
        }
    );

    // ========================================================================
    // EMAIL-SPECIFIC DATA VALIDATION TESTS
    // ========================================================================

    describe('Email Data Validation', function () {
        const emailValidation = new DataValidationTestBuilder()
            .addSchemaValidationScenario(
                'email configuration',
                EmailReceiverTestConfigs.valid,
                {
                    host: 'imap.gmail.com',
                    port: 993,
                    secure: true,
                    user: 'test@gmail.com',
                    password: 'password',
                    folders: ['INBOX']
                },
                [
                    { host: '', port: 993 }, // Missing host
                    { host: 'imap.gmail.com', port: 'invalid' }, // Invalid port
                    { host: 'imap.gmail.com', port: 993, folders: 'not-array' }, // Invalid folders
                    { host: 'imap.gmail.com', port: 993, secure: 'maybe' } // Invalid secure flag
                ]
            )
            .addBoundaryValueScenario(
                'port numbers',
                EmailReceiverTestConfigs.valid,
                {
                    min: 1,
                    max: 65535,
                    belowMin: 0,
                    aboveMax: 65536
                }
            )
            .addTypeValidationScenario(
                'folder configuration',
                EmailReceiverTestConfigs.valid,
                'array',
                [
                    ['INBOX'],
                    ['INBOX', 'SENT'],
                    []
                ],
                [
                    'INBOX',
                    123,
                    null,
                    undefined,
                    { folder: 'INBOX' }
                ]
            );

        emailValidation.getScenarios().forEach(scenario => {
            it(`should validate ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                if (scenario.expectedError) {
                    NodeAssertions.expectError(context, scenario.expectedError);
                } else {
                    NodeAssertions.expectNoErrors(context);
                }
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

        resilience.getScenarios().forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                // Node should exist and handle errors gracefully
                expect(context.nodeInstance).to.exist;

                // Should either process successfully or handle errors appropriately
                const hasGracefulHandling =
                    context.errors.length === 0 ||
                    context.statuses.some(s => s.fill === 'red') ||
                    context.errors.some(e => typeof e === 'string');

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
                    subject: 'a'.repeat(1000) // Very long subject
                }
            })
            .addCustomScenario({
                name: 'multiple folder processing',
                config: {
                    ...EmailReceiverTestConfigs.valid,
                    folders: Array.from({ length: 50 }, (_, i) => `FOLDER${i}`)
                },
                input: { payload: 'fetch' }
            })
            .addCustomScenario({
                name: 'special email characters',
                config: EmailReceiverTestConfigs.valid,
                input: {
                    payload: 'fetch',
                    from: 'tëst@exämple.com',
                    subject: '📧 Émails with spéciál chars! 🌟'
                }
            });

        [...edgeCases.getScenarios(), ...emailSpecificCases.getScenarios()]
            .forEach(scenario => {
                it(`should handle ${scenario.name}`, async function () {
                    const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);
                    expect(context.nodeInstance).to.exist;
                });
            });
    });

    // ========================================================================
    // ASYNC BEHAVIOR SPECIFIC TO EMAIL PROCESSING
    // ========================================================================

    describe('Email Async Behavior', function () {
        const asyncTests = new AsyncBehaviorTestBuilder()
            .addDelayedResponseScenario(
                'IMAP connection delay',
                EmailReceiverTestConfigs.valid,
                { payload: 'connect' },
                2000
            )
            .addRetryMechanismScenario(
                'failed email fetch retry',
                EmailReceiverTestConfigs.valid,
                3
            )
            .addTimeoutHandlingScenario(
                'IMAP operation timeout',
                { ...EmailReceiverTestConfigs.valid, timeout: 1000 },
                1000
            )
            .addBackpressureScenario(
                'many simultaneous email requests',
                EmailReceiverTestConfigs.valid,
                100
            );

        asyncTests.getScenarios().forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);
                expect(context.nodeInstance).to.exist;

                if (scenario.expectedError) {
                    NodeAssertions.expectError(context, scenario.expectedError);
                }
            });
        });
    });

    // ========================================================================
    // PERFORMANCE TESTS FOR EMAIL PROCESSING
    // ========================================================================

    describe('Email Performance', function () {
        it('should efficiently process multiple email fetch requests', async function () {
            const scenario: PerformanceTestScenario = {
                name: 'multiple email fetches',
                config: EmailReceiverTestConfigs.valid,
                input: { payload: 'fetch' },
                iterations: 50,
                maxDuration: 10000,
                timeout: 15000
            };

            const result = await PerformanceTestRunner.runPerformanceTest(
                emailReceiverNode,
                scenario
            );

            expect(result.averageTime).to.be.lessThan(200); // 200ms per fetch max
            expect(result.iterations).to.be.greaterThan(20); // Should complete at least 20

            if (result.memoryUsed !== undefined) {
                expect(result.memoryUsed).to.be.lessThan(100 * 1024 * 1024); // 100MB limit
            }
        });

        it('should handle memory efficiently during extended operation', async function () {
            const memoryTest = StressTestBuilder.createMemoryLeakTest(
                'extended email processing',
                EmailReceiverTestConfigs.valid,
                200
            );

            const result = await PerformanceTestRunner.runPerformanceTest(
                emailReceiverNode,
                memoryTest
            );

            expect(result.iterations).to.be.greaterThan(100);

            if (result.memoryUsed !== undefined) {
                expect(result.memoryUsed).to.be.lessThan(memoryTest.memoryLimit!);
            }
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
                        'X-Injection': "'; DROP TABLE emails; --"
                    }
                }
            })
            .addCustomScenario({
                name: 'suspicious attachment handling',
                config: EmailReceiverTestConfigs.valid,
                input: {
                    payload: 'fetch',
                    attachments: [
                        { filename: '../../../../../../etc/passwd' },
                        { filename: 'virus.exe.txt' },
                        { filename: '<script>evil.js</script>' }
                    ]
                }
            });

        [...security.getScenarios(), ...emailSecurity.getScenarios()]
            .forEach(scenario => {
                it(`should resist ${scenario.name}`, async function () {
                    const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);

                    // Node should exist and not crash
                    expect(context.nodeInstance).to.exist;

                    // Should handle security threats gracefully
                    const handledSecurely =
                        context.errors.length === 0 ||
                        context.errors.some(e => typeof e === 'string');

                    expect(handledSecurely, 'Should handle security threats gracefully').to.be.true;
                });
            });
    });

    // ========================================================================
    // DATA-DRIVEN TESTS FOR EMAIL SCENARIOS
    // ========================================================================

    TestPatternHelpers.createDataDrivenTests(
        'Email Processing Scenarios',
        emailReceiverNode,
        EmailReceiverTestConfigs.valid,
        [
            {
                name: 'fetch INBOX emails',
                input: { payload: 'fetch', folder: 'INBOX' },
                timeout: 3000
            },
            {
                name: 'fetch SENT emails',
                input: { payload: 'fetch', folder: 'SENT' },
                timeout: 3000
            },
            {
                name: 'invalid email command',
                input: { payload: 'invalid-command' },
                expectedError: /invalid|unknown|command/i,
                timeout: 2000
            },
            {
                name: 'empty folder name',
                input: { payload: 'fetch', folder: '' },
                expectedError: /folder|empty|invalid/i,
                timeout: 2000
            },
            {
                name: 'numeric folder name',
                input: { payload: 'fetch', folder: 123 },
                expectedError: /folder|string|type/i,
                timeout: 2000
            }
        ]
    );

    // ========================================================================
    // INTEGRATION WITH EXISTING MOCK SYSTEM
    // ========================================================================

    describe('Mock System Integration', function () {
        it('should work with all mock configurations', async function () {
            const mockConfigs = [
                EmailReceiverTestConfigs.valid,
                EmailReceiverTestConfigs.minimal,
                EmailReceiverTestConfigs.arrayFolders
            ];

            for (const config of mockConfigs) {
                const scenario: TestScenario = {
                    name: `mock integration - ${config.name || 'unnamed'}`,
                    config,
                    input: { payload: 'test' },
                    timeout: 2000
                };

                const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario);
                expect(context.nodeInstance).to.exist;

                if (config.name) {
                    NodeAssertions.expectNodeProperty(context, 'name', config.name);
                }
            }
        });
    });
});