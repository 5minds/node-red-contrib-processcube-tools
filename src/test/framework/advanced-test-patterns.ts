// ============================================================================
// ADVANCED TEST PATTERNS FOR NODE-RED CUSTOM NODES
// ============================================================================

import { expect } from 'chai';
import { TestScenarioBuilder, NodeTestRunner, NodeAssertions } from './index';
import type { TestScenario, TestContext } from './types';

// ============================================================================
// PERFORMANCE TESTING PATTERNS
// ============================================================================

export interface PerformanceTestScenario extends TestScenario {
  iterations?: number;
  maxDuration?: number;
  memoryLimit?: number;
}

export class PerformanceTestRunner {
  static async runPerformanceTest(
    nodeConstructor: Function,
    scenario: PerformanceTestScenario
  ): Promise<{
    context: TestContext;
    duration: number;
    iterations: number;
    averageTime: number;
    memoryUsed?: number;
  }> {
    const iterations = scenario.iterations || 100;
    const maxDuration = scenario.maxDuration || 5000;
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    let completedIterations = 0;
    let lastContext: TestContext;

    for (let i = 0; i < iterations; i++) {
      if (Date.now() - startTime > maxDuration) {
        break;
      }

      lastContext = await NodeTestRunner.runScenario(nodeConstructor, scenario);
      completedIterations++;
    }

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;

    return {
      context: lastContext!,
      duration,
      iterations: completedIterations,
      averageTime: duration / completedIterations,
      memoryUsed: endMemory - startMemory
    };
  }
}

// ============================================================================
// STRESS TESTING PATTERNS
// ============================================================================

export class StressTestBuilder {
  static createHighVolumeMessageTest(
    name: string,
    config: any,
    messageCount: number,
    messageGenerator: (index: number) => any
  ): TestScenario {
    return {
      name,
      config,
      input: Array.from({ length: messageCount }, (_, i) => messageGenerator(i)),
      timeout: Math.max(5000, messageCount * 10) // Scale timeout with message count
    };
  }

  static createConcurrentAccessTest(
    name: string,
    config: any,
    concurrentOperations: number
  ): TestScenario {
    return {
      name,
      config,
      timeout: 10000,
      input: Array.from({ length: concurrentOperations }, (_, i) => ({
        payload: `concurrent-operation-${i}`,
        timestamp: Date.now()
      }))
    };
  }

  static createMemoryLeakTest(
    name: string,
    config: any,
    operationCount: number
  ): PerformanceTestScenario {
    return {
      name,
      config,
      input: { payload: 'memory-test' },
      iterations: operationCount,
      memoryLimit: 50 * 1024 * 1024, // 50MB limit
      timeout: 30000
    };
  }
}

// ============================================================================
// ERROR RESILIENCE PATTERNS
// ============================================================================

export class ErrorResilienceTestBuilder {
  private scenarios: TestScenario[] = [];

  addNetworkErrorScenario(name: string, config: any): this {
    return this.addScenario({
      name: `${name} - network error`,
      config: { ...config, host: 'unreachable.invalid.test' },
      input: { payload: 'test' },
      expectedError: /network|connection|timeout/i,
      timeout: 3000
    });
  }

  addMalformedInputScenario(name: string, config: any): this {
    const malformedInputs = [
      null,
      undefined,
      { payload: null },
      { payload: '' },
      { payload: { malformed: true, circular: null } },
      'not-an-object'
    ];

    malformedInputs.forEach((input, index) => {
      this.addScenario({
        name: `${name} - malformed input ${index + 1}`,
        config,
        input,
        timeout: 2000
      });
    });

    return this;
  }

  addResourceExhaustionScenario(name: string, config: any): this {
    return this.addScenario({
      name: `${name} - resource exhaustion`,
      config,
      input: {
        payload: 'x'.repeat(10 * 1024 * 1024), // 10MB payload
        largeArray: Array.from({ length: 100000 }, (_, i) => ({ id: i, data: 'test' }))
      },
      timeout: 5000
    });
  }

  addRapidFireScenario(name: string, config: any, messageCount: number = 1000): this {
    return this.addScenario({
      name: `${name} - rapid fire messages`,
      config,
      input: Array.from({ length: messageCount }, (_, i) => ({
        payload: `rapid-message-${i}`,
        sequence: i
      })),
      timeout: Math.max(5000, messageCount * 5)
    });
  }

