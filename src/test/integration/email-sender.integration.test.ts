import { expect } from 'chai';
import emailSenderNode from '../../email-sender/email-sender';
import { EmailSenderTestConfigs, createSmtpConfigNodeHandler } from '../helpers/email-sender-test-configs';

// Import our comprehensive test framework
import { NodeTestRunner, NodeAssertions, TestScenario, MockNodeREDOptions } from '../framework';

describe('E-Mail Sender Node - Integration Tests', function () {
    // ========================================================================
    // INTEGRATION WITH MOCK SYSTEM
    // ========================================================================

    describe('Mock System Integration', function () {
        it('should work with all mock configurations', async function () {
            const mockConfigs = [
                EmailSenderTestConfigs.valid,
                EmailSenderTestConfigs.minimal,
                EmailSenderTestConfigs.withAttachments,
            ];

            const mockOptions: MockNodeREDOptions = {
                getNodeHandler: createSmtpConfigNodeHandler(),
            };

            for (const config of mockConfigs) {
                const scenario: TestScenario = {
                    name: `mock integration - ${config.name || 'unnamed'}`,
                    config,
                    input: { payload: 'test', topic: 'test subject' },
                    timeout: 2000,
                };

                const context = await NodeTestRunner.runScenario(emailSenderNode, scenario, mockOptions);
                expect(context.nodeInstance).to.exist;

                if (config.name) {
                    NodeAssertions.expectNodeProperty(context, 'name', config.name);
                }
            }
        });
    });
});
