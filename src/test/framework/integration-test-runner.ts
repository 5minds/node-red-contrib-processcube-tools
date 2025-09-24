import * as helper from 'node-red-node-test-helper';
import { expect } from 'chai';
import type { Node, NodeMessageInFlow } from 'node-red';
import type { TestContext } from './types';

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
  private static isHelperInitialized = false;

  static initializeHelper(): void {
    if (!this.isHelperInitialized) {
      helper.init(require.resolve('node-red'));
      this.isHelperInitialized = true;
    }
  }

  static async runIntegrationScenario(
    nodeConstructor: Function,
    scenario: IntegrationTestScenario
  ): Promise<IntegrationTestContext> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Integration test '${scenario.name}' timed out after ${scenario.timeout || 5000}ms`));
      }, scenario.timeout || 5000);

      const context: IntegrationTestContext = {
        nodes: {},
        messages: [],
        errors: []
      };

      helper.load(nodeConstructor as any, scenario.flow, function() {
        try {
          // Collect all nodes from the flow
          scenario.flow.forEach(nodeConfig => {
            const node = helper.getNode(nodeConfig.id);
            if (node) {
              context.nodes[nodeConfig.id] = node;
            }
          });

          // Set up message listeners for expected messages
          if (scenario.expectedMessages) {
            let receivedCount = 0;
            const expectedCount = scenario.expectedMessages.length;

            scenario.expectedMessages.forEach(expectation => {
              const node = context.nodes[expectation.nodeId];
              if (node) {
                node.on('input', function(msg: NodeMessageInFlow) {
                  context.messages.push({
                    nodeId: expectation.nodeId,
                    message: msg,
                    timestamp: Date.now()
                  });

                  receivedCount++;
                  if (receivedCount >= expectedCount) {
                    clearTimeout(timeout);
                    resolve(context);
                  }
                });
              }
            });
          }

          // Run custom setup if provided
          if (scenario.setup) {
            scenario.setup(context.nodes);
          }

          // Send input if provided
          if (scenario.input) {
            const targetNode = context.nodes[scenario.nodeId];
            if (targetNode && (targetNode as any).receive) {
              setTimeout(() => {
                (targetNode as any).receive(scenario.input);
              }, 10);
            }
          }

          // If no expected messages, resolve after setup
          if (!scenario.expectedMessages || scenario.expectedMessages.length === 0) {
            clearTimeout(timeout);
            setTimeout(() => resolve(context), 100);
          }

        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }
}