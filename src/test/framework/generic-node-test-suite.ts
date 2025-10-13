import { expect } from 'chai';
import { TestScenarioBuilder } from './test-scenario-builder';
import { NodeTestRunner } from './node-test-runner';
import { NodeAssertions } from './node-assertions';
import type { TestScenario, MockNodeREDOptions } from './types';

/**
 * Generic test suite generator for Node-RED custom nodes
 */
export function createNodeTestSuite(
    nodeName: string,
    nodeConstructor: Function,
    testConfigs: Record<string, any>,
    mockOptions?: MockNodeREDOptions,
) {
    describe(`${nodeName} - Generic Test Suite`, function () {
        this.timeout(10000);

        describe('Node Registration', function () {
            it('should register without errors', async function () {
                const scenario: TestScenario = {
                    name: 'registration',
                    config: testConfigs.valid || testConfigs.minimal || {},
                };

                const context = await NodeTestRunner.runScenario(nodeConstructor, scenario, mockOptions);
                expect(context.nodeInstance).to.exist;
                expect(context.mockRED.nodes.lastRegisteredType).to.exist;
                expect(context.mockRED.nodes.lastRegisteredConstructor).to.be.a('function');
            });
        });

        describe('Configuration Validation', function () {
            const validationTests = new TestScenarioBuilder();

            if (testConfigs.valid) {
                validationTests.addValidScenario('valid config', testConfigs.valid);
            }

            if (testConfigs.minimal) {
                validationTests.addValidScenario('minimal config', testConfigs.minimal);
            }

            if (testConfigs.invalid) {
                validationTests.addErrorScenario('invalid config', testConfigs.invalid, /error|invalid|missing/i);
            }

            validationTests.getScenarios().forEach((scenario) => {
                it(`should handle ${scenario.name}`, async function () {
                    const context = await NodeTestRunner.runScenario(nodeConstructor, scenario, mockOptions);

                    expect(context.nodeInstance).to.exist;

                    if (scenario.expectedError) {
                        NodeAssertions.expectError(context, scenario.expectedError);
                    } else {
                        NodeAssertions.expectNoErrors(context);
                    }
                });
            });
        });
    });
}
