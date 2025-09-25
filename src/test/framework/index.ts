// Main exports for the Node-RED test framework

// Unit Testing Framework
export { TestScenarioBuilder } from './test-scenario-builder';
export { NodeTestRunner } from './node-test-runner';
export { NodeAssertions } from './node-assertions';
export { createNodeTestSuite } from './generic-node-test-suite';

// Integration Testing Framework
export { IntegrationTestRunner} from './integration-test-runner';
export { IntegrationAssertions } from './integration-assertions';
export { IntegrationScenarioBuilder } from './integration-scenario-builder';

export {
  PerformanceTestRunner,
  StressTestBuilder,
  ErrorResilienceTestBuilder,
  DataValidationTestBuilder,
  AsyncBehaviorTestBuilder,
  EdgeCaseTestBuilder,
  SecurityTestBuilder,
  TestPatternHelpers,
  type PerformanceTestScenario
} from './advanced-test-patterns';

// Types
export * from './types';