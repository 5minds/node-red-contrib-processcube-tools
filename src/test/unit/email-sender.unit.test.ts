import { expect } from 'chai';
import {
  TestScenarioBuilder,
  NodeTestRunner,
  NodeAssertions,
  TestPatternHelpers,
  ErrorResilienceTestBuilder,
  DataValidationTestBuilder,
  EdgeCaseTestBuilder,
  type TestScenario
} from '../framework';

import { EmailSenderTestConfigs } from '../helpers/email-sender-test-configs';

// Import your email sender node
const emailSenderNode = require('../../email-sender/email-sender');

describe('E-Mail Sender Node - Unit Tests', function () {

    // ========================================================================
    // BASIC FUNCTIONALITY USING GENERIC TEST SUITE
    // ========================================================================

    describe('Configuration Validation', function () {
            const configTests = new TestScenarioBuilder()
                .addValidScenario('valid configuration', EmailSenderTestConfigs.valid)
                .addValidScenario('minimal configuration', EmailSenderTestConfigs.minimal)
                .addErrorScenario(
                    'missing required config',
                    EmailSenderTestConfigs.invalid,
                    'Missing required IMAP config'
                );

            configTests.getScenarios().forEach(scenario => {
                it(`should handle ${scenario.name}`, async function () {
                    const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);

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

    // ========================================================================
    // EMAIL SENDER SPECIFIC TESTS
    // ========================================================================

    describe('Email Sending Functionality', function () {
        const emailSendingTests = new TestScenarioBuilder()
            .addStatusScenario(
                'successful email send',
                emailSenderConfigs.valid,
                { fill: 'green', text: 'sent' },
                { payload: 'test', topic: 'test message' }
            )
            .addStatusScenario(
                'send mail error',
                { ...emailSenderConfigs.valid, shouldFail: true },
                { fill: 'red', text: 'error sending' },
                { payload: 'test', topic: 'test message' }
            )
            .addStatusScenario(
                'rejected email',
                { ...emailSenderConfigs.valid, rejectedEmails: ['recipient@example.com'] },
                { fill: 'red', text: 'rejected' },
                { payload: 'test', topic: 'test message' }
            )
            .addStatusScenario(
                'pending email',
                { ...emailSenderConfigs.valid, pendingEmails: ['recipient@example.com'] },
                { fill: 'yellow', text: 'pending' },
                { payload: 'test', topic: 'test message' }
            );

        emailSendingTests.getScenarios().forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);

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

    // ========================================================================
    // ATTACHMENT HANDLING TESTS
    // ========================================================================

    describe('Attachment Handling', function () {
        const attachmentTests = [
            {
                name: 'array of attachments',
                config: {
                    ...emailSenderConfigs.valid,
                    attachments: JSON.stringify([
                        { filename: 'test1.txt', content: 'First file' },
                        { filename: 'test2.txt', content: 'Second file' }
                    ]),
                    attachmentsType: 'json'
                },
                input: { payload: 'test', topic: 'test message' },
                expectedStatus: { fill: 'green', text: 'sent' }
            },
            {
                name: 'single attachment object',
                config: {
                    ...emailSenderConfigs.valid,
                    attachments: JSON.stringify({
                        filename: 'single-test.txt',
                        content: 'Single file content'
                    }),
                    attachmentsType: 'json'
                },
                input: { payload: 'test', topic: 'test message' },
                expectedStatus: { fill: 'green', text: 'sent' }
            },
            {
                name: 'empty attachments string',
                config: {
                    ...emailSenderConfigs.valid,
                    attachments: '',
                    attachmentsType: 'str'
                },
                input: { payload: 'test', topic: 'test message' },
                expectedStatus: { fill: 'green', text: 'sent' }
            },
            {
                name: 'malformed attachments',
                config: {
                    ...emailSenderConfigs.valid,
                    attachments: JSON.stringify([
                        { filename: 'valid.txt', content: 'Valid content' },
                        { filename: 'invalid.txt' } // Missing content
                    ]),
                    attachmentsType: 'json'
                },
                input: { payload: 'test', topic: 'test message' },
                expectedError: "Attachment object is missing 'filename' or 'content' property."
            }
        ];

        attachmentTests.forEach(testCase => {
            it(`should handle ${testCase.name}`, async function () {
                const scenario: TestScenario = {
                    name: testCase.name,
                    config: testCase.config,
                    input: testCase.input,
                    expectedStatus: testCase.expectedStatus,
                    expectedError: testCase.expectedError,
                    timeout: 3000
                };

                const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);

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

    // ========================================================================
    // DATA-DRIVEN EMAIL CONFIGURATION TESTS
    // ========================================================================

    TestPatternHelpers.createDataDrivenTests(
        'Email Configuration Tests',
        emailSenderNode,
        emailSenderConfigs.valid,
        [
            {
                name: 'basic text email',
                input: {
                    payload: 'Hello World',
                    topic: 'Test Subject',
                    to: 'test@example.com'
                },
                expectedOutput: { payload: 'Hello World' } // Assuming node passes through
            },
            {
                name: 'HTML email',
                input: {
                    payload: '<h1>Hello World</h1>',
                    topic: 'HTML Test',
                    to: 'test@example.com',
                    html: true
                }
            },
            {
                name: 'email with custom headers',
                input: {
                    payload: 'Custom headers test',
                    topic: 'Custom Headers',
                    to: 'test@example.com',
                    headers: { 'X-Custom': 'test-header' }
                }
            },
            {
                name: 'empty payload',
                input: {
                    payload: '',
                    topic: 'Empty Content',
                    to: 'test@example.com'
                }
            },
            {
                name: 'missing recipient',
                input: {
                    payload: 'No recipient test',
                    topic: 'No Recipient'
                },
                expectedError: /recipient|to|email/i
            }
        ]
    );

    // ========================================================================
    // ERROR RESILIENCE TESTS
    // ========================================================================

    describe('Error Resilience', function () {
        const resilience = new ErrorResilienceTestBuilder()
            .addMalformedInputScenario('email input', emailSenderConfigs.valid)
            .addRapidFireScenario('rapid email sending', emailSenderConfigs.valid, 10);

        // Add email-specific error scenarios
        const emailErrors = new TestScenarioBuilder()
            .addErrorScenario(
                'invalid SMTP config',
                {
                    ...emailSenderConfigs.valid,
                    smtpHost: 'invalid.smtp.server',
                    smtpPort: 99999
                },
                /connection|smtp|invalid/i,
                { payload: 'test', topic: 'test' }
            )
            .addErrorScenario(
                'authentication failure',
                {
                    ...emailSenderConfigs.valid,
                    smtpUser: 'invalid@user.com',
                    smtpPassword: 'wrongpassword'
                },
                /auth|login|credential/i,
                { payload: 'test', topic: 'test' }
            );

        [...resilience.getScenarios(), ...emailErrors.getScenarios()].forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);

                expect(context.nodeInstance).to.exist;

                if (scenario.expectedError) {
                    NodeAssertions.expectError(context, scenario.expectedError);
                } else {
                    // Should handle gracefully without crashing
                    const handledGracefully =
                        context.errors.length === 0 ||
                        context.statuses.some(s => s.fill === 'red');
                    expect(handledGracefully).to.be.true;
                }
            });
        });
    });

    // ========================================================================
    // EMAIL DATA VALIDATION
    // ========================================================================

    describe('Email Data Validation', function () {
        const validation = new DataValidationTestBuilder()
            .addTypeValidationScenario(
                'email addresses',
                emailSenderConfigs.valid,
                'email',
                [
                    'test@example.com',
                    'user.name@example.co.uk',
                    'test+tag@example.com'
                ],
                [
                    'invalid-email',
                    '@example.com',
                    'test@',
                    123,
                    null
                ]
            )
            .addBoundaryValueScenario(
                'attachment sizes',
                emailSenderConfigs.valid,
                {
                    min: { filename: 'small.txt', content: 'x' },
                    max: { filename: 'large.txt', content: 'x'.repeat(1000) },
                    belowMin: { filename: '' }, // Empty filename
                    aboveMax: { filename: 'huge.txt', content: 'x'.repeat(10000000) } // Very large
                }
            );

        validation.getScenarios().forEach(scenario => {
            it(`should validate ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);

                expect(context.nodeInstance).to.exist;

                if (scenario.expectedError) {
                    NodeAssertions.expectError(context, scenario.expectedError);
                } else {
                    NodeAssertions.expectNoErrors(context);
                }
            });
        });
    });

    // ========================================================================
    // EDGE CASES FOR EMAIL SENDING
    // ========================================================================

    describe('Email Edge Cases', function () {
        const edgeCases = new EdgeCaseTestBuilder()
            .addEmptyDataScenarios('empty email data', emailSenderConfigs.valid)
            .addSpecialCharacterScenarios('special characters in emails', emailSenderConfigs.valid);

        // Email-specific edge cases
        const emailEdgeCases = new TestScenarioBuilder()
            .addCustomScenario({
                name: 'very long subject line',
                config: emailSenderConfigs.valid,
                input: {
                    payload: 'test',
                    topic: 'a'.repeat(1000) // Very long subject
                }
            })
            .addCustomScenario({
                name: 'Unicode characters in email',
                config: emailSenderConfigs.valid,
                input: {
                    payload: 'Héllo Wörld! 🌟',
                    topic: 'Tëst Émails 📧',
                    to: 'tëst@exämple.com'
                }
            })
            .addCustomScenario({
                name: 'very large email content',
                config: emailSenderConfigs.valid,
                input: {
                    payload: 'x'.repeat(100000), // 100KB content
                    topic: 'Large Email Test'
                }
            });

        [...edgeCases.getScenarios(), ...emailEdgeCases.getScenarios()].forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);
                expect(context.nodeInstance).to.exist;

                // Should either succeed or fail gracefully
                const handledWell =
                    context.errors.length === 0 ||
                    context.statuses.some(s => ['red', 'yellow'].includes(s.fill));
                expect(handledWell).to.be.true;
            });
        });
    });

    // ========================================================================
    // COMPREHENSIVE EMAIL SCENARIOS
    // ========================================================================

    describe('Complex Email Scenarios', function () {
        const complexScenarios = [
            {
                name: 'email with multiple recipients',
                config: emailSenderConfigs.valid,
                input: {
                    payload: 'Multi-recipient test',
                    topic: 'Multiple Recipients',
                    to: 'user1@example.com,user2@example.com,user3@example.com'
                }
            },
            {
                name: 'email with CC and BCC',
                config: emailSenderConfigs.valid,
                input: {
                    payload: 'CC/BCC test',
                    topic: 'Carbon Copy Test',
                    to: 'primary@example.com',
                    cc: 'cc@example.com',
                    bcc: 'bcc@example.com'
                }
            },
            {
                name: 'email with mixed attachment types',
                config: {
                    ...emailSenderConfigs.valid,
                    attachments: JSON.stringify([
                        { filename: 'text.txt', content: 'Text file' },
                        { filename: 'data.json', content: '{"test": true}' },
                        { filename: 'image.jpg', content: 'base64encodeddata...' }
                    ])
                },
                input: {
                    payload: 'Mixed attachments test',
                    topic: 'Multiple Attachment Types'
                }
            },
            {
                name: 'email with custom priority',
                config: emailSenderConfigs.valid,
                input: {
                    payload: 'High priority email',
                    topic: 'URGENT: Priority Test',
                    priority: 'high'
                }
            }
        ];

        complexScenarios.forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const testScenario: TestScenario = {
                    name: scenario.name,
                    config: scenario.config,
                    input: scenario.input,
                    timeout: 5000
                };

                const context = await NodeTestRunner.runScenario(emailSenderNode, testScenario);

                expect(context.nodeInstance).to.exist;

                // Should either send successfully or handle errors gracefully
                const hasStatus = context.statuses.length > 0;
                expect(hasStatus, 'Should update status for complex scenarios').to.be.true;
            });
        });
    });

    // ========================================================================
    // LEGACY COMPATIBILITY
    // ========================================================================

    describe('Legacy Compatibility', function () {
        it('should maintain module export signature', function () {
            expect(emailSenderNode).to.be.a('function');
            expect(emailSenderNode.length).to.equal(1); // Should accept RED parameter
        });

        it('should register with correct node type', async function () {
            const scenario: TestScenario = {
                name: 'node type registration',
                config: emailSenderConfigs.minimal
            };

            const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);
            expect(context.mockRED.nodes.lastRegisteredType).to.equal('email-sender');
        });
    });
});