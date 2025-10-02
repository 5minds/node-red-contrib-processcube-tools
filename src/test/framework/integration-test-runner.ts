import type { Node, NodeMessageInFlow } from 'node-red';
import { NodeTestRunner } from './node-test-runner';
import type { TestScenario } from './types';

export interface IntegrationTestScenario {
    name: string;
    flow: any[];
    nodeId: string;
    input?: any;
    expectedMessages?: Array<{
        nodeId: string;
        expectedMsg: any;
        timeout?: number;
    }>;
    timeout?: number;
    setup?: (nodes: Record<string, Node>) => void;
    cleanup?: () => void;
}

export interface IntegrationTestContext {
    nodes: Record<string, Node>;
    messages: Array<{
        nodeId: string;
        message: NodeMessageInFlow;
        timestamp: number;
    }>;
    errors: any[];
}

export class IntegrationTestRunner {
    static async runIntegrationScenario(
        nodeConstructor: Function,
        scenario: IntegrationTestScenario,
    ): Promise<IntegrationTestContext> {
        console.log(`[SCENARIO START] ${scenario.name}`);

        const context: IntegrationTestContext = {
            nodes: {},
            messages: [],
            errors: [],
        };

        const mainNodeConfig = scenario.flow.find((n) => n.id === scenario.nodeId);

        if (!mainNodeConfig) {
            throw new Error(`Node with id ${scenario.nodeId} not found in flow`);
        }

        const testScenario: TestScenario = {
            name: scenario.name,
            config: mainNodeConfig,
            input: scenario.input,
            timeout: scenario.timeout || 5000,
        };

        if (scenario.expectedMessages && scenario.expectedMessages.length > 0) {
            testScenario.expectedOutput = scenario.expectedMessages[0].expectedMsg;
        }

        const testContext = await NodeTestRunner.runScenario(nodeConstructor, testScenario, {
            sendHandler: function (msg: any) {
                // When send is called with array (multi-output), handle each output
                if (Array.isArray(msg)) {
                    msg.forEach((m, index) => {
                        if (scenario.expectedMessages && scenario.expectedMessages[index]) {
                            context.messages.push({
                                nodeId: scenario.expectedMessages[index].nodeId,
                                message: m,
                                timestamp: Date.now(),
                            });
                        }
                    });
                } else {
                    // Single message - use first expected message nodeId if available
                    const nodeId =
                        scenario.expectedMessages && scenario.expectedMessages[0]
                            ? scenario.expectedMessages[0].nodeId
                            : scenario.nodeId;

                    context.messages.push({
                        nodeId: nodeId,
                        message: msg,
                        timestamp: Date.now(),
                    });
                }
            },
            errorHandler: function (error: any) {
                context.errors.push(error);
            },
        });

        context.nodes[scenario.nodeId] = testContext.nodeInstance;

        if (scenario.setup) {
            scenario.setup(context.nodes);
        }

        console.log(`[SCENARIO COMPLETE] ${scenario.name}`);
        return context;
    }
}
