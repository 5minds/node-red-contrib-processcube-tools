import { expect } from 'chai';
import emailReceiverNode from '../../email-receiver/email-receiver';
import { EmailReceiverTestConfigs } from '../helpers/email-receiver-test-configs';

// Import our comprehensive test framework
import { NodeTestRunner, NodeAssertions, TestScenario, MockNodeREDOptions } from '../framework';

import { MockImap } from '../mocks/imap-mock';
import { createMockMailparser } from '../mocks/mailparser-mock';

describe('E-Mail Receiver Node - Integration Tests', function () {
    // ========================================================================
    // INTEGRATION WITH EXISTING MOCK SYSTEM
    // ========================================================================

    describe('Mock System Integration', function () {
        it('should work with all mock configurations', async function () {
            const mockConfigs = [
                EmailReceiverTestConfigs.valid,
                EmailReceiverTestConfigs.minimal,
                EmailReceiverTestConfigs.arrayFolders,
            ];

            for (const config of mockConfigs) {
                const scenario: TestScenario = {
                    name: `mock integration - ${config.name || 'unnamed'}`,
                    config,
                    input: { payload: 'test' },
                    timeout: 2000,
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
