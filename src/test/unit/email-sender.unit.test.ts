import { expect } from 'chai';
import emailSenderNode  from '../../email-sender/email-sender';
import { EmailSenderTestConfigs } from '../helpers/email-sender-test-configs';

import { createMockNodemailer, withNodemailerMock } from '../mocks/nodemailer-mock';

import {
  TestScenarioBuilder,
  NodeTestRunner,
  NodeAssertions,
  createNodeTestSuite,
  ErrorResilienceTestBuilder,
  EdgeCaseTestBuilder,
  type TestScenario,
  MockNodeREDOptions
} from '../framework';

describe('E-Mail Sender Node - Unit Tests', function () {

    // ========================================================================
    // USE GENERIC TEST SUITE FOR BASIC FUNCTIONALITY
    // ========================================================================

    createNodeTestSuite('Email Sender', emailSenderNode, EmailSenderTestConfigs);

    // ========================================================================
    // SPECIFIC EMAIL SENDER TESTS
    // ========================================================================

    describe('Email Sender Specific Tests', function () {

        describe('Configuration Validation', function () {
                const configTests = new TestScenarioBuilder()
                    .addValidScenario('valid configuration', EmailSenderTestConfigs.valid)
                    .addValidScenario('minimal configuration', EmailSenderTestConfigs.minimal)
                    .addErrorScenario(
                        'missing required config',
                        EmailSenderTestConfigs.invalid,
                        'Required property \'sender\' is missing',
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

        describe('Email Sending Functionality', function () {
            const emailSendingTests = new TestScenarioBuilder()
                .addStatusScenario(
                    'successful email send',
                    EmailSenderTestConfigs.valid,
                    { fill: 'green', text: 'sent' },
                    { payload: 'test', topic: 'test message' },
                    withNodemailerMock({ shouldFail: false })
                )
                .addStatusScenario(
                    'send mail error',
                    { ...EmailSenderTestConfigs.valid, shouldFail: true },
                    { fill: 'red', text: 'error sending' },
                    { payload: 'test', topic: 'test message' },
                    withNodemailerMock({ shouldFail: true })
                )
                .addStatusScenario(
                    'rejected email',
                    { ...EmailSenderTestConfigs.valid, rejectedEmails: ['recipient@example.com'] },
                    { fill: 'red', text: 'rejected' },
                    { payload: 'test', topic: 'test message' },
                    withNodemailerMock({ rejectedEmails: ['recipient@example.com'] })
                )
                .addStatusScenario(
                    'pending email',
                    { ...EmailSenderTestConfigs.valid, pendingEmails: ['recipient@example.com'] },
                    { fill: 'yellow', text: 'pending' },
                    { payload: 'test', topic: 'test message' },
                    withNodemailerMock({ pendingEmails: ['recipient@example.com'] })
                );

            emailSendingTests.getScenarios().forEach(scenario => {
                it(`should handle ${scenario.name}`, async function () {
                    const mockOptions: MockNodeREDOptions = scenario.mockOptions || {};
                    const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);

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

        describe('Attachment Handling', function () {
            const mockDependencies = {
                nodemailer: createMockNodemailer({
                    shouldFail: false,
                    acceptedEmails: []
                })
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

            const attachmentTests = [
                {
                    name: 'array of attachments',
                    config: {
                        ...EmailSenderTestConfigs.valid,
                        attachments: JSON.stringify([
                            { filename: 'test1.txt', content: 'First file' },
                            { filename: 'test2.txt', content: 'Second file' }
                        ]),
                        attachmentsType: 'json'
                    },
                    input: { payload: 'test', topic: 'test message' },
                    expectedStatus: { fill: 'green', text: 'sent' },
                },
                {
                    name: 'single attachment object',
                    config: {
                        ...EmailSenderTestConfigs.valid,
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
                        ...EmailSenderTestConfigs.valid,
                        attachments: '',
                        attachmentsType: 'str'
                    },
                    input: { payload: 'test', topic: 'test message' },
                    expectedStatus: { fill: 'green', text: 'sent' }
                },
                {
                    name: 'malformed attachments',
                    config: {
                        ...EmailSenderTestConfigs.valid,
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

                    const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);

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

        describe('Email Sender Data driven tests', function () {

            const mockDependencies = {
                    nodemailer: createMockNodemailer({
                        shouldFail: false,
                        acceptedEmails: []
                    })
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

            const DataDrivenTests =
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

            DataDrivenTests.forEach(testCase => {
                it(`should handle ${testCase.name}`, async function () {
                    const scenario: TestScenario = {
                        name: testCase.name,
                        config: EmailSenderTestConfigs.minimalDataDriven,
                        input: testCase.input,
                        expectedOutput: testCase.expectedOutput,
                        expectedError: testCase.expectedError,
                        timeout: 10000
                    };

                    const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);

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
    // ERROR RESILIENCE TESTS
    // ========================================================================

    describe('Error Resilience', function () {
        const resilience = new ErrorResilienceTestBuilder()
            .addMalformedInputScenario('email input', EmailSenderTestConfigs.valid)
            .addRapidFireScenario('rapid email sending', EmailSenderTestConfigs.valid, 10);

        const mockDependencies = {
                nodemailer: createMockNodemailer({
                    shouldFail: false,
                    acceptedEmails: []
                })
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

        // Add email-specific error scenarios
        const emailErrors = new TestScenarioBuilder()
            .addErrorScenario(
                'invalid SMTP config',
                {
                    ...EmailSenderTestConfigs.valid,
                    smtpHost: 'invalid.smtp.server',
                    smtpPort: 99999
                },
                /connection|smtp|invalid/i,
                { payload: 'test', topic: 'test' }
            )
            .addErrorScenario(
                'authentication failure',
                {
                    ...EmailSenderTestConfigs.valid,
                    smtpUser: 'invalid@user.com',
                    smtpPassword: 'wrongpassword'
                },
                /auth|login|credential/i,
                { payload: 'test', topic: 'test' }
            );

        [...resilience.getScenarios(), ...emailErrors.getScenarios()].forEach(scenario => {
            it(`should handle ${scenario.name}`, async function () {
                const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);

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
    // EDGE CASES FOR EMAIL SENDING
    // ========================================================================

    describe('Email Edge Cases', function () {
        const edgeCases = new EdgeCaseTestBuilder()
            .addEmptyDataScenarios('empty email data', EmailSenderTestConfigs.valid)
            .addSpecialCharacterScenarios('special characters in emails', EmailSenderTestConfigs.valid);

        // Email-specific edge cases
        const emailEdgeCases = new TestScenarioBuilder()
            .addCustomScenario({
                name: 'very long subject line',
                config: EmailSenderTestConfigs.valid,
                input: {
                    payload: 'test',
                    topic: 'a'.repeat(1000) // Very long subject
                }
            })
            .addCustomScenario({
                name: 'Unicode characters in email',
                config: EmailSenderTestConfigs.valid,
                input: {
                    payload: 'Héllo Wörld! 🌟',
                    topic: 'Tëst Émails 📧',
                    to: 'tëst@exämple.com'
                }
            })
            .addCustomScenario({
                name: 'very large email content',
                config: EmailSenderTestConfigs.valid,
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
                config: EmailSenderTestConfigs.valid,
                input: {
                    payload: 'Multi-recipient test',
                    topic: 'Multiple Recipients',
                    to: 'user1@example.com,user2@example.com,user3@example.com'
                }
            },
            {
                name: 'email with CC and BCC',
                config: EmailSenderTestConfigs.valid,
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
                    ...EmailSenderTestConfigs.valid,
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
                config: EmailSenderTestConfigs.valid,
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
                config: EmailSenderTestConfigs.minimal
            };

            const context = await NodeTestRunner.runScenario(emailSenderNode, scenario);
            expect(context.mockRED.nodes.lastRegisteredType).to.equal('email-sender');
        });
    });
});
});