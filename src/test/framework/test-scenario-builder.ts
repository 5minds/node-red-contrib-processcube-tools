import type { TestScenario } from './types';

export class TestScenarioBuilder {
  private scenarios: TestScenario[] = [];

  addScenario(scenario: TestScenario): this {
    this.scenarios.push(scenario);
    return this;
  }

  addValidScenario(
    name: string,
    config: any,
    input?: any,
    expectedOutput?: any
  ): this {
    return this.addScenario({
      name,
      config,
      input,
      expectedOutput
    });
  }

  addErrorScenario(
    name: string,
    config: any,
    expectedError: string | RegExp,
    input?: any
  ): this {
    return this.addScenario({
      name,
      config,
      expectedError,
      input
    });
  }

  addStatusScenario(
    name: string,
    config: any,
    expectedStatus: { fill: string; text?: string },
    input?: any
  ): this {
    return this.addScenario({
      name,
      config,
      expectedStatus,
      input
    });
  }

  addCustomScenario(scenario: Partial<TestScenario> & { name: string; config: any }): this {
    return this.addScenario(scenario as TestScenario);
  }

  getScenarios(): TestScenario[] {
    return [...this.scenarios]; // Return copy to prevent mutation
  }

  clear(): this {
    this.scenarios = [];
    return this;
  }
}
