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

          // Add logging methods
          node.log = function(msg: any) {
            if (options.logHandler) {
              options.logHandler.call(this, msg);
            }
            // Optionally store logs in context
            if (!context.logs) context.logs = [];
            context.logs.push(msg);
          };

          node.warn = function(msg: any) {
            if (options.warnHandler) {
              options.warnHandler.call(this, msg);
            }
            if (!context.warnings) context.warnings = [];
            context.warnings.push(msg);
          };

          node.debug = function(msg: any) {
            if (options.debugHandler) {
              options.debugHandler.call(this, msg);
            }
            if (!context.debugs) context.debugs = [];
            context.debugs.push(msg);
          };

          node.trace = function(msg: any) {
            if (options.traceHandler) {
              options.traceHandler.call(this, msg);
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
      let completed = false;

      const timeout = setTimeout(() => {
        if (!completed) {
          reject(new Error(`Test scenario '${scenario.name}' timed out after ${scenario.timeout || 5000}ms`));
        }
      }, scenario.timeout || 5000);

      const complete = () => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        // Small delay to catch any additional events
        setTimeout(() => resolve(context), 50);
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

        if ((context.nodeInstance as any).configError) {
          setTimeout(() => {
            if (scenario.expectedError && context.errors.length > 0) {
              complete();
            } else if (scenario.expectedStatus && context.statuses.length > 0) {
              complete();
            }
          }, 100);
          return;
        }

        // Set up completion detection based on scenario configuration
        const originalSend = context.nodeInstance.send;
        const originalError = context.nodeInstance.error;
        const originalStatus = context.nodeInstance.status;

        // Override send to detect expected output
        if (scenario.expectedOutput) {
          context.nodeInstance.send = function(msg: any) {
            originalSend.call(this, msg);
            complete();
          };
        }

        // Override error to detect expected errors
        if (scenario.expectedError) {
          let errorCount = context.errors.length;
          context.nodeInstance.error = function(error: any) {
            originalError.call(this, error);
            // ✅ Only complete on NEW errors (not construction errors we already saw)
            if (context.errors.length > errorCount) {
              errorCount = context.errors.length;
              complete();
            }
          };
        }

        // Override status to detect completion patterns
        if (scenario.expectedStatus) {
          let statusCount = context.statuses.length;
          context.nodeInstance.status = function(status: any) {
            originalStatus.call(this, status);

            // ✅ Only check NEW statuses
            if (context.statuses.length > statusCount) {
              statusCount = context.statuses.length;

              const fillMatches = !scenario.expectedStatus!.fill || status.fill === scenario.expectedStatus!.fill;
              const shapeMatches = !scenario.expectedStatus!.shape || status.shape === scenario.expectedStatus!.shape;
              const textMatches = !scenario.expectedStatus!.text || status.text?.includes(scenario.expectedStatus!.text);

              if (fillMatches && shapeMatches && textMatches) {
                complete();
              }
            }
          };
        }

        // If no specific expectations, complete after a short delay
        if (!scenario.expectedOutput && !scenario.expectedError && !scenario.expectedStatus) {
          setTimeout(() => complete(), 100);
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