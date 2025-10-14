import { EnhancedMockNodeREDOptions } from './node-test-runner';
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
        expectedOutput?: any,
        mockOptions?: Partial<EnhancedMockNodeREDOptions>,
    ): this {
        return this.addScenario({
            name,
            config,
            input,
            expectedOutput,
            mockOptions,
        });
    }

    addErrorScenario(
        name: string,
        config: any,
        expectedError: any,
        input?: any,
        mockOptions?: Partial<EnhancedMockNodeREDOptions>,
    ): this {
        this.scenarios.push({
            name,
            config,
            input,
            expectedError,
            mockOptions,
        });
        return this;
    }

    addStatusScenario(
        name: string,
        config: any,
        expectedStatus: any,
        input?: any,
        mockOptions?: Partial<EnhancedMockNodeREDOptions>, // Accept full mock options
    ): this {
        this.scenarios.push({
            name,
            config,
            input,
            expectedStatus,
            mockOptions,
        });
        return this;
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
