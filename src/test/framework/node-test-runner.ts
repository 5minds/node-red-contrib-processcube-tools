import type { NodeAPI } from 'node-red';
import type { TestScenario, TestContext, MockNodeREDOptions } from './types';

// Minimal extension for dependency injection
export interface DependencyContainer {
  [key: string]: any;
}

export interface EnhancedMockNodeREDOptions extends MockNodeREDOptions {
  dependencies?: DependencyContainer;
}

export class NodeTestRunner {
  private static createMockNodeRED(context: TestContext, options: EnhancedMockNodeREDOptions = {}): any {
    return {
      nodes: {
        createNode: function(node: any, config: any) {
          Object.assign(node, config);

          // Inject dependencies if available
          if (options.dependencies) {
            Object.keys(options.dependencies).forEach(key => {
              if (!node[key]) {
                node[key] = options.dependencies![key];
              }
            });
          }

          // Set up event handlers
          node.on = options.onHandler || function(event: string, callback: Function) {
            if (event === 'input') {
              (node as any).inputCallback = callback;
            }
          };

          // Override node methods to capture calls
          node.send = function(msg: any) {
            context.messages.push(msg);
            if (options.sendHandler) {
              options.sendHandler.call(this, msg);
            }
          };

          node.error = function(error: any) {
            context.errors.push(error);
            if (options.errorHandler) {
              options.errorHandler.call(this, error);
            }
          };

          node.status = function(status: any) {
            context.statuses.push(status);
            if (options.statusHandler) {
              options.statusHandler.call(this, status);
            }
          };

          return node;
        },
        registerType: function(type: string, constructor: Function) {
          (this as any).lastRegisteredType = type;
          (this as any).lastRegisteredConstructor = constructor;
        }
      },
      util: {
            evaluateNodeProperty: (value: any, type: string, node: any, msg: any): any => {
                switch (type) {
                    case 'str':
                        return String(value);
                    case 'num':
                        return Number(value);
                    case 'bool':
                        return Boolean(value);
                    case 'json':
                        try {
                            return typeof value === 'string' ? JSON.parse(value) : value;
                        } catch {
                            return value;
                        }
                    case 'msg':
                        const keys = value.split('.');
                        let result = msg;
                        for (const key of keys) {
                            result = result?.[key];
                        }
                        return result;
                    case 'flow':
                    case 'global':
                        return value;
                    default:
                        return value;
                }
            }
        }
    };
  }

  private static createTestContext(options: EnhancedMockNodeREDOptions = {}): TestContext {
    const context: TestContext = {
      mockRED: null,
      nodeInstance: null,
      messages: [],
      errors: [],
      statuses: []
    };

    context.mockRED = this.createMockNodeRED(context, options);
    return context;
  }

  static async runScenario(
    nodeConstructorFn: Function,
    scenario: TestScenario,
    mockOptions: EnhancedMockNodeREDOptions = {}
  ): Promise<TestContext> {
    const context = this.createTestContext(mockOptions);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test scenario '${scenario.name}' timed out after ${scenario.timeout || 5000}ms`));
      }, scenario.timeout || 5000);

      let expectedEvents = 0;
      let receivedEvents = 0;

      // Count expected events
      if (scenario.expectedOutput) expectedEvents++;
      if (scenario.expectedError) expectedEvents++;
      if (scenario.expectedStatus) expectedEvents++;

      const checkCompletion = () => {
        receivedEvents++;
        if (receivedEvents >= expectedEvents || expectedEvents === 0) {
          clearTimeout(timeout);
          // Small delay to catch any additional events
          setTimeout(() => resolve(context), 50);
        }
      };

      try {
        // Register the node - pass dependencies as second parameter if available
        if (mockOptions.dependencies) {
          nodeConstructorFn(context.mockRED as unknown as NodeAPI, mockOptions.dependencies);
        } else {
          nodeConstructorFn(context.mockRED as unknown as NodeAPI);
        }

        // Create node instance
        const NodeConstructor = (context.mockRED.nodes as any).lastRegisteredConstructor;
        context.nodeInstance = new NodeConstructor(scenario.config);

        // Set up completion detection
        const originalSend = context.nodeInstance.send;
        const originalError = context.nodeInstance.error;
        const originalStatus = context.nodeInstance.status;

        if (scenario.expectedOutput) {
          context.nodeInstance.send = function(msg: any) {
            originalSend.call(this, msg);
            checkCompletion();
          };
        }

        if (scenario.expectedError) {
          context.nodeInstance.error = function(error: any) {
            originalError.call(this, error);
            checkCompletion();
          };
        }

        if (scenario.expectedStatus) {
          const statusChecks: any[] = [];

          context.nodeInstance.status = function(status: any) {
            originalStatus.call(this, status);
            statusChecks.push(status);

            // If waiting for final status, only complete on specific pattern
            if (scenario.waitForFinalStatus && scenario.finalStatusPattern) {
              if (status.text?.includes(scenario.finalStatusPattern)) {
                checkCompletion();
              }
            } else {
              checkCompletion();
            }
          };
        }

        // If no expectations, complete after creation
        if (expectedEvents === 0) {
          clearTimeout(timeout);
          setTimeout(() => resolve(context), 100);
          return;
        }

        // Trigger input if provided
        if (scenario.input && (context.nodeInstance as any).inputCallback) {
          setTimeout(() => {
            (context.nodeInstance as any).inputCallback(scenario.input);
          }, 10);
        }

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}