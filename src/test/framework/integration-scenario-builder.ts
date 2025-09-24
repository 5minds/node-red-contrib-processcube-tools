import { expect } from 'chai';
import type { IntegrationTestScenario } from './integration-test-runner';
import type { Node } from 'node-red';

export class IntegrationScenarioBuilder {
  private scenarios: IntegrationTestScenario[] = [];

  addScenario(scenario: IntegrationTestScenario): this {
    this.scenarios.push(scenario);
    return this;
  }

  addLoadingScenario(name: string, flow: any[], nodeId: string): this {
    return this.addScenario({
      name,
      flow,
      nodeId,
      timeout: 2000
    });
  }

  addMessageFlowScenario(
    name: string,
    flow: any[],
    sourceNodeId: string,
    input: any,
    expectedMessages: Array<{ nodeId: string; expectedMsg: any }>
  ): this {
    return this.addScenario({
      name,
      flow,
      nodeId: sourceNodeId,
      input,
      expectedMessages,
      timeout: 3000
    });
  }

  addConnectionScenario(name: string, flow: any[], nodeIds: string[]): this {
    return this.addScenario({
      name,
      flow,
      nodeId: nodeIds[0], // Primary node
      setup: (nodes) => {
        // Verify all nodes are connected
        nodeIds.forEach(nodeId => {
          expect(nodes[nodeId], `Node ${nodeId} should exist in connection test`).to.exist;
        });
      }
    });
  }

  addLifecycleScenario(name: string, flow: any[], nodeId: string, operations: Array<(nodes: Record<string, Node>) => void>): this {
    return this.addScenario({
      name,
      flow,
      nodeId,
      setup: (nodes) => {
        operations.forEach(operation => operation(nodes));
      }
    });
  }

  getScenarios(): IntegrationTestScenario[] {
    return [...this.scenarios];
  }

  clear(): this {
    this.scenarios = [];
    return this;
  }
}