import { expect } from 'chai';
import emailSenderNode from '../../email-sender/email-sender';
import { EmailSenderTestConfigs, createSmtpConfigNodeHandler } from '../helpers/email-sender-test-configs';
import { createMockNodemailer } from '../mocks/nodemailer-mock';
import { TestScenario, MockNodeREDOptions, NodeTestRunner, NodeAssertions } from '../framework';

describe('E-Mail Sender Node - Connection Pooling Tests', function () {
    describe('Connection Pool Configuration', function () {
        it('should accept pooling configuration with poolEnabled=true', async function () {
            this.timeout(5000);

            const mockDependencies = {
                nodemailer: createMockNodemailer({ shouldFail: false }),
            };

            const mockOptions: MockNodeREDOptions = {
                dependencies: mockDependencies,
                getNodeHandler: createSmtpConfigNodeHandler(),
            };

            const scenario: TestScenario = {
                name: 'pooled config test',
                config: EmailSenderTestConfigs.pooled,
                input: { payload: 'Test email', topic: 'Test' },
                timeout: 3000,
            };

            const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);
            expect(context.nodeInstance).to.exist;
            NodeAssertions.expectNoErrors(context);
        });

        it('should accept pooling configuration with poolEnabled=false', async function () {
            this.timeout(5000);

            const mockDependencies = {
                nodemailer: createMockNodemailer({ shouldFail: false }),
            };

            const mockOptions: MockNodeREDOptions = {
                dependencies: mockDependencies,
                getNodeHandler: createSmtpConfigNodeHandler(),
            };

            const scenario: TestScenario = {
                name: 'non-pooled config test',
                config: EmailSenderTestConfigs.valid, // pooling disabled
                input: { payload: 'Test email', topic: 'Test' },
                timeout: 3000,
            };

            const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);
            expect(context.nodeInstance).to.exist;
            NodeAssertions.expectNoErrors(context);
        });

        it('should respect poolSize and poolTimeout configuration', async function () {
            this.timeout(5000);

            const mockDependencies = {
                nodemailer: createMockNodemailer({ shouldFail: false }),
            };

            const mockOptions: MockNodeREDOptions = {
                dependencies: mockDependencies,
                getNodeHandler: createSmtpConfigNodeHandler(),
            };

            const scenario: TestScenario = {
                name: 'pool configuration test',
                config: EmailSenderTestConfigs.pooled,
                input: { payload: 'Test email', topic: 'Test' },
                timeout: 3000,
            };

            const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);
            expect(context.nodeInstance).to.exist;
            NodeAssertions.expectNoErrors(context);

            // Verify pooling config is accessible
            const configNode = (mockOptions.getNodeHandler as any)('pooled-smtp-config');
            expect(configNode).to.exist;
            expect(configNode.poolEnabled).to.be.true;
            expect(configNode.poolSize).to.equal(5);
            expect(configNode.poolTimeout).to.equal(5000);
        });
    });
});
