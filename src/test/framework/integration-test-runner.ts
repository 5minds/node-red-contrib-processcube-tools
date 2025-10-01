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
    scenario: IntegrationTestScenario
  ): Promise<IntegrationTestContext> {
    console.log(`[SCENARIO START] ${scenario.name}`);

    const context: IntegrationTestContext = {
      nodes: {},
      messages: [],
      errors: []
    };

    // For integration tests, we need to test the main node only
    // Helper nodes would be tested separately
    const mainNodeConfig = scenario.flow.find(n => n.id === scenario.nodeId);

    if (!mainNodeConfig) {
      throw new Error(`Node with id ${scenario.nodeId} not found in flow`);
    }

    // Convert to TestScenario format for NodeTestRunner
    const testScenario: TestScenario = {
      name: scenario.name,
      config: mainNodeConfig,
      input: scenario.input,
      timeout: scenario.timeout || 5000
    };

    // If expecting messages, set up expectations
    if (scenario.expectedMessages && scenario.expectedMessages.length > 0) {
      // We expect output to be sent
      testScenario.expectedOutput = scenario.expectedMessages[0].expectedMsg;
    }

    // Run the scenario using NodeTestRunner
    const testContext = await NodeTestRunner.runScenario(
      nodeConstructor,
      testScenario,
      {
        sendHandler: function(msg: any) {
          // Capture sent messages
          context.messages.push({
            nodeId: scenario.nodeId,
            message: msg,
            timestamp: Date.now()
          });
        },
        errorHandler: function(error: any) {
          // Capture errors
          context.errors.push(error);
        }
      }
    );

    // Store the node instance
    context.nodes[scenario.nodeId] = testContext.nodeInstance;

    // Run custom setup if provided
    if (scenario.setup) {
      scenario.setup(context.nodes);
    }

    console.log(`[SCENARIO COMPLETE] ${scenario.name}`);
    return context;
  }
}