  private addScenario(scenario: TestScenario): this {
    this.scenarios.push(scenario);
    return this;
  }

  getScenarios(): TestScenario[] {
    return [...this.scenarios];
  }
}

// ============================================================================
// DATA VALIDATION PATTERNS
// ============================================================================

export class DataValidationTestBuilder {
  private scenarios: TestScenario[] = [];

  addSchemaValidationScenario(
    name: string,
    config: any,
    validData: any,
    invalidData: any[]
  ): this {
    // Valid data scenario
    this.scenarios.push({
      name: `${name} - valid schema`,
      config,
      input: { payload: validData },
      timeout: 2000
    });

    // Invalid data scenarios
    invalidData.forEach((data, index) => {
      this.scenarios.push({
        name: `${name} - invalid schema ${index + 1}`,
        config,
        input: { payload: data },
        expectedError: /validation|schema|invalid/i,
        timeout: 2000
      });
    });

    return this;
  }

  addBoundaryValueScenario(
    name: string,
    config: any,
    boundaries: {
      min: any;
      max: any;
      belowMin: any;
      aboveMax: any;
    }
  ): this {
    const scenarios = [
      { name: 'minimum boundary', data: boundaries.min, shouldSucceed: true },
      { name: 'maximum boundary', data: boundaries.max, shouldSucceed: true },
      { name: 'below minimum', data: boundaries.belowMin, shouldSucceed: false },
      { name: 'above maximum', data: boundaries.aboveMax, shouldSucceed: false }
    ];

    scenarios.forEach(scenario => {
      this.scenarios.push({
        name: `${name} - ${scenario.name}`,
        config,
        input: { payload: scenario.data },
        expectedError: scenario.shouldSucceed ? undefined : /boundary|limit|range/i,
        timeout: 2000
      });
    });

    return this;
  }

  addTypeValidationScenario(
    name: string,
    config: any,
    expectedType: string,
    validValues: any[],
    invalidValues: any[]
  ): this {
    validValues.forEach((value, index) => {
      this.scenarios.push({
        name: `${name} - valid ${expectedType} ${index + 1}`,
        config,
        input: { payload: value },
        timeout: 2000
      });
    });

    invalidValues.forEach((value, index) => {
      this.scenarios.push({
        name: `${name} - invalid ${expectedType} ${index + 1}`,
        config,
        input: { payload: value },
        expectedError: /type|invalid|expected/i,
        timeout: 2000
      });
    });

    return this;
  }

  getScenarios(): TestScenario[] {
    return [...this.scenarios];
  }
}

// ============================================================================
// ASYNC BEHAVIOR PATTERNS
// ============================================================================

export class AsyncBehaviorTestBuilder {
  private scenarios: TestScenario[] = [];

  addDelayedResponseScenario(
    name: string,
    config: any,
    input: any,
    expectedDelay: number
  ): this {
    return this.addScenario({
      name: `${name} - delayed response`,
      config,
      input,
      timeout: expectedDelay + 2000 // Add buffer to expected delay
    });
  }

  addRetryMechanismScenario(
    name: string,
    config: any,
    maxRetries: number
  ): this {
    return this.addScenario({
      name: `${name} - retry mechanism`,
      config: { ...config, retries: maxRetries, retryDelay: 100 },
      input: { payload: 'retry-test' },
      timeout: (maxRetries + 1) * 1000
    });
  }

  addTimeoutHandlingScenario(
    name: string,
    config: any,
    operationTimeout: number
  ): this {
    return this.addScenario({
      name: `${name} - timeout handling`,
      config: { ...config, timeout: operationTimeout },
      input: { payload: 'timeout-test' },
      expectedError: /timeout|timed out/i,
      timeout: operationTimeout + 1000
    });
  }

  addBackpressureScenario(
    name: string,
    config: any,
    messageCount: number
  ): this {
    return this.addScenario({
      name: `${name} - backpressure handling`,
      config,
      input: Array.from({ length: messageCount }, (_, i) => ({
        payload: `backpressure-message-${i}`,
        priority: Math.random() > 0.5 ? 'high' : 'low'
      })),
      timeout: messageCount * 10
    });
  }

