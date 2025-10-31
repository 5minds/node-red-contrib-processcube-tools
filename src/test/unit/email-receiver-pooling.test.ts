import { expect } from 'chai';
import emailReceiverNode from '../../email-receiver/email-receiver';
import { EmailReceiverTestConfigs, createImapConfigNodeHandler } from '../helpers/email-receiver-test-configs';
import { MockImap } from '../mocks/imap-mock';
import { createMockMailparser } from '../mocks/mailparser-mock';
import { TestScenario, MockNodeREDOptions, NodeTestRunner, NodeAssertions } from '../framework';

describe('E-Mail Receiver Node - Connection Pooling Tests', function () {
    describe('Connection Pool Configuration', function () {
        it('should accept pooling configuration with poolEnabled=true', async function () {
            this.timeout(15000);

            const mockDependencies = {
                ImapClient: MockImap,
                mailParser: createMockMailparser(),
            };

            const mockOptions: MockNodeREDOptions = {
                dependencies: mockDependencies,
                getNodeHandler: createImapConfigNodeHandler(),
            };

            const scenario: TestScenario = {
                name: 'pooled config test',
                config: EmailReceiverTestConfigs.pooled,
                input: { payload: 'trigger' },
                timeout: 10000,
            };

            const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);
            expect(context.nodeInstance).to.exist;

            // Verify pooling config is accessible
            const configNode = (mockOptions.getNodeHandler as any)('pooled-imap-config');
            expect(configNode).to.exist;
            expect(configNode.poolEnabled).to.be.true;
            expect(configNode.poolTimeout).to.equal(5000);
        });

        it('should accept pooling configuration with poolEnabled=false', async function () {
            this.timeout(15000);

            const mockDependencies = {
                ImapClient: MockImap,
                mailParser: createMockMailparser(),
            };

            const mockOptions: MockNodeREDOptions = {
                dependencies: mockDependencies,
                getNodeHandler: createImapConfigNodeHandler(),
            };

            const scenario: TestScenario = {
                name: 'non-pooled config test',
                config: EmailReceiverTestConfigs.valid, // pooling disabled
                input: { payload: 'trigger' },
                timeout: 10000,
            };

            const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);
            expect(context.nodeInstance).to.exist;

            // Verify pooling is disabled
            const configNode = (mockOptions.getNodeHandler as any)('valid-imap-config');
            expect(configNode).to.exist;
            expect(configNode.poolEnabled).to.be.false;
        });

        it('should handle multiple folders with pooled connection', async function () {
            this.timeout(15000);

            const mockDependencies = {
                ImapClient: MockImap,
                mailParser: createMockMailparser(),
            };

            const mockOptions: MockNodeREDOptions = {
                dependencies: mockDependencies,
                getNodeHandler: createImapConfigNodeHandler(),
            };

            const scenario: TestScenario = {
                name: 'multiple folders with pooling',
                config: {
                    ...EmailReceiverTestConfigs.pooled,
                    folder: ['INBOX', 'SENT', 'DRAFTS'],
                },
                input: { payload: 'trigger' },
                expectedStatus: { fill: 'green' },
                timeout: 10000,
            };

            const context = await NodeTestRunner.runScenario(emailReceiverNode, scenario, mockOptions);
            expect(context.nodeInstance).to.exist;

            // Should have at least one green status (success)
            const hasGreenStatus = context.statuses.some((s) => s.fill === 'green');
            expect(hasGreenStatus).to.be.true;
        });
    });
});