  private addScenario(scenario: TestScenario): this {
    this.scenarios.push(scenario);
    return this;
  }

  getScenarios(): TestScenario[] {
    return [...this.scenarios];
  }
}

// ============================================================================
// EDGE CASE PATTERNS
// ============================================================================

export class EdgeCaseTestBuilder {
  private scenarios: TestScenario[] = [];

  addEmptyDataScenarios(name: string, config: any): this {
    const emptyDataCases = [
      { name: 'empty object', data: {} },
      { name: 'empty array', data: [] },
      { name: 'empty string', data: '' },
      { name: 'null payload', data: null },
      { name: 'undefined payload', data: undefined },
      { name: 'zero value', data: 0 },
      { name: 'false value', data: false }
    ];

    emptyDataCases.forEach(testCase => {
      this.scenarios.push({
        name: `${name} - ${testCase.name}`,
        config,
        input: { payload: testCase.data },
        timeout: 2000
      });
    });

    return this;
  }

  addSpecialCharacterScenarios(name: string, config: any): this {
    const specialCases = [
      { name: 'unicode characters', data: '🚀💡🌟' },
      { name: 'newlines and tabs', data: 'line1\nline2\tindented' },
      { name: 'special symbols', data: '!@#$%^&*()_+-=[]{}|;:,.<>?' },
      { name: 'very long string', data: 'a'.repeat(10000) },
      { name: 'mixed encoding', data: 'Ñiño café résumé 北京' }
    ];

    specialCases.forEach(testCase => {
      this.scenarios.push({
        name: `${name} - ${testCase.name}`,
        config,
        input: { payload: testCase.data },
        timeout: 3000
      });
    });

    return this;
  }

  addLargeDataScenarios(name: string, config: any): this {
    const largeCases = [
      {
        name: 'large object',
        data: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
        )
      },
      {
        name: 'deeply nested object',
        data: Array.from({ length: 100 }, () => ({})).reduce(
          (acc, _, i) => ({ [`level${i}`]: acc }), { deepest: true }
        )
      },
      {
        name: 'large array',
        data: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: `item${i}` }))
      }
    ];

    largeCases.forEach(testCase => {
      this.scenarios.push({
        name: `${name} - ${testCase.name}`,
        config,
        input: { payload: testCase.data },
        timeout: 5000
      });
    });

    return this;
  }

  getScenarios(): TestScenario[] {
    return [...this.scenarios];
  }
}

// ============================================================================
// SECURITY TESTING PATTERNS
// ============================================================================

export class SecurityTestBuilder {
  private scenarios: TestScenario[] = [];

  addInjectionTestScenarios(name: string, config: any): this {
    const injectionPayloads = [
      { name: 'SQL injection', payload: "'; DROP TABLE users; --" },
      { name: 'XSS attempt', payload: '<script>alert("xss")</script>' },
      { name: 'Command injection', payload: '; rm -rf / ;' },
      { name: 'Path traversal', payload: '../../../etc/passwd' },
      { name: 'JSON injection', payload: '{"__proto__":{"isAdmin":true}}' }
    ];

    injectionPayloads.forEach(attack => {
      this.scenarios.push({
        name: `${name} - ${attack.name}`,
        config,
        input: { payload: attack.payload },
        timeout: 2000
      });
    });

    return this;
  }

  addOversizedPayloadScenarios(name: string, config: any): this {
    const oversizedCases = [
      { name: '1MB payload', size: 1024 * 1024 },
      { name: '10MB payload', size: 10 * 1024 * 1024 },
      { name: 'deeply nested payload', depth: 1000 }
    ];

    oversizedCases.forEach(testCase => {
      let payload;
      if (testCase.size) {
        payload = 'x'.repeat(testCase.size);
      } else if (testCase.depth) {
        payload = Array.from({ length: testCase.depth }, () => ({}))
          .reduce((acc) => ({ nested: acc }), { bottom: true });
      }

      this.scenarios.push({
        name: `${name} - ${testCase.name}`,
        config,
        input: { payload },
        timeout: 10000
      });
    });

    return this;
  }

  getScenarios(): TestScenario[] {
    return [...this.scenarios];
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR COMMON TEST PATTERNS
// ============================================================================

export class TestPatternHelpers {
  /**
   * Create a comprehensive test suite for a Node-RED custom node
   */
  static createComprehensiveTestSuite(
    nodeName: string,
    nodeConstructor: Function,
    configs: {
      valid: any;
      minimal?: any;
      invalid?: any;
    },
    options: {
      includePerformance?: boolean;
      includeStress?: boolean;
      includeSecurity?: boolean;
      includeEdgeCases?: boolean;
    } = {}
  ) {
    return describe(`${nodeName} - Comprehensive Test Suite`, function() {
      this.timeout(30000); // Longer timeout for comprehensive tests

      // Basic functionality tests
      describe('Basic Functionality', function() {
        const basic = new TestScenarioBuilder()
          .addValidScenario('valid config', configs.valid);

        if (configs.minimal) {
          basic.addValidScenario('minimal config', configs.minimal);
        }

        if (configs.invalid) {
          basic.addErrorScenario('invalid config', configs.invalid, /error|invalid/i);
        }

        basic.getScenarios().forEach(scenario => {
          it(`should handle ${scenario.name}`, async function() {
            const context = await NodeTestRunner.runScenario(nodeConstructor, scenario);

            if (scenario.expectedError) {
              NodeAssertions.expectError(context, scenario.expectedError);
            } else {
              NodeAssertions.expectNoErrors(context);
            }
          });
        });
      });

      // Edge cases
      if (options.includeEdgeCases !== false) {
        describe('Edge Cases', function() {
          const edgeCases = new EdgeCaseTestBuilder()
            .addEmptyDataScenarios('empty data handling', configs.valid)
            .addSpecialCharacterScenarios('special characters', configs.valid);

          edgeCases.getScenarios().forEach(scenario => {
            it(`should handle ${scenario.name}`, async function() {
              const context = await NodeTestRunner.runScenario(nodeConstructor, scenario);
              expect(context.nodeInstance).to.exist;
            });
          });
        });
      }

      // Performance tests
      if (options.includePerformance) {
        describe('Performance', function() {
          it('should handle multiple messages efficiently', async function() {
            const scenario = StressTestBuilder.createHighVolumeMessageTest(
              'high volume test',
              configs.valid,
              100,
              (i) => ({ payload: `message-${i}` })
            );

            const result = await PerformanceTestRunner.runPerformanceTest(
              nodeConstructor,
              scenario as PerformanceTestScenario
            );

            expect(result.averageTime).to.be.lessThan(100); // 100ms per message max
            expect(result.iterations).to.be.greaterThan(50); // Should complete at least half
          });
        });
      }

      // Security tests
      if (options.includeSecurity) {
        describe('Security', function() {
          const security = new SecurityTestBuilder()
            .addInjectionTestScenarios('injection resistance', configs.valid);

          security.getScenarios().forEach(scenario => {
            it(`should resist ${scenario.name}`, async function() {
              const context = await NodeTestRunner.runScenario(nodeConstructor, scenario);
              expect(context.nodeInstance).to.exist;
              // Node should not crash or behave unexpectedly
            });
          });
        });
      }
    });
  }

  /**
   * Create data-driven tests from a configuration object
   */
  static createDataDrivenTests(
    testName: string,
    nodeConstructor: Function,
    config: any,
    testCases: Array<{
      name: string;
      input: any;
      expectedOutput?: any;
      expectedError?: string | RegExp;
      timeout?: number;
    }>
  ) {
    describe(testName, function() {
      testCases.forEach(testCase => {
        it(`should handle ${testCase.name}`, async function() {
          const scenario: TestScenario = {
            name: testCase.name,
            config,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            expectedError: testCase.expectedError,
            timeout: testCase.timeout || 3000
          };

          const context = await NodeTestRunner.runScenario(nodeConstructor, scenario);

          if (testCase.expectedOutput) {
            NodeAssertions.expectMessage(context, testCase.expectedOutput);
          }

          if (testCase.expectedError) {
            NodeAssertions.expectError(context, testCase.expectedError);
          }
        });
      });
    });
  }
}